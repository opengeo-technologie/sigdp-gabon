import os
import shutil

from fastapi import (
    APIRouter,
    Depends,
    Form,
    HTTPException,
    status,
    Query,
    UploadFile,
    File,
)
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from pathlib import Path
import pandas as pd
import io
import time
import qrcode
from PIL import Image, ImageDraw, ImageFont

from app.database import get_db
from app.models.pecheur import Pecheur
from app.schemas.pecheur import (
    PecheurCreate,
    PecheurUpdate,
    PecheurResponse,
    PecheurInDB,
    CartePecheurGenerate,
)
from app.services.activity_logger import log_activity, ActivityLogger
from app.models.armement_coorperative import ArmementCooperative
from app.models.debarcadere import Debarcadere

from app.utils.validation import parser_date

router = APIRouter(prefix="/api/pecheurs", tags=["Pêcheurs"])

# Configuration upload
UPLOAD_DIR = Path("uploads/pecheurs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Taille max photo: 5MB
MAX_PHOTO_SIZE = 5 * 1024 * 1024

# Configuration upload
ERRORS_DIR = Path("errors/pecheurs")
ERRORS_DIR.mkdir(parents=True, exist_ok=True)

ERROR_FILE = ERRORS_DIR / "errors.xlsx"


def get_next_reference(db: Session = Depends(get_db)) -> str:
    current_year = datetime.now().year

    # Récupérer la dernière commande de l'année courante
    last_data = db.query(Pecheur).order_by(Pecheur.id.desc()).first()

    if not last_data:
        # Première commande de l'année
        next_ref = f"001/{current_year}"
    else:
        parts = last_data.numero_carte.split("/")
        if len(parts) == 2 and parts[0].isdigit():
            next_number = int(parts[0]) + 1
            next_ref = f"{next_number:03d}/{current_year}"
        else:
            # Fallback si le format n’est pas reconnu
            next_ref = f"001/{current_year}"

    return next_ref


def save_errors(errors: list[dict], header: list[str]):
    new_df = pd.DataFrame(errors)
    new_df = (
        new_df[header + ["error_message"]]
        if all(h in new_df.columns for h in header)
        else new_df
    )

    if os.path.exists(ERROR_FILE):
        existing_df = pd.read_excel(ERROR_FILE)
        final_df = pd.concat([existing_df, new_df], ignore_index=True)
    else:
        final_df = new_df

    final_df.to_excel(ERROR_FILE, index=False, header=True)


@router.post("/upload-excel")
async def upload_pecheurs_excel(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """
    Télécharge un fichier Excel contenant les données des sites de peche et les insère dans la base de données.

    Format attendu du fichier Excel:
    - nom: Nom du pecheur
    - prenom: Prénom du pecheur
    - nationalite: Nationalité du pecheur
    - type_carte: Type de carte du pecheur
    - numero_piece_identite: Numéro de la pièce d'identité du pecheur
    - telephone: Numero telephone
    - adresse: Adresse du pecheur
    - categorie: Categorie de pecheur (Artisanal, Semi-industriel, Patron, Aide-pêcheur)
    - statut: Statut (actif, inactif)
    """

    # Vérifier l'extension du fichier
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Le fichier doit être au format Excel (.xlsx ou .xls)",
        )

    try:
        # Lire le fichier Excel avec pandas
        contents = await file.read()
        excel_file = io.BytesIO(contents)
        engine = "openpyxl" if file.filename.endswith(".xlsx") else "xlrd"
        df = pd.read_excel(excel_file, engine=engine)

        # print(df.columns)

        # Valider les colonnes requises
        required_columns = {
            "nom",
            "prenom",
            "nationalite",
            "type_carte",
            "numero_piece_identite",
            "date_de_naissance",
            "telephone",
            "adresse",
            "categorie",
            "statut",
            "cooperative",
        }

        if not required_columns.issubset(df.columns):
            raise HTTPException(
                status_code=400,
                detail=f"Le fichier Excel doit contenir les colonnes suivantes: {', '.join(required_columns)}",
            )

        # Nettoyer les données
        df = df.fillna("")  # Remplacer NaN par chaîne vide

        # Insérer les données dans la base de données

        pieces_existantes = {
            p.numero_piece_identite.lower().strip()
            for p in db.query(Pecheur.numero_piece_identite).all()
            if p.numero_piece_identite
        }

        # Détection des doublons internes au fichier
        pieces_vues_fichier: set[str] = set()

        # Statistiques d'import
        total_rows = len(df)
        inserted_count = 0
        updated_count = 0
        errors = []

        for _, row in df.iterrows():

            nom = str(row["nom"]).strip().lower()
            prenom = str(row["prenom"]).strip().lower()
            piece = str(row["numero_piece_identite"]).strip().lower()

            pecheur = (
                db.query(Pecheur)
                .filter(
                    or_(
                        and_(
                            func.lower(func.trim(Pecheur.nom))
                            == str(row["nom"]).strip().lower(),
                            func.lower(func.trim(Pecheur.prenom))
                            == str(row["prenom"]).strip().lower(),
                        ),
                        func.lower(func.trim(Pecheur.numero_piece_identite))
                        == str(row["numero_piece_identite"]).strip().lower(),
                    )
                )
                .first()
            )

            try:

                if pecheur:
                    continue
                    # raise ValueError(
                    #     f"Pêcheur {pecheur.nom} {pecheur.prenom} déja existant."
                    # )

                # --- Doublons ---
                piece_cle = piece.lower()
                if piece_cle in pieces_existantes:
                    raise ValueError(
                        f"Un pêcheur avec la pièce d'identité « {piece} » "
                        f"existe déjà dans la base de données"
                    )
                if piece_cle in pieces_vues_fichier:
                    raise ValueError(
                        f"La pièce d'identité « {piece} » apparaît plusieurs fois "
                        f"dans le fichier (doublon interne)"
                    )

                # --- Dates et cohérence métier ---
                date_naissance_pecheur = parser_date(
                    row.get("date_de_naissance"), "Date de naissance du pecheur"
                )
                if date_naissance_pecheur and date_naissance_pecheur > date.today():
                    raise ValueError(
                        f"La date de naissance ({date_naissance_pecheur.strftime('%d/%m/%Y')}) "
                        f"est dans le futur"
                    )

                # print(row.get("date_de_naissance"))

                cooperative = (
                    db.query(ArmementCooperative)
                    .filter(
                        and_(
                            func.lower(func.trim(ArmementCooperative.sigle))
                            == str(row["cooperative"]).strip().lower(),
                            ArmementCooperative.type_association
                            == row["type_association"],
                        )
                    )
                    .first()
                )

                debarcadere = (
                    db.query(Debarcadere)
                    .filter(
                        func.lower(func.trim(Debarcadere.nom_local))
                        == str(row["site_attache"]).strip().lower(),
                    )
                    .first()
                )

                pecheur_data = PecheurCreate(
                    numero_carte=get_next_reference(db),
                    nom=str(row["nom"]),
                    prenom=str(row["prenom"]),
                    date_naissance=date_naissance_pecheur,  # Valeur par défaut, à ajuster selon les besoins
                    lieu_naissance="",
                    email="",
                    nationalite=str(row["nationalite"]),
                    type_carte=str(row["type_carte"]),
                    numero_piece_identite=str(row["numero_piece_identite"]),
                    telephone=str(row["telephone"]),
                    adresse=str(row["adresse"]),
                    categorie=str(row["categorie"]),
                    statut=str(row["statut"]),
                    cooperative_id=cooperative.id if cooperative else None,
                    cooperative_nom=cooperative.sigle if cooperative else None,
                    debarcadere_habituel_id=debarcadere.id if debarcadere else None,
                    debarcadere_habituel_code=(
                        debarcadere.code if debarcadere else None
                    ),
                    debarcadere_habituel_nom=(
                        debarcadere.nom_local if debarcadere else None
                    ),
                )
                pecheur = Pecheur(**pecheur_data.model_dump())
                db.add(pecheur)
                db.commit()
                pieces_vues_fichier.add(piece_cle)
                inserted_count += 1
            except Exception as e:
                db.rollback()
                error_row = row.to_dict()
                error_row["error_message"] = str(e)
                errors.append(error_row)

        header = df.columns.tolist()
        if errors:
            save_errors(errors, header)

        return {
            "total": total_rows,
            "inseres": inserted_count,
            "echoues": len(errors),
            "erreurs": errors,
            "error_file": ERROR_FILE if errors else None,
        }

    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400, detail="Le fichier Excel est vide ou mal formaté"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erreur lors du traitement du fichier: {str(e)}"
        )


