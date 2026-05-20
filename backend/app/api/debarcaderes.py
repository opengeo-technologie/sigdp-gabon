import io
from pathlib import Path
import shutil
import time
from PIL import Image, ImageDraw, ImageFont
import pandas as pd

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
from sqlalchemy.orm import Session
from typing import List, Optional
from geoalchemy2.functions import ST_AsGeoJSON
from geoalchemy2.elements import WKTElement
import json

from app.database import get_db
from app.models.debarcadere import Debarcadere
from app.schemas.debarcadere import (
    DebarcadereCreate,
    DebarcadereUpdate,
    DebarcadereResponse,
    DebarcadereInDB,
)

router = APIRouter(prefix="/api/debarcaderes", tags=["Débarcadères"])

# Configuration upload
UPLOAD_DIR = Path("uploads/debarcaderes")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Taille max photo: 5MB
MAX_PHOTO_SIZE = 5 * 1024 * 1024


def get_next_reference(
    db: Session = Depends(get_db), province: Optional[str] = None
) -> str:
    list_province_with_code_prov = [
        ("ESTUAIRE", "EST"),
        ("HAUT OGOOUE", "HOG"),
        ("MOYEN OGOOUE", "MOG"),
        ("NGOUNIE", "NGO"),
        ("NYANGA", "NYA"),
        ("OGOOUE IVINDO", "OIV"),
        ("OGOOUE LOLO", "OL"),
        ("OGOOUE MARITIME", "OM"),
        ("WOLEU-NTEM", "WN"),
    ]

    # Récupérer la dernière commande de l'année courante
    last_data = (
        db.query(Debarcadere)
        .filter(Debarcadere.province == province)
        .order_by(Debarcadere.id.desc())
        .first()
    )

    current_province_code = None
    if province:
        for prov_name, prov_code in list_province_with_code_prov:
            if prov_name.lower() == province.lower():
                current_province_code = prov_code
                break

    if not last_data:
        # Première commande de l'année
        next_ref = f"GAB-{current_province_code}-DEB-001"
    else:
        parts = last_data.code.split("-")
        if len(parts) == 4 and parts[3].isdigit():
            next_number = int(parts[3]) + 1
            next_ref = f"GAB-{current_province_code}-DEB-{next_number:03d}"
        else:
            # Fallback si le format n’est pas reconnu
            next_ref = f"GAB-{current_province_code}-DEB-001"

    return next_ref


def save_photo(photo: UploadFile, debarcadere_id: int) -> str:
    """
    Sauvegarder et traiter la photo du débarcadère

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
    filename = f"debarcadere_{debarcadere_id}_{int(time.time())}.{ext}"
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


@router.post("/upload-excel")
async def upload_pecheurs_excel(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """
    Télécharge un fichier Excel contenant les données des sites de peche et les insère dans la base de données.

    Format attendu du fichier Excel:
    - nom_local: Nom du site de pêche
    - type: Type de site de pêche
    - milieu: Milieu de pêche
    - latitude: Latitude du site de pêche
    - longitude: Longitude du site de pêche
    - province: Province du site de pêche
    - localite: Localité du site de pêche
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

        # Valider les colonnes requises
        required_columns = {
            "nom_local",
            "type",
            "type_site",
            "latitude",
            "longitude",
            "province",
            "localite",
            "statut",
        }
        if not required_columns.issubset(df.columns):
            raise HTTPException(
                status_code=400,
                detail=f"Le fichier Excel doit contenir les colonnes suivantes: {', '.join(required_columns)}",
            )

        # Nettoyer les données
        df = df.fillna("")  # Remplacer NaN par chaîne vide

        # Statistiques d'import
        total_rows = len(df)
        inserted_count = 0
        updated_count = 0
        errors = []

        # Insérer les données dans la base de données
        for _, row in df.iterrows():
            if row["latitude"] == "" or row["longitude"] == "":
                row["latitude"] = "0"
                row["longitude"] = "0"

            debarcadere_data = DebarcadereCreate(
                code=get_next_reference(db, province=row["province"]),
                denomination=row["nom_local"],
                nom_local=row["nom_local"],
                type=row["type"],
                latitude=row["latitude"],
                longitude=row["longitude"],
                milieu=row["type_site"],
                province=row["province"],
                localite=row["localite"],
                statut_operationnel=row["statut"],
            )
            debarcadere = Debarcadere(**debarcadere_data.model_dump())
            db.add(debarcadere)
            db.commit()

        return {"message": "Fichier Excel traité avec succès"}

    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400, detail="Le fichier Excel est vide ou mal formaté"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erreur lors du traitement du fichier: {str(e)}"
        )


