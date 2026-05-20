import shutil
import time
from pathlib import Path

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
from PIL import Image, ImageDraw, ImageFont
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import io

from app.database import get_db
from app.models.espece import Espece
from app.schemas.espece import EspeceCreate, EspeceUpdate, EspeceResponse, EspeceInDB

router = APIRouter(prefix="/api/especes", tags=["Espèces"])

# Configuration upload
UPLOAD_DIR = Path("uploads/especes")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Taille max photo: 5MB
MAX_PHOTO_SIZE = 5 * 1024 * 1024


def save_photo(photo: UploadFile, espece_id: int) -> str:
    """
    Sauvegarder et traiter la photo de l'espèce

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
    filename = f"espece_{espece_id}_{int(time.time())}.{ext}"
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


@router.get("", response_model=List[EspeceResponse])
def get_especes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    categorie: Optional[str] = None,
    statut_reglementaire: Optional[str] = None,
    actif: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Récupérer la liste des espèces avec filtres optionnels
    """
    query = db.query(Espece)

    if categorie:
        query = query.filter(Espece.categorie == categorie)
    if statut_reglementaire:
        query = query.filter(Espece.statut_reglementaire == statut_reglementaire)
    if actif is not None:
        query = query.filter(Espece.actif == actif)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Espece.nom_commun_francais.ilike(search_term))
            | (Espece.nom_scientifique.ilike(search_term))
            | (Espece.code_espece.ilike(search_term))
        )

    especes = query.offset(skip).limit(limit).all()

    result = []
    for espece in especes:
        espece_dict = EspeceInDB.from_orm(espece).model_dump()
        result.append(EspeceResponse(**espece_dict))

    return result


@router.get("/{espece_id}", response_model=EspeceResponse)
def get_espece(espece_id: int, db: Session = Depends(get_db)):
    """
    Récupérer une espèce par son ID
    """
    espece = db.query(Espece).filter(Espece.id == espece_id).first()

    if not espece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Espèce avec ID {espece_id} introuvable",
        )

    espece_dict = EspeceInDB.from_orm(espece).model_dump()
    return EspeceResponse(**espece_dict)


@router.get("/code/{code_espece}", response_model=EspeceResponse)
def get_espece_by_code(code_espece: str, db: Session = Depends(get_db)):
    """
    Récupérer une espèce par son code
    """
    espece = db.query(Espece).filter(Espece.code_espece == code_espece).first()

    if not espece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Espèce avec code {code_espece} introuvable",
        )

    espece_dict = EspeceInDB.from_orm(espece).model_dump()
    return EspeceResponse(**espece_dict)


@router.post("", response_model=EspeceResponse, status_code=status.HTTP_201_CREATED)
def create_espece(espece_data: EspeceCreate, db: Session = Depends(get_db)):
    """
    Créer une nouvelle espèce
    """
    # Vérifier si le code existe déjà
    existing = (
        db.query(Espece).filter(Espece.code_espece == espece_data.code_espece).first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Une espèce avec le code {espece_data.code_espece} existe déjà",
        )

    espece = Espece(**espece_data.model_dump())

    db.add(espece)
    db.commit()
    db.refresh(espece)

    espece_dict = EspeceInDB.from_orm(espece).model_dump()
    return EspeceResponse(**espece_dict)


@router.put("/{espece_id}", response_model=EspeceResponse)
def update_espece(
    espece_id: int, espece_data: EspeceUpdate, db: Session = Depends(get_db)
):
    """
    Mettre à jour une espèce
    """
    espece = db.query(Espece).filter(Espece.id == espece_id).first()

    if not espece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Espèce avec ID {espece_id} introuvable",
        )

    update_data = espece_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(espece, field, value)

    db.commit()
    db.refresh(espece)

    espece_dict = EspeceInDB.from_orm(espece).model_dump()
    return EspeceResponse(**espece_dict)


@router.delete("/{espece_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_espece(espece_id: int, db: Session = Depends(get_db)):
    """
    Supprimer une espèce
    """
    espece = db.query(Espece).filter(Espece.id == espece_id).first()

    if not espece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Espèce avec ID {espece_id} introuvable",
        )

    db.delete(espece)
    db.commit()

    return None


@router.get("/proteges/list", response_model=List[EspeceResponse])
def get_especes_protegees(db: Session = Depends(get_db)):
    """
    Récupérer toutes les espèces protégées
    """
    especes = db.query(Espece).filter(Espece.statut_reglementaire == "Protégé").all()

    result = []
    for espece in especes:
        espece_dict = EspeceInDB.from_orm(espece).model_dump()
        result.append(EspeceResponse(**espece_dict))

    return result


