import json
from pathlib import Path
import shutil
import time
from PIL import Image, ImageDraw, ImageFont

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
    Query,
)
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.models.bateau import Bateau, Equipage
from app.models.pecheur import Pecheur
from app.schemas.bateau import (
    BateauCreate,
    BateauUpdate,
    BateauResponse,
    BateauDetailResponse,
    BateauInDB,
    EquipageCreate,
)

router = APIRouter(prefix="/api/bateaux", tags=["Bateaux"])

# Configuration upload
UPLOAD_DIR = Path("uploads/bateaux")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Taille max photo: 5MB
MAX_PHOTO_SIZE = 5 * 1024 * 1024


def save_photo(photo: UploadFile, bateau_id: int) -> str:
    """
    Sauvegarder et traiter la photo du bateau

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
    filename = f"bateau_{bateau_id}_{int(time.time())}.{ext}"
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


def is_certificat_valide(date_expiration: Optional[date]) -> bool:
    """Vérifier si le certificat de navigabilité est encore valide"""
    if not date_expiration:
        return False
    return date_expiration >= date.today()


@router.get("", response_model=List[BateauResponse])
def get_bateaux(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    type_bateau: Optional[str] = None,
    statut: Optional[str] = None,
    proprietaire_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Récupérer la liste des bateaux avec filtres optionnels
    """
    query = db.query(Bateau)

    if type_bateau:
        query = query.filter(Bateau.type_bateau == type_bateau)
    if statut:
        query = query.filter(Bateau.statut == statut)
    if proprietaire_id:
        query = query.filter(Bateau.proprietaire_pecheur_id == proprietaire_id)

    bateaux = query.offset(skip).limit(limit).all()

    # Enrichir avec les données calculées
    result = []
    for bateau in bateaux:
        bateau_dict = BateauInDB.from_orm(bateau).model_dump()
        bateau_dict["certificat_valide"] = is_certificat_valide(
            bateau.certificat_navigabilite_date_expiration
        )

        # Ajouter les infos du propriétaire si disponible
        if bateau.proprietaire_pecheur_id:
            proprietaire = (
                db.query(Pecheur)
                .filter(Pecheur.id == bateau.proprietaire_pecheur_id)
                .first()
            )
            if proprietaire:
                bateau_dict["proprietaire_info"] = {
                    "id": proprietaire.id,
                    "nom": proprietaire.nom,
                    "prenom": proprietaire.prenom,
                    "numero_carte": proprietaire.numero_carte,
                }

        result.append(BateauResponse(**bateau_dict))

    return result


@router.get("/{bateau_id}", response_model=BateauDetailResponse)
def get_bateau(bateau_id: int, db: Session = Depends(get_db)):
    """
    Récupérer un bateau par son ID
    """
    bateau = (
        db.query(Bateau)
        .options(selectinload(Bateau.equipage).selectinload(Equipage.pecheur))
        .filter(Bateau.id == bateau_id)
        .first()
    )

    if not bateau:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bateau avec ID {bateau_id} introuvable",
        )

    bateau_dict = BateauInDB.from_orm(bateau).model_dump()
    bateau_dict["certificat_valide"] = is_certificat_valide(
        bateau.certificat_navigabilite_date_expiration
    )

    # Ajouter les infos du propriétaire
    if bateau.proprietaire_pecheur_id:
        proprietaire = (
            db.query(Pecheur)
            .filter(Pecheur.id == bateau.proprietaire_pecheur_id)
            .first()
        )
        if proprietaire:
            bateau_dict["proprietaire_info"] = {
                "id": proprietaire.id,
                "nom": proprietaire.nom,
                "prenom": proprietaire.prenom,
                "numero_carte": proprietaire.numero_carte,
                "telephone": proprietaire.telephone,
            }

    return BateauResponse(**bateau_dict)