@router.get("", response_model=List[DebarcadereResponse])
def get_debarcaderes(
    skip: int = Query(0, ge=0),
    limit: int = Query(500, ge=1, le=1000),
    province: Optional[str] = None,
    type: Optional[str] = None,
    statut: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Récupérer la liste des débarcadères avec filtres optionnels
    """
    query = db.query(Debarcadere)

    if province:
        query = query.filter(Debarcadere.province == province)
    if type:
        query = query.filter(Debarcadere.type == type)
    if statut:
        query = query.filter(Debarcadere.statut_operationnel == statut)

    debarcaderes = query.offset(skip).limit(limit).all()

    # Ajouter les données GeoJSON
    result = []
    for deb in debarcaderes:
        deb_dict = DebarcadereInDB.from_orm(deb).model_dump()
        deb_dict["geojson"] = {
            "type": "Point",
            "coordinates": [deb.longitude, deb.latitude],
        }
        result.append(DebarcadereResponse(**deb_dict))

    return result


@router.get("/{debarcadere_id}", response_model=DebarcadereResponse)
def get_debarcadere(debarcadere_id: int, db: Session = Depends(get_db)):
    """
    Récupérer un débarcadère par son ID
    """
    debarcadere = db.query(Debarcadere).filter(Debarcadere.id == debarcadere_id).first()

    if not debarcadere:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Débarcadère avec ID {debarcadere_id} introuvable",
        )

    deb_dict = DebarcadereInDB.from_orm(debarcadere).model_dump()
    deb_dict["geojson"] = {
        "type": "Point",
        "coordinates": [debarcadere.longitude, debarcadere.latitude],
    }

    return DebarcadereResponse(**deb_dict)


@router.get("/code/{code}", response_model=DebarcadereResponse)
def get_debarcadere_by_code(code: str, db: Session = Depends(get_db)):
    """
    Récupérer un débarcadère par son code
    """
    debarcadere = db.query(Debarcadere).filter(Debarcadere.code == code).first()

    if not debarcadere:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Débarcadère avec code {code} introuvable",
        )

    deb_dict = DebarcadereInDB.from_orm(debarcadere).model_dump()
    deb_dict["geojson"] = {
        "type": "Point",
        "coordinates": [debarcadere.longitude, debarcadere.latitude],
    }

    return DebarcadereResponse(**deb_dict)


@router.post(
    "", response_model=DebarcadereResponse, status_code=status.HTTP_201_CREATED
)
def create_debarcadere(
    debarcadere_data: DebarcadereCreate, db: Session = Depends(get_db)
):
    """
    Créer un nouveau débarcadère
    """
    # Vérifier si le code existe déjà
    existing = (
        db.query(Debarcadere).filter(Debarcadere.code == debarcadere_data.code).first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un débarcadère avec le code {debarcadere_data.code} existe déjà",
        )

    # Créer le point géométrique
    point_wkt = f"POINT({debarcadere_data.longitude} {debarcadere_data.latitude})"

    debarcadere = Debarcadere(
        **debarcadere_data.model_dump(), geom=WKTElement(point_wkt, srid=4326)
    )

    db.add(debarcadere)
    db.commit()
    db.refresh(debarcadere)

    deb_dict = DebarcadereInDB.from_orm(debarcadere).model_dump()
    deb_dict["geojson"] = {
        "type": "Point",
        "coordinates": [debarcadere.longitude, debarcadere.latitude],
    }

    return DebarcadereResponse(**deb_dict)


@router.put("/{debarcadere_id}", response_model=DebarcadereResponse)
def update_debarcadere(
    debarcadere_id: int,
    debarcadere_data: DebarcadereUpdate,
    db: Session = Depends(get_db),
):
    """
    Mettre à jour un débarcadère
    """
    debarcadere = db.query(Debarcadere).filter(Debarcadere.id == debarcadere_id).first()

    if not debarcadere:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Débarcadère avec ID {debarcadere_id} introuvable",
        )

    update_data = debarcadere_data.model_dump(exclude_unset=True)

    # Si latitude ou longitude mise à jour, recréer le point géométrique
    if "latitude" in update_data or "longitude" in update_data:
        new_lat = update_data.get("latitude", debarcadere.latitude)
        new_lon = update_data.get("longitude", debarcadere.longitude)
        point_wkt = f"POINT({new_lon} {new_lat})"
        update_data["geom"] = WKTElement(point_wkt, srid=4326)

    for field, value in update_data.items():
        setattr(debarcadere, field, value)

    db.commit()
    db.refresh(debarcadere)

    deb_dict = DebarcadereInDB.from_orm(debarcadere).model_dump()
    deb_dict["geojson"] = {
        "type": "Point",
        "coordinates": [debarcadere.longitude, debarcadere.latitude],
    }

    return DebarcadereResponse(**deb_dict)


@router.delete("/{debarcadere_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_debarcadere(debarcadere_id: int, db: Session = Depends(get_db)):
    """
    Supprimer un débarcadère
    """
    debarcadere = db.query(Debarcadere).filter(Debarcadere.id == debarcadere_id).first()

    if not debarcadere:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Débarcadère avec ID {debarcadere_id} introuvable",
        )

    db.delete(debarcadere)
    db.commit()

    return None


@router.get("/geojson/all")
def get_debarcaderes_geojson(db: Session = Depends(get_db)):
    """
    Récupérer tous les débarcadères au format GeoJSON FeatureCollection
    """
    debarcaderes = db.query(Debarcadere).all()

    features = []
    for deb in debarcaderes:
        feature = {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [deb.longitude, deb.latitude]},
            "properties": {
                "id": deb.id,
                "code": deb.code,
                "denomination": deb.denomination,
                "type": deb.type.value,
                "milieu": deb.milieu.value,
                "province": deb.province,
                "statut_operationnel": deb.statut_operationnel.value,
            },
        }
        features.append(feature)

    return {"type": "FeatureCollection", "features": features}


@router.post(
    "/with-photo",
    response_model=DebarcadereResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_debarcadere_with_photo(
    code: str = Form(...),
    denomination: str = Form(...),
    nom_local: Optional[str] = Form(None),
    type: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    milieu: str = Form(...),
    province: str = Form(...),
    departement: Optional[str] = Form(None),
    localite: Optional[str] = Form(None),
    capacite_accueil: Optional[int] = Form(None),
    infrastructure_quai: Optional[bool] = Form(False),
    infrastructure_chambre_froide: Optional[bool] = Form(False),
    infrastructure_glace: Optional[bool] = Form(False),
    infrastructure_marche: Optional[bool] = Form(False),
    infrastructure_carburant: Optional[bool] = Form(False),
    infrastructure_eau: Optional[bool] = Form(False),
    infrastructure_electricite: Optional[bool] = Form(False),
    agent_responsable_nom: Optional[str] = Form(None),
    agent_responsable_matricule: Optional[str] = Form(None),
    agent_responsable_telephone: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    """
    Créer un nouveau débarcadère avec photo (multipart/form-data)
    """
    # Vérifier si le code existe déjà
    existing = db.query(Debarcadere).filter(Debarcadere.code == code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Un débarcadère avec le code {code} existe déjà",
        )

    debarcadere_data = {
        "code": get_next_reference(db, province),
        "denomination": denomination,
        "nom_local": nom_local,
        "type": type,
        "latitude": latitude,
        "longitude": longitude,
        "milieu": milieu,
        "province": province,
        "departement": departement,
        "localite": localite,
        "infrastructure_quai": infrastructure_quai,
        "infrastructure_chambre_froide": infrastructure_chambre_froide,
        "infrastructure_glace": infrastructure_glace,
        "infrastructure_marche": infrastructure_marche,
        "infrastructure_carburant": infrastructure_carburant,
        "infrastructure_eau": infrastructure_eau,
        "infrastructure_electricite": infrastructure_electricite,
        "agent_responsable_nom": agent_responsable_nom,
        "agent_responsable_matricule": agent_responsable_matricule,
        "agent_responsable_telephone": agent_responsable_telephone,
        "capacite_accueil": capacite_accueil,
        "description": description,
    }

    # Créer le point géométrique
    point_wkt = f"POINT({longitude} {latitude})"

    debarcadere = Debarcadere(**debarcadere_data, geom=WKTElement(point_wkt, srid=4326))

    # debarcadere = Debarcadere(**debarcadere_data)
    db.add(debarcadere)
    db.commit()
    db.refresh(debarcadere)

    # Traiter la photo si fournie
    if photo:
        try:
            photo_filename = save_photo(photo, debarcadere.id)
            debarcadere.photo_url = photo_filename
            db.commit()
            db.refresh(debarcadere)
        except Exception as e:
            # Rollback si erreur photo
            db.delete(debarcadere)
            db.commit()
            raise e

    debarcadere_dict = DebarcadereInDB.from_orm(debarcadere).model_dump()
    debarcadere_dict["geojson"] = {
        "type": "Point",
        "coordinates": [longitude, latitude],
    }
    return DebarcadereResponse(**debarcadere_dict)


@router.put("/{debarcadere_id}/with-photo", response_model=DebarcadereResponse)
async def update_debarcadere_with_photo(
    debarcadere_id: int,
    code: Optional[str] = Form(None),
    denomination: Optional[str] = Form(None),
    nom_local: Optional[str] = Form(None),
    type: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    milieu: Optional[str] = Form(None),
    province: Optional[str] = Form(None),
    departement: Optional[str] = Form(None),
    localite: Optional[str] = Form(None),
    infrastructure_quai: Optional[bool] = Form(None),
    infrastructure_chambre_froide: Optional[bool] = Form(None),
    infrastructure_glace: Optional[bool] = Form(None),
    infrastructure_marche: Optional[bool] = Form(None),
    infrastructure_carburant: Optional[bool] = Form(None),
    infrastructure_eau: Optional[bool] = Form(None),
    infrastructure_electricite: Optional[bool] = Form(None),
    agent_responsable_nom: Optional[str] = Form(None),
    agent_responsable_matricule: Optional[str] = Form(None),
    agent_responsable_telephone: Optional[str] = Form(None),
    capacite_accueil: Optional[int] = Form(None),
    description: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
    remove_photo: Optional[bool] = Form(False),
    db: Session = Depends(get_db),
):
    """
    Mettre à jour un débarcadère avec possibilité de changer la photo
    """
    debarcadere = db.query(Debarcadere).filter(Debarcadere.id == debarcadere_id).first()

    if not debarcadere:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Débarcadère avec ID {debarcadere_id} introuvable",
        )

    update_data = {
        "code": code,
        "denomination": denomination,
        "nom_local": nom_local,
        "type": type,
        "latitude": latitude,
        "longitude": longitude,
        "milieu": milieu,
        "province": province,
        "departement": departement,
        "localite": localite,
        "infrastructure_quai": infrastructure_quai,
        "infrastructure_chambre_froide": infrastructure_chambre_froide,
        "infrastructure_glace": infrastructure_glace,
        "infrastructure_marche": infrastructure_marche,
        "infrastructure_carburant": infrastructure_carburant,
        "infrastructure_eau": infrastructure_eau,
        "infrastructure_electricite": infrastructure_electricite,
        "agent_responsable_nom": agent_responsable_nom,
        "agent_responsable_matricule": agent_responsable_matricule,
        "agent_responsable_telephone": agent_responsable_telephone,
        "capacite_accueil": capacite_accueil,
        "description": description,
    }

    # Supprimer les champs None pour ne pas écraser les données existantes
    update_data = {k: v for k, v in update_data.items() if v is not None}

    # Si latitude ou longitude mise à jour, recréer le point géométrique
    if "latitude" in update_data or "longitude" in update_data:
        new_lat = update_data.get("latitude", debarcadere.latitude)
        new_lon = update_data.get("longitude", debarcadere.longitude)
        point_wkt = f"POINT({new_lon} {new_lat})"
        update_data["geom"] = WKTElement(point_wkt, srid=4326)

    for field, value in update_data.items():
        setattr(debarcadere, field, value)

    # Gérer la photo
    if remove_photo and debarcadere.photo_url:
        delete_photo(debarcadere.photo_url)
        debarcadere.photo_url = None  # Supprimer la référence à la photo
    elif photo:
        try:
            # Supprimer l'ancienne photo si elle existe
            if debarcadere.photo_url:
                delete_photo(debarcadere.photo_url)

            # Sauvegarder la nouvelle photo
            photo_filename = save_photo(photo, debarcadere.id)
            debarcadere.photo_url = photo_filename
        except Exception as e:
            raise e  # Ne pas rollback les autres changements si erreur photo

    db.commit()
    db.refresh(debarcadere)

    debarcadere_dict = DebarcadereInDB.from_orm(debarcadere).model_dump()
    debarcadere_dict["geojson"] = {
        "type": "Point",
        "coordinates": [debarcadere.longitude, debarcadere.latitude],
    }
    return DebarcadereResponse(**debarcadere_dict)
