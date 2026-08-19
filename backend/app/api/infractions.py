import io
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
import pandas as pd
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from datetime import date

from app.database import get_db
from app.models.surveillance import Infraction
from app.schemas.infraction import (
    InfractionCreate,
    InfractionUpdate,
    InfractionResponse,
)

router = APIRouter(prefix="/api/infractions", tags=["Infractions"])


@router.get("", response_model=List[InfractionResponse])
def get_infractions(
    db: Session = Depends(get_db),
):
    """
    Récupérer la liste des infractions
    """
    result = db.query(Infraction).all()

    return result


@router.get("/{infraction_id}", response_model=InfractionResponse)
def get_infraction(infraction_id: int, db: Session = Depends(get_db)):
    """
    Récupérer une infraction par son ID
    """
    infraction = db.query(Infraction).filter(Infraction.id == infraction_id).first()

    if not infraction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"L'infraction avec ID {infraction_id} introuvable",
        )

    return infraction


@router.post("", response_model=InfractionResponse, status_code=status.HTTP_201_CREATED)
def create_infraction(infraction_data: InfractionCreate, db: Session = Depends(get_db)):
    """
    Créer une nouvelle infraction
    """
    infraction = Infraction(**infraction_data.model_dump())

    db.add(infraction)
    db.commit()
    db.refresh(infraction)

    return infraction


@router.put("/{infraction_id}", response_model=InfractionResponse)
def update_infraction(
    infraction_id: int,
    infraction_update: InfractionUpdate,
    db: Session = Depends(get_db),
):
    infraction = db.query(Infraction).filter(Infraction.id == infraction_id).first()
    if not infraction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aucune infraction trouvé.",
        )

    for key, value in infraction_update.dict().items():
        setattr(infraction, key, value)

    db.commit()
    db.refresh(infraction)
    return infraction


@router.delete("/{infraction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_infraction(infraction_id: int, db: Session = Depends(get_db)):
    infraction = db.query(Infraction).filter(Infraction.id == infraction_id).first()
    if not infraction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Armement ou coopérative non trouvé.",
        )
    db.delete(infraction)
    db.commit()
    return None
