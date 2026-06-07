from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import date, timedelta
from pathlib import Path
import shutil
import io
import pandas as pd

from app.database import get_db
from app.models.licence import (
    SignataireLicence,
    RoleSignataire,
    Signataire,
)
from app.schemas.licence import (
    SignataireCreate,
    SignataireResponse,
    SignataireLicenceCreate,
    SignataireLicenceResponse,
    SignataireLicenceDetailResponse,
    RoleSignataireResponse,
    RoleSignataireCreate,
)
from app.models.pecheur import Pecheur

router = APIRouter(prefix="/api/signataires", tags=["Signataires"])

UPLOAD_DIR = Path("uploads/licences")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def build_signataire_response(
    signataire: Signataire, db: Session
) -> SignataireResponse:
    role = (
        db.query(RoleSignataire).filter(RoleSignataire.id == signataire.role_id).first()
    )
    return SignataireResponse(
        id=signataire.id,
        nom_complet=signataire.nom_complet,
        role_id=signataire.role_id,
        organisme=signataire.organisme,
        contact_email=signataire.contact_email,
        contact_telephone=signataire.contact_telephone,
        is_actif=signataire.is_actif,
        role=(
            RoleSignataireResponse(
                id=role.id,
                nom_role=role.nom_role,
                abbreviation=role.abbreviation,
                description=role.description,
            )
            if role
            else None
        ),
    )


@router.post(
    "/", response_model=SignataireResponse, status_code=status.HTTP_201_CREATED
)
def create_signataire(signataire_data: SignataireCreate, db: Session = Depends(get_db)):
    """Créer un nouveau signataire"""
    new_signataire = Signataire(
        nom_complet=signataire_data.nom_complet,
        role_id=signataire_data.role_id,
        organisme=signataire_data.organisme,
        contact_email=signataire_data.contact_email,
        contact_telephone=signataire_data.contact_telephone,
        is_actif=signataire_data.is_actif,
    )
    db.add(new_signataire)
    db.commit()
    db.refresh(new_signataire)
    return build_signataire_response(new_signataire, db)


@router.get("/", response_model=List[SignataireResponse])
def list_signataires(db: Session = Depends(get_db)):
    """Lister tous les signataires actifs"""
    signataires = db.query(Signataire).filter(Signataire.is_actif == True).all()
    results = [build_signataire_response(s, db) for s in signataires]
    return results


@router.get("/{signataire_id}", response_model=SignataireResponse)
def get_signataire(signataire_id: int, db: Session = Depends(get_db)):
    """Obtenir les détails d'un signataire par son ID"""
    signataire = db.query(Signataire).filter(Signataire.id == signataire_id).first()
    if not signataire:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Signataire non trouvé"
        )
    return build_signataire_response(signataire, db)


@router.post(
    "/roles", response_model=RoleSignataireResponse, status_code=status.HTTP_201_CREATED
)
def create_role_signataire(
    role_data: RoleSignataireCreate, db: Session = Depends(get_db)
):
    """Créer un nouveau rôle de signataire"""
    existing_role = (
        db.query(RoleSignataire)
        .filter(
            or_(
                func.lower(RoleSignataire.nom_role) == role_data.nom_role.lower(),
                func.lower(RoleSignataire.abbreviation)
                == role_data.abbreviation.lower(),
            )
        )
        .first()
    )
    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un rôle avec ce nom ou cette abréviation existe déjà",
        )
    new_role = RoleSignataire(
        nom_role=role_data.nom_role,
        abbreviation=role_data.abbreviation,
        description=role_data.description,
    )
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    return new_role
