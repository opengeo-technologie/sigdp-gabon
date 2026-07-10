import io
import json
import os
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
import pandas as pd
from sqlalchemy import func, and_
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.models.armement_coorperative import ArmementCooperative
from app.schemas.armement_coorperative import (
    ArmementCooperativeCreate,
    ArmementCooperativeUpdate,
    ArmementCooperativeResponse,
)
from app.models.bateau import Bateau
from app.models.pecheur import Pecheur
from app.api.bateaux import build_bateau_response
from app.models.debarquement import Debarquement, DetailDebarquement

router = APIRouter(
    prefix="/api/armements-cooperatives", tags=["Armements et Cooperatives"]
)

# Configuration upload
ERRORS_DIR = Path("errors/cooperatives")
ERRORS_DIR.mkdir(parents=True, exist_ok=True)

ERROR_FILE = ERRORS_DIR / "errors.xlsx"


def get_next_reference(
    db: Session = Depends(get_db),
    province: Optional[str] = None,
    affiliation_type: Optional[str] = None,
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
        db.query(ArmementCooperative)
        .filter(ArmementCooperative.province == province)
        .filter(ArmementCooperative.type_association == affiliation_type)
        .order_by(ArmementCooperative.id.desc())
        .first()
    )

    current_province_code = None
    type_affiliation = None
    if province:
        for prov_name, prov_code in list_province_with_code_prov:
            if prov_name.lower() == province.lower():
                current_province_code = prov_code
                break

    if affiliation_type == "Armement":
        type_affiliation = "ARM"
    elif affiliation_type == "Cooperative":
        type_affiliation = "COOP"

    if not last_data:
        # Première commande de l'année
        next_ref = f"GAB-{current_province_code}-{type_affiliation}-001"
    else:
        parts = last_data.code.split("-")
        if len(parts) == 4 and parts[3].isdigit():
            next_number = int(parts[3]) + 1
            next_ref = (
                f"GAB-{current_province_code}-{type_affiliation}-{next_number:03d}"
            )
        else:
            # Fallback si le format n’est pas reconnu
            next_ref = f"GAB-{current_province_code}-{type_affiliation}-001"

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


def build_armement_response(
    cooperative: ArmementCooperative, db: Session
) -> ArmementCooperativeResponse:
    nom_titulaire = None
    type_titulaire = None
    bateau_info = {}
    proprietaire_info = {}
    count_bateaux = (
        db.query(
            func.count(Bateau.id).label("nb_bateaux"),
        )
        .filter(Bateau.cooperative_armement_id == cooperative.id)
        .first()
    )

    # print(count_bateaux.nb_bateaux)

    count_pecheurs = (
        db.query(
            func.count(Pecheur.id).label("nb_pecheurs"),
        )
        .filter(Pecheur.cooperative_id == cooperative.id)
        .first()
    )

    # Calculer AVANT model_validate
    cooperative_dict = {
        col.name: getattr(cooperative, col.name)
        for col in cooperative.__table__.columns
    }

    cooperative_dict["count_bateaux"] = count_bateaux.nb_bateaux
    cooperative_dict["count_pecheurs"] = count_pecheurs.nb_pecheurs

    return ArmementCooperativeResponse(**cooperative_dict)


