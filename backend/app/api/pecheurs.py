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
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from pathlib import Path
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

router = APIRouter(prefix="/api/pecheurs", tags=["Pêcheurs"])

# Configuration upload
UPLOAD_DIR = Path("uploads/pecheurs")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Taille max photo: 5MB
MAX_PHOTO_SIZE = 5 * 1024 * 1024


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
    limit: int = Query(20, ge=1, le=100),
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

    pecheurs = query.offset(skip).limit(limit).all()

    # Enrichir avec les données calculées
    result = []
    for pecheur in pecheurs:
        pecheur_dict = PecheurInDB.from_orm(pecheur).model_dump()
        pecheur_dict["age"] = calculate_age(pecheur.date_naissance)
        pecheur_dict["licence_active"] = is_licence_active(
            pecheur.licence_date_expiration
        )
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
    pecheur_dict["licence_active"] = is_licence_active(pecheur.licence_date_expiration)

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
    type_peche: Optional[str] = Form(None),
    licence_numero: Optional[str] = Form(None),
    licence_date_delivrance: Optional[str] = Form(None),
    licence_date_expiration: Optional[str] = Form(None),
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
    existing = db.query(Pecheur).filter(Pecheur.numero_carte == numero_carte).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un pêcheur avec le numéro de carte {numero_carte} existe déjà",
        )

    # Créer le pêcheur (sans photo d'abord)
    pecheur_data = {
        "nom": nom,
        "prenom": prenom,
        "numero_carte": numero_carte,
        "date_naissance": date.fromisoformat(date_naissance),
        "telephone": telephone,
        "adresse": adresse,
        "categorie": categorie,
        "type_peche": type_peche,
        "licence_numero": licence_numero,
        "licence_date_delivrance": (
            date.fromisoformat(licence_date_delivrance)
            if licence_date_delivrance
            else None
        ),
        "licence_date_expiration": (
            date.fromisoformat(licence_date_expiration)
            if licence_date_expiration
            else None
        ),
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
    pecheur_dict["licence_active"] = is_licence_active(pecheur.licence_date_expiration)

    return PecheurResponse(**pecheur_dict)


@router.put("/{pecheur_id}/with-photo", response_model=PecheurResponse)
async def update_pecheur_with_photo(
    pecheur_id: int,
    nom: str = Form(...),
    prenom: str = Form(...),
    numero_carte: str = Form(...),
    date_naissance: str = Form(...),
    telephone: Optional[str] = Form(None),
    adresse: Optional[str] = Form(None),
    categorie: Optional[str] = Form(None),
    type_peche: Optional[str] = Form(None),
    licence_numero: Optional[str] = Form(None),
    licence_date_delivrance: Optional[str] = Form(None),
    licence_date_expiration: Optional[str] = Form(None),
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
    if numero_carte is not None:
        pecheur.numero_carte = numero_carte
    if date_naissance is not None:
        pecheur.date_naissance = date.fromisoformat(date_naissance)
    if telephone is not None:
        pecheur.telephone = telephone
    if adresse is not None:
        pecheur.adresse = adresse
    if type_peche is not None:
        pecheur.type_peche = type_peche
    if licence_numero is not None:
        pecheur.licence_numero = licence_numero
    if licence_date_delivrance is not None:
        pecheur.licence_date_delivrance = date.fromisoformat(licence_date_delivrance)
    if licence_date_expiration is not None:
        pecheur.licence_date_expiration = date.fromisoformat(licence_date_expiration)
    if debarcadere_habituel_code is not None:
        pecheur.debarcadere_habituel_code = debarcadere_habituel_code
    if contact_urgence_nom is not None:
        pecheur.contact_urgence_nom = contact_urgence_nom
    if contact_urgence_telephone is not None:
        pecheur.contact_urgence_telephone = contact_urgence_telephone
    if contact_urgence_relation is not None:
        pecheur.contact_urgence_relation = contact_urgence_relation

    # Gérer la photo
    old_photo = pecheur.photo

    if remove_photo and old_photo:
        # Supprimer la photo
        delete_photo(old_photo)
        pecheur.photo = None

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
    pecheur_dict["licence_active"] = is_licence_active(pecheur.licence_date_expiration)

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
