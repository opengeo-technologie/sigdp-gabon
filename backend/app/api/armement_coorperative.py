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
from app.models.armement_coorperative import ArmementCooperative
from app.schemas.armement_coorperative import (
    ArmementCooperativeCreate,
    ArmementCooperativeUpdate,
    ArmementCooperativeResponse,
)

router = APIRouter(
    prefix="/api/armements-cooperatives", tags=["Armements et Cooperatives"]
)


def get_next_reference(
    db: Session = Depends(get_db),
    province: Optional[str] = None,
    affiliation_type: Optional[str] = None,
) -> str:
    list_province_with_code_prov = [
        ("Estuaire", "EST"),
        ("Haut-Ogooué", "HOG"),
        ("Moyen-Ogooué", "MOG"),
        ("Ngounié", "NGO"),
        ("Nyanga", "NYA"),
        ("Ogooué-Ivindo", "OIV"),
        ("Ogooué-Lolo", "OL"),
        ("Ogooué-Maritime", "OM"),
        ("Woleu-Ntem", "WN"),
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


@router.get("/", response_model=List[ArmementCooperativeResponse])
def list_armement_cooperatives(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    type_association: Optional[str] = Query(
        None, description="Filtrer par type (Armement ou Cooperative)"
    ),
):
    query = db.query(ArmementCooperative)
    if type_association:
        query = query.filter(ArmementCooperative.type_association == type_association)
    armement_cooperatives = query.offset(skip).limit(limit).all()
    return armement_cooperatives


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
    return armement_cooperative


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
    return armement_cooperatives


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