@router.get("/quotas/list", response_model=List[EspeceResponse])
def get_especes_sous_quota(db: Session = Depends(get_db)):
    """
    Récupérer toutes les espèces sous quota
    """
    especes = db.query(Espece).filter(Espece.statut_reglementaire == "Sous quota").all()

    result = []
    for espece in especes:
        espece_dict = EspeceInDB.from_orm(espece).model_dump()
        result.append(EspeceResponse(**espece_dict))

    return result


@router.post("/{espece_id}/photo")
async def upload_photo(
    espece_id: int, photo: UploadFile = File(...), db: Session = Depends(get_db)
):
    """
    Upload de la photo de l'espèce
    """
    espece = db.query(Espece).filter(Espece.id == espece_id).first()

    if not espece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Espèce avec ID {espece_id} introuvable",
        )

    # Lire et stocker la photo
    photo_data = await photo.read()
    espece.photo = photo_data

    db.commit()

    return {"message": "Photo uploadée avec succès"}


@router.get("/{espece_id}/photo")
def get_photo(espece_id: int, db: Session = Depends(get_db)):
    """
    Récupérer la photo de l'espèce
    """
    espece = db.query(Espece).filter(Espece.id == espece_id).first()

    if not espece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Espèce avec ID {espece_id} introuvable",
        )

    if not espece.photo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune photo disponible pour cette espèce",
        )

    return StreamingResponse(
        io.BytesIO(espece.photo),
        media_type="image/jpeg",
        headers={
            "Content-Disposition": f"inline; filename=espece_{espece.code_espece}.jpg"
        },
    )


@router.post(
    "/with-photo", response_model=EspeceResponse, status_code=status.HTTP_201_CREATED
)
async def create_espece_with_photo(
    code_espece: str = Form(...),
    nom_scientifique: str = Form(...),
    nom_commun_francais: str = Form(...),
    nom_commun_fang: Optional[str] = Form(None),
    nom_commun_myene: Optional[str] = Form(None),
    autres_noms_locaux: Optional[str] = Form(None),
    categorie: str = Form(...),
    famille: Optional[str] = Form(None),
    ordre: Optional[str] = Form(None),
    classe: Optional[str] = Form(None),
    statut_reglementaire: str = Form(...),
    taille_minimale_legale_cm: Optional[float] = Form(None),
    quota_annuel_tonnes: Optional[float] = Form(None),
    quota_mensuel_tonnes: Optional[float] = Form(None),
    quota_hebdomadaire_tonnes: Optional[float] = Form(None),
    saison_peche_debut: Optional[str] = Form(None),
    saison_peche_fin: Optional[str] = Form(None),
    saison_reproduction_debut: Optional[str] = Form(None),
    saison_reproduction_fin: Optional[str] = Form(None),
    prix_reference_kg_min: Optional[float] = Form(None),
    prix_reference_kg_max: Optional[float] = Form(None),
    habitat: Optional[str] = Form(None),
    alimentation: Optional[str] = Form(None),
    taille_maximale_cm: Optional[float] = Form(None),
    poids_maximal_kg: Optional[float] = Form(None),
    esperance_vie_annees: Optional[int] = Form(None),
    photo: Optional[UploadFile] = File(None),
    actif: Optional[bool] = Form(True),
    db: Session = Depends(get_db),
):
    """
    Créer une nouvelle espèce avec une photo optionnelle
    """
    # Vérifier si le code existe déjà
    existing = db.query(Espece).filter(Espece.code_espece == code_espece).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Une espèce avec le code {code_espece} existe déjà",
        )

    espece_data = {
        "code_espece": code_espece,
        "nom_scientifique": nom_scientifique,
        "nom_commun_francais": nom_commun_francais,
        "nom_commun_fang": nom_commun_fang,
        "nom_commun_myene": nom_commun_myene,
        "autres_noms_locaux": autres_noms_locaux,
        "categorie": categorie,
        "famille": famille,
        "ordre": ordre,
        "classe": classe,
        "statut_reglementaire": statut_reglementaire,
        "taille_minimale_legale_cm": taille_minimale_legale_cm,
        "quota_annuel_tonnes": quota_annuel_tonnes,
        "quota_mensuel_tonnes": quota_mensuel_tonnes,
        "quota_hebdomadaire_tonnes": quota_hebdomadaire_tonnes,
        "saison_peche_debut": saison_peche_debut,
        "saison_peche_fin": saison_peche_fin,
        "saison_reproduction_debut": saison_reproduction_debut,
        "saison_reproduction_fin": saison_reproduction_fin,
        "prix_reference_kg_min": prix_reference_kg_min,
        "prix_reference_kg_max": prix_reference_kg_max,
        "habitat": habitat,
        "alimentation": alimentation,
        "taille_maximale_cm": taille_maximale_cm,
        "poids_maximal_kg": poids_maximal_kg,
        "esperance_vie_annees": esperance_vie_annees,
        "actif": actif,
    }

    espece = Espece(**espece_data)

    db.add(espece)
    db.commit()
    db.refresh(espece)

    try:
        # Sauvegarder la photo
        filename = save_photo(photo, espece.id)

        # Mettre à jour l'espèce avec le nom de la photo
        espece.photo_url = filename
        db.commit()
        db.refresh(espece)

    except HTTPException as e:
        # En cas d'erreur, supprimer le bateau créé
        db.delete(espece)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erreur de sauvegarde de photo: {str(e)}",
        )

    espece_dict = EspeceInDB.from_orm(espece).model_dump()
    return EspeceResponse(**espece_dict)


