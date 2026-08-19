"""
SIGPA — Module Surveillance : schémas Pydantic v2 (missions / équipes / rapports).
Messages en français. Réutilise le parseur de date tolérant du module.
"""

from __future__ import annotations

from datetime import date
from typing import Optional, List, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.surveillance import _parse_date  # AAAA-MM-JJ / JJ/MM/AAAA

TypeMission = Literal["terrain", "bureau", "aleatoire"]


# =========================================================================
#  MISSION
# =========================================================================
class MissionBase(BaseModel):
    date_depart: date
    date_retour: Optional[date] = None
    lieu_mission: Optional[str] = None
    type_mission: Optional[TypeMission] = None
    moyen_controle: Optional[str] = None
    rapport_scan: Optional[str] = None

    @field_validator("date_depart", "date_retour", mode="before")
    @classmethod
    def _dates(cls, v):
        return _parse_date(v)

    @model_validator(mode="after")
    def _coherence(self):
        if (
            self.date_retour
            and self.date_depart
            and self.date_retour < self.date_depart
        ):
            raise ValueError(
                "La date de retour ne peut pas précéder la date de départ."
            )
        return self


class MissionCreate(MissionBase):
    pass


class MissionUpdate(BaseModel):
    id: int
    date_depart: Optional[date] = None
    date_retour: Optional[date] = None
    lieu_mission: Optional[str] = None
    type_mission: Optional[TypeMission] = None
    moyen_controle: Optional[str] = None
    rapport_scan: Optional[str] = None

    @field_validator("date_depart", "date_retour", mode="before")
    @classmethod
    def _dates(cls, v):
        return _parse_date(v)


class MissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    date_depart: date
    date_retour: Optional[date]
    lieu_mission: Optional[str]
    type_mission: Optional[str]
    moyen_controle: Optional[str]
    rapport_scan: Optional[str]
    nb_membres: int = 0
    nb_rapports: int = 0


# =========================================================================
#  ÉQUIPE (membre de mission)
# =========================================================================
class EquipeCreate(BaseModel):
    mission_id: int
    agent_id: int
    role_agent: Optional[str] = None


class EquipeBulkCreate(BaseModel):
    """Ajout de plusieurs agents à une mission en une fois."""

    mission_id: int
    agent_ids: List[int] = Field(..., min_length=1)
    role_agent: Optional[str] = None


class EquipeUpdate(BaseModel):
    id: int
    role_agent: Optional[str] = None


class EquipeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    mission_id: int
    agent_id: int
    role_agent: Optional[str]
    # Enrichissement agent (renseigné par le router)
    matricule: Optional[str] = None
    nom_complet: Optional[str] = None
    fonction_libelle: Optional[str] = None
    organisme_abbreviation: Optional[str] = None


# =========================================================================
#  RAPPORT
# =========================================================================
class RapportCreate(BaseModel):
    mission_id: int
    date_rapport: date
    contenu_rapport: Optional[str] = None

    @field_validator("date_rapport", mode="before")
    @classmethod
    def _d(cls, v):
        return _parse_date(v)


class RapportUpdate(BaseModel):
    id: int
    date_rapport: Optional[date] = None
    contenu_rapport: Optional[str] = None

    @field_validator("date_rapport", mode="before")
    @classmethod
    def _d(cls, v):
        return _parse_date(v)


class RapportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    mission_id: int
    date_rapport: date
    contenu_rapport: Optional[str]


# =========================================================================
#  Détail mission (dossier complet)
# =========================================================================
class MissionDetailOut(MissionOut):
    membres: List[EquipeOut] = Field(default_factory=list)
    rapports: List[RapportOut] = Field(default_factory=list)


# =========================================================================
#  Filtre
# =========================================================================
class MissionFiltre(BaseModel):
    q: Optional[str] = None  # recherche lieu / moyen
    type_mission: Optional[TypeMission] = None
    date_debut: Optional[date] = None  # borne sur date_depart
    date_fin: Optional[date] = None
    skip: int = 0
    limit: int = 100

    @field_validator("date_debut", "date_fin", mode="before")
    @classmethod
    def _dates(cls, v):
        return _parse_date(v)
