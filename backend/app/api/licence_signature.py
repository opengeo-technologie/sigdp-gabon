import os

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, cast, Integer

from typing import List, Optional
from datetime import date, timedelta
from pathlib import Path
import shutil
import io
import pandas as pd

from app.database import get_db
from app.models.licence import LicenceAutorisationPeche, SignataireLicence
from app.schemas.licence import (
    LicencePecheCreate,
    LicencePecheUpdate,
    LicencePecheResponse,
    LicencePecheSimpleResponse,
    LicencePecheInDB,
    InspectionLicenceCreate,
    InspectionLicenceResponse,
    ViolationLicenceCreate,
    ViolationLicenceUpdate,
    ViolationLicenceResponse,
    RenouvellementLicenceCreate,
    RenouvellementLicenceTraitement,
    RenouvellementLicenceResponse,
    StatistiquesLicences,
    RapportLicence,
)
from app.models.pecheur import Pecheur
from app.models.bateau import Bateau
from app.api.bateaux import get_bateau
from app.models.espece import Espece

router = APIRouter(prefix="/api/licences-signature", tags=["Signataires des licences"])

UPLOAD_DIR = Path("uploads/licences")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Configuration upload
ERRORS_DIR = Path("errors/licences")
ERRORS_DIR.mkdir(parents=True, exist_ok=True)

ERROR_FILE = ERRORS_DIR / "errors.xlsx"


# ==========================================
# CRUD Licences
# ==========================================


@router.post("/signataire-licence")
def set_signataire_licence(
    licence_id: int,
    signataire_id: int,
    data_signature: date,
    remarques: Optional[str] = None,
    db: Session = Depends(get_db),
):
    data = {
        "licence_id": licence_id,
        "signataire_id": signataire_id,
        "date_signature": data_signature,
        "remarques": remarques,
    }
    new_signataire = SignataireLicence(**data)

    db.add(new_signataire)
    db.commit()
    db.refresh(new_signataire)

    return new_signataire