@router.get("/immatriculation/{numero}", response_model=BateauResponse)
def get_bateau_by_immatriculation(numero: str, db: Session = Depends(get_db)):
    """
    Récupérer un bateau par son numéro d'immatriculation
    """
    bateau = db.query(Bateau).filter(Bateau.numero_immatriculation == numero).first()

    if not bateau:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bateau avec immatriculation {numero} introuvable",
        )

    bateau_dict = BateauInDB.from_orm(bateau).model_dump()
    bateau_dict["certificat_valide"] = is_certificat_valide(
        bateau.certificat_navigabilite_date_expiration
    )

    if bateau.proprietaire_pecheur_id:
        proprietaire = (
            db.query(Pecheur)
            .filter(Pecheur.id == bateau.proprietaire_pecheur_id)
            .first()
        )
        if proprietaire:
            bateau_dict["proprietaire_info"] = {
                "id": proprietaire.id,
                "nom": proprietaire.nom,
                "prenom": proprietaire.prenom,
                "numero_carte": proprietaire.numero_carte,
            }

    return BateauResponse(**bateau_dict)


@router.post("", response_model=BateauResponse, status_code=status.HTTP_201_CREATED)
def create_bateau(bateau_data: BateauCreate, db: Session = Depends(get_db)):
    """
    Créer un nouveau bateau
    """
    # Vérifier si le numéro d'immatriculation existe déjà
    existing = (
        db.query(Bateau)
        .filter(Bateau.numero_immatriculation == bateau_data.numero_immatriculation)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un bateau avec l'immatriculation {bateau_data.numero_immatriculation} existe déjà",
        )

    # Vérifier que le propriétaire existe si fourni
    if bateau_data.proprietaire_pecheur_id:
        proprietaire = (
            db.query(Pecheur)
            .filter(Pecheur.id == bateau_data.proprietaire_pecheur_id)
            .first()
        )
        if not proprietaire:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pêcheur avec ID {bateau_data.proprietaire_pecheur_id} introuvable",
            )

    bateau = Bateau(**bateau_data.model_dump())

    db.add(bateau)
    db.commit()
    db.refresh(bateau)

    bateau_dict = BateauInDB.from_orm(bateau).model_dump()
    bateau_dict["certificat_valide"] = is_certificat_valide(
        bateau.certificat_navigabilite_date_expiration
    )

    return BateauResponse(**bateau_dict)


@router.put("/{bateau_id}", response_model=BateauResponse)
def update_bateau(
    bateau_id: int, bateau_data: BateauUpdate, db: Session = Depends(get_db)
):
    """
    Mettre à jour un bateau
    """
    bateau = db.query(Bateau).filter(Bateau.id == bateau_id).first()

    if not bateau:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bateau avec ID {bateau_id} introuvable",
        )

    update_data = bateau_data.model_dump(exclude_unset=True)

    # Vérifier que le propriétaire existe si modifié
    if (
        "proprietaire_pecheur_id" in update_data
        and update_data["proprietaire_pecheur_id"]
    ):
        proprietaire = (
            db.query(Pecheur)
            .filter(Pecheur.id == update_data["proprietaire_pecheur_id"])
            .first()
        )
        if not proprietaire:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pêcheur avec ID {update_data['proprietaire_pecheur_id']} introuvable",
            )

    for field, value in update_data.items():
        setattr(bateau, field, value)

    db.commit()
    db.refresh(bateau)

    bateau_dict = BateauInDB.from_orm(bateau).model_dump()
    bateau_dict["certificat_valide"] = is_certificat_valide(
        bateau.certificat_navigabilite_date_expiration
    )

    if bateau.proprietaire_pecheur_id:
        proprietaire = (
            db.query(Pecheur)
            .filter(Pecheur.id == bateau.proprietaire_pecheur_id)
            .first()
        )
        if proprietaire:
            bateau_dict["proprietaire_info"] = {
                "id": proprietaire.id,
                "nom": proprietaire.nom,
                "prenom": proprietaire.prenom,
                "numero_carte": proprietaire.numero_carte,
            }

    return BateauResponse(**bateau_dict)


@router.delete("/{bateau_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bateau(bateau_id: int, db: Session = Depends(get_db)):
    """
    Supprimer un bateau
    """
    bateau = db.query(Bateau).filter(Bateau.id == bateau_id).first()

    if not bateau:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bateau avec ID {bateau_id} introuvable",
        )

    db.delete(bateau)
    db.commit()

    return None