@router.post("/upload-excel")
async def upload_armement_cooperative_excel(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """
    Télécharge un fichier Excel contenant les données des armements et coopératives et les insère dans la base de données.

    Format attendu du fichier Excel:
    - denomination: Dénomination de l'armement ou de la coopérative
    - sigle: Sigle de l'armement ou de la coopérative
    - localite: Localité de l'armement ou de la coopérative
    - province: Province de l'armement ou de la coopérative
    - date_creation: Date de création de l'armement ou de la coopérative
    - siege: Siège de l'armement ou de la coopérative
    - adresse: Adresse de l'armement ou de la coopérative
    - telephone: Numéro de téléphone de l'armement ou de la coopérative
    - email: Adresse email de l'armement ou de la coopérative
    - type: Type de l'armement ou de la coopérative
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
            "denomination",
            "sigle",
            "localite",
            "province",
            "date_creation",
            "siege",
            "adresse",
            "telephone",
            "email",
            "type",
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

            # print(
            #     f"Traitement de l'armement ou de la coopérative: {row['denomination']} - {row['province']}"
            # )
            print(f"Date de création: {row['date_creation']}, Siège: {row['siege']}")
            print(f"Type: {row['type']}, Adresse: {row['adresse']}")

            try:
                # Vérifier si l'armement ou la coopérative existe déjà (par sigle et province)
                existing = (
                    db.query(ArmementCooperative)
                    .filter(
                        func.lower(func.trim(ArmementCooperative.sigle))
                        == str(row["sigle"]).strip().lower(),
                        ArmementCooperative.type_association == row["type"],
                    )
                    .filter(
                        func.lower(func.trim(ArmementCooperative.province))
                        == str(row["province"]).strip().lower()
                    )
                    .first()
                )

                if existing:
                    # Mettre à jour les champs existants
                    existing.denomination = row["denomination"]
                    existing.localite = row["localite"]
                    existing.date_creation = row["date_creation"]
                    existing.siege = row["siege"]
                    existing.adresse = row["adresse"]
                    existing.telephone = row["telephone"]
                    existing.email = row["email"]
                    existing.type_association = row["type"]

                    db.commit()
                    updated_count += 1
                else:
                    # Créer une nouvelle entrée
                    new_entry = ArmementCooperative(
                        denomination=row["denomination"],
                        sigle=row["sigle"],
                        localite=row["localite"],
                        province=row["province"],
                        date_creation=row["date_creation"],
                        siege=row["siege"],
                        adresse=row["adresse"],
                        telephone=row["telephone"],
                        email=row["email"],
                        type_association=row["type"],
                        code=get_next_reference(
                            db,
                            province=row["province"],
                            affiliation_type=row["type"],
                        ),
                    )
                    db.add(new_entry)
                    db.commit()
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
            "inserted": len(df) - len(errors),
            "failed": len(errors),
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


@router.get("/", response_model=List[ArmementCooperativeResponse])
def list_armement_cooperatives(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    province: Optional[str] = None,
    localite: Optional[str] = None,
    type_association: Optional[str] = Query(
        None, description="Filtrer par type (Armement ou Cooperative)"
    ),
):
    query = db.query(ArmementCooperative)
    if type_association:
        query = query.filter(ArmementCooperative.type_association == type_association)
    if province:
        query = query.filter(ArmementCooperative.province == province)
    if localite:
        query = query.filter(ArmementCooperative.localite == localite)
    armement_cooperatives = query.offset(skip).limit(limit).all()

    # Enrichir les réponses
    results = [build_armement_response(c, db) for c in armement_cooperatives]
    return results


@router.get("/{armement_cooperative_id}", response_model=ArmementCooperativeResponse)
def get_armement_cooperative(
    armement_cooperative_id: int, db: Session = Depends(get_db)
):
    armement_cooperative = (
        db.query(ArmementCooperative)
        .filter(ArmementCooperative.id == armement_cooperative_id)
        .first()
    )
    if not armement_cooperative:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Armement ou coopérative non trouvé.",
        )
    return build_armement_response(armement_cooperative, db)


@router.get("/search/filterData", response_model=List[ArmementCooperativeResponse])
def search_armement_cooperatives(
    filterBy: str = Query(..., description="Rechercher par nom ou sigle"),
    db: Session = Depends(get_db),
):
    armement_cooperatives = (
        db.query(ArmementCooperative)
        .filter(
            (ArmementCooperative.denomination.ilike(f"%{filterBy}%"))
            | (ArmementCooperative.sigle.ilike(f"%{filterBy}%"))
        )
        .all()
    )

    # Enrichir les réponses
    results = [build_armement_response(c, db) for c in armement_cooperatives]
    return results


@router.post("/", response_model=ArmementCooperativeResponse)
def create_armement_cooperative(
    armement_cooperative: ArmementCooperativeCreate,
    db: Session = Depends(get_db),
):
    # Vérifier l'unicité du code
    # existing = (
    #     db.query(ArmementCooperative)
    #     .filter(ArmementCooperative.code == armement_cooperative.code)
    #     .first()
    # )
    # if existing:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="Un armement ou coopérative avec ce code existe déjà.",
    #     )

    armement_cooperative.code = get_next_reference(
        db,
        province=armement_cooperative.province,
        affiliation_type=armement_cooperative.type_association,
    )

    db_armement_cooperative = ArmementCooperative(**armement_cooperative.dict())
    db.add(db_armement_cooperative)
    db.commit()
    db.refresh(db_armement_cooperative)
    return db_armement_cooperative


@router.put("/{armement_cooperative_id}", response_model=ArmementCooperativeResponse)
def update_armement_cooperative(
    armement_cooperative_id: int,
    armement_cooperative_update: ArmementCooperativeUpdate,
    db: Session = Depends(get_db),
):
    armement_cooperative = (
        db.query(ArmementCooperative)
        .filter(ArmementCooperative.id == armement_cooperative_id)
        .first()
    )
    if not armement_cooperative:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Armement ou coopérative non trouvé.",
        )

    # Vérifier l'unicité du code si modifié
    if (
        armement_cooperative.code != armement_cooperative_update.code
        and db.query(ArmementCooperative)
        .filter(ArmementCooperative.code == armement_cooperative_update.code)
        .first()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un armement ou coopérative avec ce code existe déjà.",
        )

    for key, value in armement_cooperative_update.dict().items():
        setattr(armement_cooperative, key, value)

    db.commit()
    db.refresh(armement_cooperative)
    return armement_cooperative


@router.delete("/{armement_cooperative_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_armement_cooperative(
    armement_cooperative_id: int, db: Session = Depends(get_db)
):
    armement_cooperative = (
        db.query(ArmementCooperative)
        .filter(ArmementCooperative.id == armement_cooperative_id)
        .first()
    )
    if not armement_cooperative:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Armement ou coopérative non trouvé.",
        )
    db.delete(armement_cooperative)
    db.commit()
    return None


@router.get("/list/localite")
def get_localite_armement_cooperative(db: Session = Depends(get_db)):
    # Récupérer toutes les provinces
    localite_query = (
        db.query(ArmementCooperative.province, ArmementCooperative.localite)
        .filter(ArmementCooperative.localite.isnot(None))
        .distinct()
        .all()
    )

    localite_dict = [
        {"province": l.province, "localite": l.localite} for l in localite_query
    ]

    return localite_dict


@router.get("/bateaux/{armement_cooperative_id}")
def get_bateaux_cooperative(
    armement_cooperative_id: int, db: Session = Depends(get_db)
):
    # Recupérer la liste des bateaux pour une cooperative ou armement
    bateaux = (
        db.query(Bateau)
        .filter(Bateau.cooperative_armement_id == armement_cooperative_id)
        .all()
    )

    # Enrichir avec les données calculées
    result = [build_bateau_response(l, db) for l in bateaux]
    return result


@router.get("/statistiques/{armement_cooperative_id}")
def get_statistiques(armement_cooperative_id: int, db: Session = Depends(get_db)):
    """
    Statistiques d'une cooperative ou d'un armement
    1. Distribution par type d'adhérents (Etrangers, Nationaux)
    2. Quantité de captures réalisées
    """

    # 1. Distribution par type d'adhérents (Etrangers, Nationaux)
    count_nationaux = (
        db.query(
            func.count(Pecheur.id).label("total"),
        )
        .filter(
            and_(
                Pecheur.cooperative_id == armement_cooperative_id,
                Pecheur.nationalite == "Gabonaise",
            )
        )
        .first()
    )

    count_etrangers = (
        db.query(
            func.count(Pecheur.id).label("total"),
        )
        .filter(
            and_(
                Pecheur.cooperative_id == armement_cooperative_id,
                Pecheur.nationalite != "Gabonaise",
            )
        )
        .first()
    )

    repartition_nationaux_etrangers = [
        {"type": "Nationaux", "total": count_nationaux.total},
        {"type": "Etrangers", "total": count_etrangers.total},
    ]

    # 2. Quantité de captures réalisées
    total_debarquement = 0
    total_capture = 0
    embarcations = (
        db.query(
            Bateau.id.label("id_bateau"),
            ArmementCooperative.id.label("id_armement"),
        )
        .select_from(ArmementCooperative)
        .join(Bateau, Bateau.cooperative_armement_id == ArmementCooperative.id)
        .filter(ArmementCooperative.id == armement_cooperative_id)
        .all()
    )

    for embarcation in embarcations:
        resultat = (
            db.query(
                func.count(Debarquement.id).label("nb_debarquements"),
            )
            .select_from(Debarquement)
            .filter(Debarquement.bateau_id == embarcation.id_bateau)
            .first()
        )

        resultat_quantite = (
            db.query(
                func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
            )
            .select_from(Debarquement)
            .join(
                DetailDebarquement,
                DetailDebarquement.debarquement_id == Debarquement.id,
            )
            .filter(Debarquement.bateau_id == embarcation.id_bateau)
            .first()
        )

        if resultat:
            total_debarquement += resultat.nb_debarquements

        if resultat_quantite and resultat_quantite.total_kg:
            total_capture += resultat_quantite.total_kg

    captures = {
        "nb_debarquements": total_debarquement,
        "quantite_kg": round(float(total_capture or 0), 2),
        "quantite_tonnes": round(float(total_capture or 0) / 1000, 3),
    }
    return {"repartition": repartition_nationaux_etrangers, "captures": captures}
