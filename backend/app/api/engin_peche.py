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
from app.models.engin_peche import EnginPeche
from app.schemas.engin_peche import (
    EnginPecheCreate,
    EnginPecheUpdate,
    EnginPecheResponse,
)

router = APIRouter(prefix="/api/engin-peche", tags=["Engins de peche"])


@router.post("/upload-excel")
async def upload_eengin_peche_excel(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """
    Télécharge un fichier Excel contenant les données des engins de peche et les insère dans la base de données.

    Format attendu du fichier Excel:
    - libelle_engin: Libelle de l'engin
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
            "libelle",
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

            engin_data = EnginPecheCreate(
                libelle=row["libelle"],
            )

            engin = EnginPeche(**engin_data.model_dump())
            db.add(engin)
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


@router.get("", response_model=List[EnginPecheResponse])
def get_engins_peche(
    db: Session = Depends(get_db),
):
    """
    Récupérer la liste des engins de pêche
    """
    result = db.query(EnginPeche).all()

    return result


@router.get("/{engin_id}", response_model=EnginPecheResponse)
def get_engin_peche(engin_id: int, db: Session = Depends(get_db)):
    """
    Récupérer un pêcheur par son ID
    """
    engin = db.query(EnginPeche).filter(EnginPeche.id == engin_id).first()

    if not engin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"L'engin de pêche avec ID {engin_id} introuvable",
        )

    return engin


@router.post("", response_model=EnginPecheResponse, status_code=status.HTTP_201_CREATED)
def create_pecheur(engin_data: EnginPecheCreate, db: Session = Depends(get_db)):
    """
    Créer un nouveau pêcheur
    """
    engin = EnginPeche(**engin_data.model_dump())

    db.add(engin)
    db.commit()
    db.refresh(engin)

    return engin