@router.get("/{bateau_id}/proprietaire", response_model=dict)
def get_bateau_proprietaire(bateau_id: int, db: Session = Depends(get_db)):
    """
    Récupérer les informations du propriétaire du bateau
    """
    bateau = db.query(Bateau).filter(Bateau.id == bateau_id).first()

    if not bateau:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bateau avec ID {bateau_id} introuvable",
        )

    if not bateau.proprietaire_pecheur_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucun propriétaire enregistré pour ce bateau",
        )

    proprietaire = (
        db.query(Pecheur).filter(Pecheur.id == bateau.proprietaire_pecheur_id).first()
    )

    if not proprietaire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Propriétaire introuvable"
        )

    return {
        "id": proprietaire.id,
        "numero_carte": proprietaire.numero_carte,
        "nom": proprietaire.nom,
        "prenom": proprietaire.prenom,
        "telephone": proprietaire.telephone,
        "email": proprietaire.email,
        "categorie": proprietaire.categorie.value,
        "type_peche": proprietaire.type_peche.value,
    }


@router.get("/proprietaire/{pecheur_id}/bateaux", response_model=List[BateauResponse])
def get_bateaux_by_proprietaire(pecheur_id: int, db: Session = Depends(get_db)):
    """
    Récupérer tous les bateaux d'un propriétaire
    """
    # Vérifier que le pêcheur existe
    pecheur = db.query(Pecheur).filter(Pecheur.id == pecheur_id).first()
    if not pecheur:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Pêcheur avec ID {pecheur_id} introuvable",
        )

    bateaux = (
        db.query(Bateau).filter(Bateau.proprietaire_pecheur_id == pecheur_id).all()
    )

    result = []
    for bateau in bateaux:
        bateau_dict = BateauInDB.from_orm(bateau).model_dump()
        bateau_dict["certificat_valide"] = is_certificat_valide(
            bateau.certificat_navigabilite_date_expiration
        )
        bateau_dict["proprietaire_info"] = {
            "id": pecheur.id,
            "nom": pecheur.nom,
            "prenom": pecheur.prenom,
            "numero_carte": pecheur.numero_carte,
        }
        result.append(BateauResponse(**bateau_dict))

    return result