def calculate_age(date_naissance: date) -> int:
    """Calculer l'âge à partir de la date de naissance"""
    today = date.today()
    return (
        today.year
        - date_naissance.year
        - ((today.month, today.day) < (date_naissance.month, date_naissance.day))
    )


def is_licence_active(date_expiration: Optional[date]) -> bool:
    """Vérifier si la licence est encore valide"""
    if not date_expiration:
        return False
    return date_expiration >= date.today()


@router.get("", response_model=List[PecheurResponse])
def get_pecheurs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=1000),
    province: Optional[str] = None,
    categorie: Optional[str] = None,
    statut: Optional[str] = None,
    type_peche: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Récupérer la liste des pêcheurs avec filtres optionnels
    """
    query = db.query(Pecheur)

    if categorie:
        query = query.filter(Pecheur.categorie == categorie)
    if statut:
        query = query.filter(Pecheur.statut == statut)
    if type_peche:
        query = query.filter(Pecheur.type_peche == type_peche)

    pecheurs = query.offset(skip).all()

    # Enrichir avec les données calculées
    result = []
    for pecheur in pecheurs:
        pecheur_dict = PecheurInDB.from_orm(pecheur).model_dump()
        pecheur_dict["age"] = calculate_age(pecheur.date_naissance)
        # pecheur_dict["licence_active"] = is_licence_active(
        #     pecheur.licence_date_expiration
        # )
        result.append(PecheurResponse(**pecheur_dict))

    return result


@router.get("/{pecheur_id}", response_model=PecheurResponse)
def get_pecheur(pecheur_id: int, db: Session = Depends(get_db)):
    """
    Récupérer un pêcheur par son ID
    """
    pecheur = db.query(Pecheur).filter(Pecheur.id == pecheur_id).first()

    if not pecheur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pêcheur avec ID {pecheur_id} introuvable",
        )

    pecheur_dict = PecheurInDB.from_orm(pecheur).model_dump()
    pecheur_dict["age"] = calculate_age(pecheur.date_naissance)

    return PecheurResponse(**pecheur_dict)


@router.get("/numero/{numero_carte}", response_model=PecheurResponse)
def get_pecheur_by_numero(numero_carte: str, db: Session = Depends(get_db)):
    """
    Récupérer un pêcheur par son numéro de carte
    """
    pecheur = db.query(Pecheur).filter(Pecheur.numero_carte == numero_carte).first()

    if not pecheur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pêcheur avec numéro de carte {numero_carte} introuvable",
        )

    pecheur_dict = PecheurInDB.from_orm(pecheur).model_dump()
    pecheur_dict["age"] = calculate_age(pecheur.date_naissance)
    pecheur_dict["licence_active"] = is_licence_active(pecheur.licence_date_expiration)

    return PecheurResponse(**pecheur_dict)


@router.get("/dropdown/list/data")
def get_pecheurs_dropdown(db: Session = Depends(get_db)):
    query = db.query(Pecheur).all()

    pecheurs_dict = [{"id": p.id, "nom": p.nom, "prenom": p.prenom} for p in query]

    return pecheurs_dict


def save_photo(photo: UploadFile, pecheur_id: int) -> str:
    """
    Sauvegarder et traiter la photo du pêcheur

    Returns:
        str: Nom du fichier sauvegardé
    """
    # Vérifier le type
    if not photo.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier doit être une image (JPG, PNG)",
        )

    # Vérifier la taille
    photo.file.seek(0, 2)  # Aller à la fin
    file_size = photo.file.tell()
    photo.file.seek(0)  # Revenir au début

    if file_size > MAX_PHOTO_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image trop grande (max {MAX_PHOTO_SIZE // (1024*1024)}MB)",
        )

    # Générer nom unique
    ext = photo.filename.split(".")[-1] if "." in photo.filename else "jpg"
    filename = f"pecheur_{pecheur_id}_{int(time.time())}.{ext}"
    file_path = UPLOAD_DIR / filename

    # Sauvegarder temporairement
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)

    # Redimensionner et optimiser avec Pillow
    try:
        img = Image.open(file_path)

        # Convertir en RGB si nécessaire
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")

        # Redimensionner à 800x800 max (garde le ratio)
        img.thumbnail((800, 800), Image.Resampling.LANCZOS)

        # Sauvegarder optimisé
        img.save(file_path, "JPEG", quality=85, optimize=True)

        return filename

    except Exception as e:
        # Supprimer le fichier en cas d'erreur
        file_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erreur traitement image: {str(e)}",
        )


def delete_photo(photo_filename: str):
    """Supprimer une photo"""
    if photo_filename:
        photo_path = UPLOAD_DIR / photo_filename
        photo_path.unlink(missing_ok=True)


@router.post("", response_model=PecheurResponse, status_code=status.HTTP_201_CREATED)
def create_pecheur(pecheur_data: PecheurCreate, db: Session = Depends(get_db)):
    """
    Créer un nouveau pêcheur
    """
    # Vérifier si le numéro de carte existe déjà
    existing = (
        db.query(Pecheur)
        .filter(Pecheur.numero_carte == pecheur_data.numero_carte)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un pêcheur avec le numéro de carte {pecheur_data.numero_carte} existe déjà",
        )

    pecheur = Pecheur(**pecheur_data.model_dump())

    db.add(pecheur)
    db.commit()
    db.refresh(pecheur)

    pecheur_dict = PecheurInDB.from_orm(pecheur).model_dump()
    pecheur_dict["age"] = calculate_age(pecheur.date_naissance)
    pecheur_dict["licence_active"] = is_licence_active(pecheur.licence_date_expiration)

    return PecheurResponse(**pecheur_dict)


@router.put("/{pecheur_id}", response_model=PecheurResponse)
def update_pecheur(
    pecheur_id: int, pecheur_data: PecheurUpdate, db: Session = Depends(get_db)
):
    """
    Mettre à jour un pêcheur
    """
    pecheur = db.query(Pecheur).filter(Pecheur.id == pecheur_id).first()

    if not pecheur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pêcheur avec ID {pecheur_id} introuvable",
        )

    update_data = pecheur_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(pecheur, field, value)

    db.commit()
    db.refresh(pecheur)

    pecheur_dict = PecheurInDB.from_orm(pecheur).model_dump()
    pecheur_dict["age"] = calculate_age(pecheur.date_naissance)
    pecheur_dict["licence_active"] = is_licence_active(pecheur.licence_date_expiration)

    return PecheurResponse(**pecheur_dict)


@router.delete("/{pecheur_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pecheur(pecheur_id: int, db: Session = Depends(get_db)):
    """
    Supprimer un pêcheur
    """
    pecheur = db.query(Pecheur).filter(Pecheur.id == pecheur_id).first()

    if not pecheur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pêcheur avec ID {pecheur_id} introuvable",
        )

    delete_photo(pecheur.photo_url)

    db.delete(pecheur)
    db.commit()

    return None


# @router.post("/{pecheur_id}/photo")
# async def upload_photo(
#     pecheur_id: int, photo: UploadFile = File(...), db: Session = Depends(get_db)
# ):
#     """
#     Upload de la photo du pêcheur
#     """
#     pecheur = db.query(Pecheur).filter(Pecheur.id == pecheur_id).first()

