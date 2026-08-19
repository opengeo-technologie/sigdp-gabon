"""
SIGPA — Module Surveillance : schémas Pydantic v2 des agents / fonctions / organismes.
Messages en français. Réutilise le helper de date du module surveillance.
"""

from __future__ import annotations

import re
from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Réutilise le parseur de dates tolérant du module (AAAA-MM-JJ / JJ/MM/AAAA)
from app.schemas.surveillance import _parse_date  # noqa: F401

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# =========================================================================
#  FONCTION
# =========================================================================
class FonctionCreate(BaseModel):
    libelle: str = Field(..., min_length=2)

    @field_validator("libelle")
    @classmethod
    def _v(cls, v: str):
        if not v or not v.strip():
            raise ValueError("Le libellé de la fonction est obligatoire.")
        return v.strip()


class FonctionUpdate(BaseModel):
    id: int
    libelle: str = Field(..., min_length=2)


class FonctionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    libelle: str
    nb_agents: int = 0


# =========================================================================
#  ORGANISME
# =========================================================================
class OrganismeCreate(BaseModel):
    libelle: str = Field(..., min_length=2)
    abbreviation: Optional[str] = None

    @field_validator("libelle")
    @classmethod
    def _v(cls, v: str):
        if not v or not v.strip():
            raise ValueError("Le libellé de l'organisme est obligatoire.")
        return v.strip()


class OrganismeUpdate(BaseModel):
    id: int
    libelle: Optional[str] = None
    abbreviation: Optional[str] = None


class OrganismeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    libelle: str
    abbreviation: Optional[str]
    nb_agents: int = 0


# =========================================================================
#  AGENT
# =========================================================================
class AgentBase(BaseModel):
    matricule: str = Field(..., min_length=1)
    nom: str = Field(..., min_length=1)
    prenom: str = Field(..., min_length=1)
    date_naissance: Optional[date] = None
    fonction_id: Optional[int] = None
    organisme_id: Optional[int] = None
    contact_email: Optional[str] = None
    contact_telephone: Optional[str] = None

    @field_validator("date_naissance", mode="before")
    @classmethod
    def _date(cls, v):
        return _parse_date(v)

    @field_validator("matricule", "nom", "prenom")
    @classmethod
    def _strip(cls, v: str):
        if not v or not v.strip():
            raise ValueError("Ce champ est obligatoire.")
        return v.strip()

    @field_validator("contact_email")
    @classmethod
    def _email(cls, v):
        if v in (None, "", "null"):
            return None
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("Adresse e-mail invalide.")
        return v


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    id: int
    matricule: Optional[str] = None
    nom: Optional[str] = None
    prenom: Optional[str] = None
    date_naissance: Optional[date] = None
    fonction_id: Optional[int] = None
    organisme_id: Optional[int] = None
    contact_email: Optional[str] = None
    contact_telephone: Optional[str] = None

    @field_validator("date_naissance", mode="before")
    @classmethod
    def _date(cls, v):
        return _parse_date(v)

    @field_validator("contact_email")
    @classmethod
    def _email(cls, v):
        if v in (None, "", "null"):
            return None
        v = v.strip()
        if not _EMAIL_RE.match(v):
            raise ValueError("Adresse e-mail invalide.")
        return v


class AgentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    matricule: str
    nom: str
    prenom: str
    date_naissance: Optional[date]
    fonction_id: Optional[int]
    organisme_id: Optional[int]
    contact_email: Optional[str]
    contact_telephone: Optional[str]
    # Champs enrichis (renseignés par le router)
    nom_complet: Optional[str] = None
    fonction_libelle: Optional[str] = None
    organisme_libelle: Optional[str] = None
    organisme_abbreviation: Optional[str] = None


# =========================================================================
#  Filtres
# =========================================================================
class RefFiltre(BaseModel):
    q: Optional[str] = None
    skip: int = 0
    limit: int = 200


class AgentFiltre(BaseModel):
    q: Optional[str] = None
    fonction_id: Optional[int] = None
    organisme_id: Optional[int] = None
    skip: int = 0
    limit: int = 100