@router.post(
    "/with-photo", response_model=BateauResponse, status_code=status.HTTP_201_CREATED
)
def create_bateau_with_photo(
    numero_immatriculation: Optional[str] = Form(None),
    nom_bateau: Optional[str] = Form(None),
    type_bateau: Optional[str] = Form(None),
    propulsion: Optional[str] = Form(None),
    longueur_hors_tout: Optional[float] = Form(None),
    largeur: Optional[float] = Form(None),
    tirant_eau: Optional[float] = Form(None),
    jauge_brute: Optional[float] = Form(None),
    moteur_marque: Optional[str] = Form(None),
    moteur_puissance_cv: Optional[int] = Form(None),
    moteur_type_carburant: Optional[str] = Form(None),
    moteur_numero_serie: Optional[str] = Form(None),
    materiau_coque: Optional[str] = Form(None),
    annee_construction: Optional[int] = Form(None),
    chantier_construction: Optional[str] = Form(None),
    engins_peche: Optional[str] = Form(None),
    proprietaire_pecheur_id: Optional[int] = Form(None),
    proprietaire_nom: Optional[str] = Form(None),
    nombre_equipage: Optional[int] = Form(None),
    zone_peche_habituelle: Optional[str] = Form(None),
    zone_peche_coordonnees: Optional[str] = Form(None),
    certificat_navigabilite_numero: Optional[str] = Form(None),
    certificat_navigabilite_date_delivrance: Optional[str] = Form(None),
    certificat_navigabilite_date_expiration: Optional[str] = Form(None),
    equipement_gilets_sauvetage: Optional[bool] = Form(False),
    equipement_extincteur: Optional[bool] = Form(False),
    equipement_radio_vhf: Optional[bool] = Form(False),
    equipement_gps: Optional[bool] = Form(False),
    equipement_balise_detresse: Optional[bool] = Form(False),
    balise_gps_imei: Optional[str] = Form(None),
    balise_gps_actif: Optional[bool] = Form(False),
    statut: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    equipage: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Créer un bateau avec une photo
    """

    # Vérifier si l'immatriculation existe déjà
    existing = (
        db.query(Bateau)
        .filter(Bateau.numero_immatriculation == numero_immatriculation)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un bateau avec l'immatriculation {numero_immatriculation} existe déjà",
        )

    # Vérifier que le propriétaire existe si fourni
    if proprietaire_pecheur_id:
        proprietaire = (
            db.query(Pecheur).filter(Pecheur.id == proprietaire_pecheur_id).first()
        )
        if not proprietaire:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Pêcheur avec ID {proprietaire_pecheur_id} introuvable",
            )

    # ✅ Parser l'équipage JSON
    equipage_list = []
    if equipage is not None:
        try:
            equipage_list = json.loads(equipage)
            print(f"Équipage reçu: {equipage_list}")
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Équipage JSON invalide: {str(e)}",
            )

    # Valider nombre équipage
    if len(equipage_list) != nombre_equipage and equipage is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nombre d'équipage ({nombre_equipage}) ne correspond pas aux membres fournis ({len(equipage_list)})",
        )

    bateau_data = {
        "numero_immatriculation": numero_immatriculation,
        "nom_bateau": nom_bateau,
        "type_bateau": type_bateau,
        "propulsion": propulsion,
        "longueur_hors_tout": longueur_hors_tout,
        "largeur": largeur,
        "tirant_eau": tirant_eau,
        "jauge_brute": jauge_brute,
        "moteur_marque": moteur_marque,
        "moteur_puissance_cv": moteur_puissance_cv,
        "moteur_type_carburant": moteur_type_carburant,
        "moteur_numero_serie": moteur_numero_serie,
        "materiau_coque": materiau_coque,
        "annee_construction": annee_construction,
        "chantier_construction": chantier_construction,
        "engins_peche": engins_peche,
        "proprietaire_pecheur_id": proprietaire_pecheur_id,
        "proprietaire_nom": proprietaire_nom,
        "nombre_equipage": nombre_equipage,
        "zone_peche_habituelle": zone_peche_habituelle,
        "zone_peche_coordonnees": zone_peche_coordonnees,
        "certificat_navigabilite_numero": certificat_navigabilite_numero,
        "certificat_navigabilite_date_delivrance": certificat_navigabilite_date_delivrance,
        "certificat_navigabilite_date_expiration": certificat_navigabilite_date_expiration,
        "equipement_gilets_sauvetage": equipement_gilets_sauvetage,
        "equipement_extincteur": equipement_extincteur,
        "equipement_radio_vhf": equipement_radio_vhf,
        "equipement_gps": equipement_gps,
        "equipement_balise_detresse": equipement_balise_detresse,
        "balise_gps_imei": balise_gps_imei,
        "balise_gps_actif": balise_gps_actif,
        "statut": statut,
    }

    # Créer le bateau sans la photo d'abord
    bateau = Bateau(**bateau_data)
    db.add(bateau)
    db.commit()
    db.refresh(bateau)

    if photo:
        try:
            # Sauvegarder la photo
            filename = save_photo(photo, bateau.id)

            # Mettre à jour le bateau avec le nom de la photo
            bateau.photo_url = filename
            db.commit()
            db.refresh(bateau)

        except HTTPException as e:
            # En cas d'erreur, supprimer le bateau créé
            db.delete(bateau)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Erreur de sauvegarde de photo: {str(e)}",
            )

    if equipage is not None:
        try:
            # Supprimer l'équipage existant
            db.query(Equipage).filter(Equipage.bateau_id == bateau.id).delete()
            db.commit()

            # Ajouter le nouvel équipage
            addEquipage(bateau.id, len(equipage_list), equipage_list, db)
        except Exception as e:
            # En cas d'erreur, supprimer le bateau créé
            db.delete(bateau)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Erreur de validation de l'équipage: {str(e)}",
            )

    bateau_dict = BateauInDB.from_orm(bateau).model_dump()
    bateau_dict["certificat_valide"] = is_certificat_valide(
        bateau.certificat_navigabilite_date_expiration
    )

    # Ajouter les infos du propriétaire
    if bateau.proprietaire_pecheur_id:
        proprietaire = (
            db.query(Pecheur)
            .filter(Pecheur.id == bateau.proprietaire_pecheur_id)
            .first()
        )
        if proprietaire:
            bateau_dict["proprietaire_info"] = {
                "id": proprietaire.id,
                "nom": proprietaire.nom,
                "prenom": proprietaire.prenom,
                "numero_carte": proprietaire.numero_carte,
            }

    return BateauResponse(**bateau_dict)


@router.put("/{bateau_id}/with-photo")
def update_bateau_with_photo(
    bateau_id: int,
    numero_immatriculation: Optional[str] = Form(None),
    nom_bateau: Optional[str] = Form(None),
    type_bateau: Optional[str] = Form(None),
    propulsion: Optional[str] = Form(None),
    longueur_hors_tout: Optional[float] = Form(None),
    largeur: Optional[float] = Form(None),
    tirant_eau: Optional[float] = Form(None),
    jauge_brute: Optional[float] = Form(None),
    moteur_marque: Optional[str] = Form(None),
    moteur_puissance_cv: Optional[int] = Form(None),
    moteur_type_carburant: Optional[str] = Form(None),
    moteur_numero_serie: Optional[str] = Form(None),
    materiau_coque: Optional[str] = Form(None),
    annee_construction: Optional[int] = Form(None),
    chantier_construction: Optional[str] = Form(None),
    engins_peche: Optional[str] = Form(None),
    proprietaire_pecheur_id: Optional[int] = Form(None),
    proprietaire_nom: Optional[str] = Form(None),
    nombre_equipage: Optional[int] = Form(None),
    zone_peche_habituelle: Optional[str] = Form(None),
    zone_peche_coordonnees: Optional[str] = Form(None),
    certificat_navigabilite_numero: Optional[str] = Form(None),
    certificat_navigabilite_date_delivrance: Optional[str] = Form(None),
    certificat_navigabilite_date_expiration: Optional[str] = Form(None),
    equipement_gilets_sauvetage: Optional[bool] = Form(False),
    equipement_extincteur: Optional[bool] = Form(False),
    equipement_radio_vhf: Optional[bool] = Form(False),
    equipement_gps: Optional[bool] = Form(False),
    equipement_balise_detresse: Optional[bool] = Form(False),
    balise_gps_imei: Optional[str] = Form(None),
    balise_gps_actif: Optional[bool] = Form(False),
    statut: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    remove_photo: Optional[bool] = Form(False),
    equipage: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """
    Mettre à jour la photo d'un bateau
    """
    bateau = db.query(Bateau).filter(Bateau.id == bateau_id).first()

    if not bateau:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bateau avec ID {bateau_id} introuvable",
        )

    update_data = {
        "numero_immatriculation": numero_immatriculation,
        "nom_bateau": nom_bateau,
        "type_bateau": type_bateau,
        "propulsion": propulsion,
        "longueur_hors_tout": longueur_hors_tout,
        "largeur": largeur,
        "tirant_eau": tirant_eau,
        "jauge_brute": jauge_brute,
        "moteur_marque": moteur_marque,
        "moteur_puissance_cv": moteur_puissance_cv,
        "moteur_type_carburant": moteur_type_carburant,
        "moteur_numero_serie": moteur_numero_serie,
        "materiau_coque": materiau_coque,
        "annee_construction": annee_construction,
        "chantier_construction": chantier_construction,
        "engins_peche": engins_peche,
        "proprietaire_pecheur_id": proprietaire_pecheur_id,
        "proprietaire_nom": proprietaire_nom,
        "nombre_equipage": nombre_equipage,
        "zone_peche_habituelle": zone_peche_habituelle,
        "zone_peche_coordonnees": zone_peche_coordonnees,
        "certificat_navigabilite_numero": (
            certificat_navigabilite_numero
            if certificat_navigabilite_numero != "null"
            else None
        ),
        "certificat_navigabilite_date_delivrance": (
            certificat_navigabilite_date_delivrance
            if certificat_navigabilite_date_delivrance != "null"
            else None
        ),
        "certificat_navigabilite_date_expiration": (
            certificat_navigabilite_date_expiration
            if certificat_navigabilite_date_expiration != "null"
            else None
        ),
        "equipement_gilets_sauvetage": equipement_gilets_sauvetage,
        "equipement_extincteur": equipement_extincteur,
        "equipement_radio_vhf": equipement_radio_vhf,
        "equipement_gps": equipement_gps,
        "equipement_balise_detresse": equipement_balise_detresse,
        "balise_gps_imei": balise_gps_imei,
        "balise_gps_actif": balise_gps_actif,
        "statut": statut,
    }

    # Supprimer les champs None pour ne pas écraser les données existantes
    update_data = {k: v for k, v in update_data.items() if v is not None}

    for field, value in update_data.items():
        setattr(bateau, field, value)

    # Gérer la photo
    if remove_photo and bateau.photo_url:
        # Supprimer l'ancienne photo si elle existe
        delete_photo(bateau.photo_url)
        bateau.photo_url = None  # Supprimer la référence à la photo
    elif photo:
        try:
            # Sauvegarder la nouvelle photo
            filename = save_photo(photo, bateau.id)

            # Mettre à jour le bateau avec le nouveau nom de photo
            bateau.photo_url = filename

        except HTTPException as e:
            raise e  # Ne pas rollback les autres changements si erreur photo

    # ✅ Parser l'équipage JSON
    equipage_list = []
    if equipage is not None:
        try:
            equipage_list = json.loads(equipage)
            print(f"Équipage reçu: {equipage_list}")
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Équipage JSON invalide: {str(e)}",
            )

    # Valider nombre équipage
    if len(equipage_list) != nombre_equipage and equipage is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Nombre d'équipage ({nombre_equipage}) ne correspond pas aux membres fournis ({len(equipage_list)})",
        )

    db.commit()
    db.refresh(bateau)

    bateau_dict = BateauInDB.from_orm(bateau).model_dump()
    bateau_dict["certificat_valide"] = is_certificat_valide(
        bateau.certificat_navigabilite_date_expiration
    )

    # Ajouter les infos du propriétaire
    if bateau.proprietaire_pecheur_id:
        proprietaire = (
            db.query(Pecheur)
            .filter(Pecheur.id == bateau.proprietaire_pecheur_id)
            .first()
        )
        if proprietaire:
            bateau_dict["proprietaire_info"] = {
                "id": proprietaire.id,
                "nom": proprietaire.nom,
                "prenom": proprietaire.prenom,
                "numero_carte": proprietaire.numero_carte,
            }

    if equipage is not None:
        # Supprimer l'équipage existant
        db.query(Equipage).filter(Equipage.bateau_id == bateau_id).delete()
        db.commit()

        # Ajouter le nouvel équipage
        addEquipage(bateau_id, len(equipage_list), equipage_list, db)

    return BateauResponse(**bateau_dict)


def addEquipage(
    bateau_id: int,
    nombre_equipage: int,
    liste_equipage: list,
    db: Session = Depends(get_db),
):
    """
    Ajouter des membres d'équipage à un bateau
    """
    bateau = db.query(Bateau).filter(Bateau.id == bateau_id).first()

    if not bateau:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bateau avec ID {bateau_id} introuvable",
        )

    if nombre_equipage < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nombre d'équipage à ajouter doit être positif",
        )

    bateau.nombre_equipage += nombre_equipage
    db.commit()
    db.refresh(bateau)

    for membre in liste_equipage:
        equipage = Equipage(
            bateau_id=bateau_id,
            pecheur_id=membre.get("pecheur_id"),
            role=membre.get("role"),
        )
        db.add(equipage)
        db.commit()

    return {"id": bateau.id, "nombre_equipage": bateau.nombre_equipage}