#     if not pecheur:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Pêcheur avec ID {pecheur_id} introuvable",
#         )

#     # Lire et stocker la photo
#     photo_data = await photo.read()
#     pecheur.photo = photo_data

#     db.commit()

#     return {"message": "Photo uploadée avec succès"}


# @router.get("/{pecheur_id}/carte")
# def generate_carte_pecheur(pecheur_id: int, db: Session = Depends(get_db)):
#     """
#     Générer la carte de pêcheur au format PNG
#     """
#     pecheur = db.query(Pecheur).filter(Pecheur.id == pecheur_id).first()

#     if not pecheur:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Pêcheur avec ID {pecheur_id} introuvable",
#         )

#     # Créer la carte (format carte de crédit : 85.6mm x 53.98mm à 300 DPI = 1011 x 638 pixels)
#     width, height = 1011, 638
#     card = Image.new("RGB", (width, height), color="white")
#     draw = ImageDraw.Draw(card)

#     # Couleurs
#     primary_color = (13, 71, 161)  # Bleu foncé
#     secondary_color = (25, 118, 210)  # Bleu clair
#     text_color = (33, 33, 33)

#     # Header avec dégradé (simplifié)
#     for i in range(200):
#         color = tuple(
#             int(primary_color[j] + (secondary_color[j] - primary_color[j]) * i / 200)
#             for j in range(3)
#         )
#         draw.rectangle([(0, i), (width, i + 1)], fill=color)

