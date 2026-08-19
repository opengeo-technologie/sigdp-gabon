"""
Schémas Pydantic v2 — module Strates majeures & mineures (SIGPA).
Validation et messages en français.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.strates import StrateMajeure, StrateMineure


# --------------------------------------------------------------------------- #
#  Entrées génériques (endpoints POST-only)
# --------------------------------------------------------------------------- #
class IdIn(BaseModel):
    """Corps minimal pour les endpoints /detail et /supprimer."""

    id: int = Field(..., ge=1, description="Identifiant de l'enregistrement")


# --------------------------------------------------------------------------- #
#  Strate majeure
# --------------------------------------------------------------------------- #
class StrateMajeureBase(BaseModel):
    libelle: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None

    @field_validator("libelle")
    @classmethod
    def _libelle_non_vide(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Le libellé de la strate majeure est obligatoire.")
        return v


class StrateMajeureCreate(StrateMajeureBase):
    pass


class StrateMajeureUpdate(BaseModel):
    """Mise à jour partielle : tous les champs optionnels."""

    libelle: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = None

    @field_validator("libelle")
    @classmethod
    def _libelle_non_vide(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Le libellé ne peut pas être vide.")
        return v


class StrateMajeureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    libelle: str
    description: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


# --------------------------------------------------------------------------- #
#  Strate mineure
# --------------------------------------------------------------------------- #
class StrateMineureBase(BaseModel):
    libelle: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    strate_majeure_id: int = Field(..., ge=1)

    @field_validator("libelle")
    @classmethod
    def _libelle_non_vide(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Le libellé de la strate mineure est obligatoire.")
        return v


class StrateMineureCreate(StrateMineureBase):
    pass


class StrateMineureUpdate(BaseModel):
    libelle: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = None
    strate_majeure_id: Optional[int] = Field(None, ge=1)

    @field_validator("libelle")
    @classmethod
    def _libelle_non_vide(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        if not v:
            raise ValueError("Le libellé ne peut pas être vide.")
        return v


class StrateMineureRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    libelle: str
    description: Optional[str]
    strate_majeure_id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]


# --------------------------------------------------------------------------- #
#  Filtres et vues arborescentes
# --------------------------------------------------------------------------- #
class StrateMajeureFiltre(BaseModel):
    recherche: Optional[str] = Field(
        None, description="Recherche libre sur code / libellé"
    )


class StrateMineureFiltre(BaseModel):
    strate_majeure_id: Optional[int] = Field(None, ge=1)
    recherche: Optional[str] = None


class StrateMajeureArbre(StrateMajeureRead):
    """Strate majeure avec ses mineures imbriquées (vue enquête-cadre)."""

    strates_mineures: List[StrateMineureRead] = []