@router.put("/{espece_id}/with-photo", response_model=EspeceResponse)
async def update_espece_with_photo(
    espece_id: int,
    code_espece: Optional[str] = Form(None),
    nom_scientifique: Optional[str] = Form(None),
    nom_commun_francais: Optional[str] = Form(None),
    nom_commun_fang: Optional[str] = Form(None),
    nom_commun_myene: Optional[str] = Form(None),
    autres_noms_locaux: Optional[str] = Form(None),
    categorie: Optional[str] = Form(None),
    famille: Optional[str] = Form(None),
    ordre: Optional[str] = Form(None),
    classe: Optional[str] = Form(None),
    statut_reglementaire: Optional[str] = Form(None),
    taille_minimale_legale_cm: Optional[float] = Form(None),
    quota_annuel_tonnes: Optional[float] = Form(None),
    quota_mensuel_tonnes: Optional[float] = Form(None),
    quota_hebdomadaire_tonnes: Optional[float] = Form(None),
    saison_peche_debut: Optional[str] = Form(None),
    saison_peche_fin: Optional[str] = Form(None),
    saison_reproduction_debut: Optional[str] = Form(None),
    saison_reproduction_fin: Optional[str] = Form(None),
    prix_reference_kg_min: Optional[float] = Form(None),
    prix_reference_kg_max: Optional[float] = Form(None),
    habitat: Optional[str] = Form(None),
    alimentation: Optional[str] = Form(None),
    taille_maximale_cm: Optional[float] = Form(None),
    poids_maximal_kg: Optional[float] = Form(None),
    esperance_vie_annees: Optional[int] = Form(None),
    photo: Optional[UploadFile] = File(None),
    actif: Optional[bool] = Form(True),
    db: Session = Depends(get_db),
):
    """
    Mettre à jour une espèce avec une photo optionnelle
    """
    espece = db.query(Espece).filter(Espece.id == espece_id).first()

    if not espece:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Espèce avec ID {espece_id} introuvable",
        )

    update_data = {
        "code_espece": code_espece,
        "nom_scientifique": nom_scientifique,
        "nom_commun_francais": nom_commun_francais,
        "nom_commun_fang": nom_commun_fang,
        "nom_commun_myene": nom_commun_myene,
        "autres_noms_locaux": autres_noms_locaux,
        "categorie": categorie,
        "famille": famille,
        "ordre": ordre,
        "classe": classe,
        "statut_reglementaire": statut_reglementaire,
        "taille_minimale_legale_cm": taille_minimale_legale_cm,
        "quota_annuel_tonnes": quota_annuel_tonnes,
        "quota_mensuel_tonnes": quota_mensuel_tonnes,
        "quota_hebdomadaire_tonnes": quota_hebdomadaire_tonnes,
        "saison_peche_debut": saison_peche_debut,
        "saison_peche_fin": saison_peche_fin,
        "saison_reproduction_debut": saison_reproduction_debut,
        "saison_reproduction_fin": saison_reproduction_fin,
        "prix_reference_kg_min": prix_reference_kg_min,
        "prix_reference_kg_max": prix_reference_kg_max,
        "habitat": habitat,
        "alimentation": alimentation,
        "taille_maximale_cm": taille_maximale_cm,
        "poids_maximal_kg": poids_maximal_kg,
        "esperance_vie_annees": esperance_vie_annees,
        "actif": actif,
    }

    # Supprimer les champs None pour ne pas écraser les données existantes
    update_data = {k: v for k, v in update_data.items() if v is not None}

    for field, value in update_data.items():
        if value is not None:
            setattr(espece, field, value)

    try:
        if photo:
            # Supprimer l'ancienne photo si elle existe
            delete_photo(espece.photo_url)

            # Sauvegarder la nouvelle photo
            filename = save_photo(photo, espece.id)
            espece.photo_url = filename
    except HTTPException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Erreur de sauvegarde de photo: {str(e)}",
        )

    db.commit()
    db.refresh(espece)
    espece_dict = EspeceInDB.from_orm(espece).model_dump()
    return EspeceResponse(**espece_dict)