#     # Titre
#     try:
#         title_font = ImageFont.truetype(
#             "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36
#         )
#         text_font = ImageFont.truetype(
#             "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24
#         )
#         small_font = ImageFont.truetype(
#             "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18
#         )
#     except:
#         title_font = ImageFont.load_default()
#         text_font = ImageFont.load_default()
#         small_font = ImageFont.load_default()

#     # Titre
#     draw.text((30, 30), "RÉPUBLIQUE GABONAISE", fill="white", font=small_font)
#     draw.text((30, 60), "CARTE NATIONALE DE PÊCHEUR", fill="white", font=title_font)
#     draw.text(
#         (30, 110), "Ministère des Eaux et Forêts - DPA", fill="white", font=small_font
#     )

#     # Informations du pêcheur
#     y_offset = 250
#     draw.text(
#         (30, y_offset),
#         f"Numéro: {pecheur.numero_carte}",
#         fill=text_color,
#         font=text_font,
#     )
#     draw.text(
#         (30, y_offset + 40),
#         f"Nom: {pecheur.nom} {pecheur.prenom}",
#         fill=text_color,
#         font=text_font,
#     )
#     draw.text(
#         (30, y_offset + 80),
#         f"Date de naissance: {pecheur.date_naissance.strftime('%d/%m/%Y')}",
#         fill=text_color,
#         font=small_font,
#     )
#     draw.text(
#         (30, y_offset + 110),
#         f"Catégorie: {pecheur.categorie.value}",
#         fill=text_color,
#         font=small_font,
#     )
#     draw.text(
#         (30, y_offset + 140),
#         f"Type: {pecheur.type_peche.value}",
#         fill=text_color,
#         font=small_font,
#     )

#     if pecheur.licence_date_expiration:
#         draw.text(
#             (30, y_offset + 170),
#             f"Valide jusqu'au: {pecheur.licence_date_expiration.strftime('%d/%m/%Y')}",
#             fill=text_color,
#             font=small_font,
#         )

#     # Générer QR code
#     qr = qrcode.QRCode(version=1, box_size=4, border=1)
#     qr_data = f"CNP:{pecheur.numero_carte}|NOM:{pecheur.nom}|PRENOM:{pecheur.prenom}|ID:{pecheur.id}"
#     qr.add_data(qr_data)
#     qr.make(fit=True)

#     qr_img = qr.make_image(fill_color="black", back_color="white")
#     qr_img = qr_img.resize((180, 180))

#     # Coller le QR code sur la carte
#     card.paste(qr_img, (width - 210, height - 210))

#     # Photo du pêcheur (si disponible)
#     if pecheur.photo:
#         try:
#             photo_img = Image.open(io.BytesIO(pecheur.photo))
#             photo_img = photo_img.resize((150, 150))
#             card.paste(photo_img, (width - 400, 250))
#         except:
#             pass

#     # Convertir en bytes
#     img_byte_arr = io.BytesIO()
#     card.save(img_byte_arr, format="PNG")
#     img_byte_arr.seek(0)

#     return StreamingResponse(
#         img_byte_arr,
#         media_type="image/png",
#         headers={
#             "Content-Disposition": f"attachment; filename=carte_pecheur_{pecheur.numero_carte}.png"
#         },
#     )


# @router.get("/{pecheur_id}/qrcode")
# def get_qrcode(pecheur_id: int, db: Session = Depends(get_db)):
#     """
#     Générer uniquement le QR code du pêcheur
#     """
#     pecheur = db.query(Pecheur).filter(Pecheur.id == pecheur_id).first()

#     if not pecheur:
#         raise HTTPException(
#             status_code=status.HTTP_404_NOT_FOUND,
#             detail=f"Pêcheur avec ID {pecheur_id} introuvable",
#         )

#     # Générer QR code
#     qr = qrcode.QRCode(version=1, box_size=10, border=2)
#     qr_data = f"CNP:{pecheur.numero_carte}|NOM:{pecheur.nom}|PRENOM:{pecheur.prenom}|ID:{pecheur.id}"
#     qr.add_data(qr_data)
#     qr.make(fit=True)

#     qr_img = qr.make_image(fill_color="black", back_color="white")

#     # Convertir en bytes
#     img_byte_arr = io.BytesIO()
#     qr_img.save(img_byte_arr, format="PNG")
#     img_byte_arr.seek(0)

#     return StreamingResponse(
#         img_byte_arr,
#         media_type="image/png",
#         headers={
#             "Content-Disposition": f"attachment; filename=qrcode_{pecheur.numero_carte}.png"
#         },
#     )


# ========================================
# ENDPOINTS AVEC PHOTO (multipart/form-data)
# ========================================


@router.post(
    "/with-photo", response_model=PecheurResponse, status_code=status.HTTP_201_CREATED
)
@log_activity(action=ActivityLogger.CREATE, module=ActivityLogger.MODULE_PECHEUR)
async def create_pecheur_with_photo(
    nom: str = Form(...),
    prenom: str = Form(...),
    numero_carte: str = Form(...),
    date_naissance: str = Form(...),
    telephone: Optional[str] = Form(None),
    adresse: Optional[str] = Form(None),
    categorie: Optional[str] = Form(None),
    nationalite: Optional[str] = Form(None),
    lieu_naissance: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    type_carte: Optional[str] = Form(None),
    numero_piece_identite: Optional[str] = Form(None),
    debarcadere_habituel_code: Optional[str] = Form(None),
    contact_urgence_nom: Optional[str] = Form(None),
    contact_urgence_telephone: Optional[str] = Form(None),
    contact_urgence_relation: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """
    Créer un nouveau pêcheur avec photo (multipart/form-data)
    """
    # Vérifier si le numéro de carte existe déjà
    # existing = db.query(Pecheur).filter(Pecheur.numero_carte == numero_carte).first()
    # if existing:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail=f"Un pêcheur avec le numéro de carte {numero_carte} existe déjà",
    #     )

    existing_numero_piece = (
        db.query(Pecheur)
        .filter(Pecheur.numero_piece_identite == numero_piece_identite)
        .first()
    )
    if existing_numero_piece:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un pêcheur avec le numéro de pièce d'identité {numero_piece_identite} existe déjà",
        )

    # Créer le pêcheur (sans photo d'abord)
    pecheur_data = {
        "nom": nom,
        "prenom": prenom,
        "numero_carte": get_next_reference(db),
        "date_naissance": date.fromisoformat(date_naissance),
        "telephone": telephone,
        "adresse": adresse,
        "categorie": categorie,
        "nationalite": nationalite,
        "lieu_naissance": lieu_naissance,
        "email": email,
        "type_carte": type_carte,
        "numero_piece_identite": numero_piece_identite,
        "debarcadere_habituel_code": debarcadere_habituel_code,
        "contact_urgence_nom": contact_urgence_nom,
        "contact_urgence_telephone": contact_urgence_telephone,
        "contact_urgence_relation": contact_urgence_relation,
    }

    pecheur = Pecheur(**pecheur_data)

    db.add(pecheur)
    db.commit()
    db.refresh(pecheur)

    # Traiter la photo si fournie
    if photo:
        try:
            photo_filename = save_photo(photo, pecheur.id)
            pecheur.photo_url = photo_filename
            db.commit()
            db.refresh(pecheur)
        except Exception as e:
            # Rollback si erreur photo
            db.delete(pecheur)
            db.commit()
            raise e

    # Préparer la réponse
    pecheur_dict = PecheurInDB.from_orm(pecheur).model_dump()
    pecheur_dict["age"] = calculate_age(pecheur.date_naissance)

    return PecheurResponse(**pecheur_dict)


@router.put("/{pecheur_id}/with-photo", response_model=PecheurResponse)
async def update_pecheur_with_photo(
    pecheur_id: int,
    nom: str = Form(...),
    prenom: str = Form(...),
    date_naissance: str = Form(...),
    telephone: Optional[str] = Form(None),
    adresse: Optional[str] = Form(None),
    categorie: Optional[str] = Form(None),
    nationalite: Optional[str] = Form(None),
    lieu_naissance: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    type_carte: Optional[str] = Form(None),
    numero_piece_identite: Optional[str] = Form(None),
    debarcadere_habituel_code: Optional[str] = Form(None),
    contact_urgence_nom: Optional[str] = Form(None),
    contact_urgence_telephone: Optional[str] = Form(None),
    contact_urgence_relation: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    remove_photo: Optional[bool] = Form(False),
    db: Session = Depends(get_db),
):
    """
    Mettre à jour un pêcheur avec photo (multipart/form-data)
    """
    pecheur = db.query(Pecheur).filter(Pecheur.id == pecheur_id).first()

    if not pecheur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pêcheur avec ID {pecheur_id} introuvable",
        )

    # Mettre à jour les champs fournis
    if nom is not None:
        pecheur.nom = nom
    if prenom is not None:
        pecheur.prenom = prenom
    if date_naissance is not None:
        pecheur.date_naissance = date.fromisoformat(date_naissance)
    if telephone is not None:
        pecheur.telephone = telephone
    if adresse is not None:
        pecheur.adresse = adresse
    if categorie is not None:
        pecheur.categorie = categorie
    if nationalite is not None:
        pecheur.nationalite = nationalite
    if lieu_naissance is not None:
        pecheur.lieu_naissance = lieu_naissance
    if email is not None:
        pecheur.email = email
    if type_carte is not None:
        pecheur.type_carte = type_carte
    if numero_piece_identite is not None:
        pecheur.numero_piece_identite = numero_piece_identite
    if debarcadere_habituel_code is not None:
        pecheur.debarcadere_habituel_code = debarcadere_habituel_code
    if contact_urgence_nom is not None:
        pecheur.contact_urgence_nom = contact_urgence_nom
    if contact_urgence_telephone is not None:
        pecheur.contact_urgence_telephone = contact_urgence_telephone
    if contact_urgence_relation is not None:
        pecheur.contact_urgence_relation = contact_urgence_relation

    # Gérer la photo
    old_photo = pecheur.photo_url

    if photo:
        # Supprimer l'ancienne photo
        if old_photo:
            delete_photo(old_photo)

        # Sauvegarder la nouvelle
        photo_filename = save_photo(photo, pecheur.id)
        pecheur.photo_url = photo_filename

    db.commit()
    db.refresh(pecheur)

    # Préparer la réponse
    pecheur_dict = PecheurInDB.from_orm(pecheur).model_dump()
    pecheur_dict["age"] = calculate_age(pecheur.date_naissance)
    # pecheur_dict["licence_active"] = is_licence_active(pecheur.licence_date_expiration)

    return PecheurResponse(**pecheur_dict)


# ========================================
# ENDPOINTS PHOTO
# ========================================


@router.get("/{pecheur_id}/photo")
async def get_pecheur_photo(pecheur_id: int, db: Session = Depends(get_db)):
    """
    Récupérer la photo d'un pêcheur
    """
    pecheur = db.query(Pecheur).filter(Pecheur.id == pecheur_id).first()
    # print(
    #     f"Pecheur ID: {pecheur_id}, Photo URL: {pecheur.photo_url if pecheur else 'N/A'}"
    # )

    if not pecheur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pêcheur introuvable"
        )

    if not pecheur.photo_url:
        # raise HTTPException(
        #     status_code=status.HTTP_404_NOT_FOUND, detail="Ce pêcheur n'a pas de photo"
        # )
        return {"photo_path": ""}

    photo_path = UPLOAD_DIR / pecheur.photo_url

    if not photo_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Fichier photo introuvable"
        )

    return {"photo_path": photo_path}


@router.delete("/{pecheur_id}/photo")
def delete_pecheur_photo(pecheur_id: int, db: Session = Depends(get_db)):
    """
    Supprimer la photo d'un pêcheur
    """
    pecheur = db.query(Pecheur).filter(Pecheur.id == pecheur_id).first()

    if not pecheur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pêcheur introuvable"
        )

    if not pecheur.photo_url:
        return {"message": "Ce pêcheur n'a pas de photo"}

    # Supprimer le fichier
    delete_photo(pecheur.photo_url)

    # Mettre à jour la BDD
    pecheur.photo = None
    db.commit()

    return {"message": "Photo supprimée avec succès"}
