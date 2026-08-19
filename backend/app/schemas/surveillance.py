"""
SIGPA — Module Surveillance : schémas Pydantic v2.
Messages de validation en français. Champs multivalués (agents) exposés en liste
et convertis en chaîne CSV côté router (split/join), conformément au projet.
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Gravite = Literal["mineure", "majeure", "critique"]


# =========================================================================
#  Helpers
# =========================================================================
def _parse_date(v):
    """Accepte 'AAAA-MM-JJ', 'JJ/MM/AAAA' ou un objet date déjà typé."""
    if v in (None, "", "null"):
        return None
    if isinstance(v, (date, datetime)):
        return v
    if isinstance(v, str):
        v = v.strip()
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
            try:
                d = datetime.strptime(v, fmt)
                return d.date() if fmt in ("%Y-%m-%d", "%d/%m/%Y") else d
            except ValueError:
                continue
    raise ValueError("Format de date invalide. Utilisez AAAA-MM-JJ ou JJ/MM/AAAA.")


class IdIn(BaseModel):
    id: int


class StatutIn(BaseModel):
    id: int
    statut: str


# =========================================================================
#  OPÉRATION
# =========================================================================
class OperationCreate(BaseModel):
    mission_id: int
    date_operation: date
    lieu_operation: Optional[str] = None
    type_operation: Optional[str] = None  # inspection, contrôle, patrouille…
    resultat: Optional[str] = None  # conforme, non conforme…
    remarques: Optional[str] = None

    @field_validator("date_operation", mode="before")
    @classmethod
    def _d(cls, v):
        return _parse_date(v)


class OperationUpdate(BaseModel):
    id: int
    date_operation: Optional[date] = None
    lieu_operation: Optional[str] = None
    type_operation: Optional[str] = None
    resultat: Optional[str] = None
    remarques: Optional[str] = None

    @field_validator("date_operation", mode="before")
    @classmethod
    def _d(cls, v):
        return _parse_date(v)


class OperationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    mission_id: int
    date_operation: date
    lieu_operation: Optional[str]
    type_operation: Optional[str]
    resultat: Optional[str]
    remarques: Optional[str]
    nb_infractions: int = 0


# =========================================================================
#  INFRACTION (relevée)
# =========================================================================
class InfractionCreate(BaseModel):
    operation_id: int
    date_infraction: date
    infraction_id: int = Field(
        ..., description="Type d'infraction (FK catalogue `infractions`)"
    )
    bateau_id: Optional[int] = None
    description_infraction: Optional[str] = None
    gravite_infraction: Optional[Gravite] = None
    sanction_proposee: Optional[str] = None

    @field_validator("date_infraction", mode="before")
    @classmethod
    def _d(cls, v):
        return _parse_date(v)


class InfractionUpdate(BaseModel):
    id: int
    date_infraction: Optional[date] = None
    infraction_id: Optional[int] = None
    bateau_id: Optional[int] = None
    description_infraction: Optional[str] = None
    gravite_infraction: Optional[Gravite] = None
    sanction_proposee: Optional[str] = None

    @field_validator("date_infraction", mode="before")
    @classmethod
    def _d(cls, v):
        return _parse_date(v)


class InfractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    operation_id: int
    date_infraction: date
    infraction_id: int
    bateau_id: Optional[int]
    description_infraction: Optional[str]
    gravite_infraction: Optional[str]
    sanction_proposee: Optional[str]
    nb_saisies: int = 0


# =========================================================================
#  SAISIE
# =========================================================================
class SaisieCreate(BaseModel):
    infraction_id: int = Field(..., description="FK vers infractions_surveillance.id")
    date_saisie: date
    agent_id: Optional[int] = None
    remarques: Optional[str] = None

    @field_validator("date_saisie", mode="before")
    @classmethod
    def _d(cls, v):
        return _parse_date(v)


class SaisieUpdate(BaseModel):
    id: int
    date_saisie: Optional[date] = None
    agent_id: Optional[int] = None
    remarques: Optional[str] = None

    @field_validator("date_saisie", mode="before")
    @classmethod
    def _d(cls, v):
        return _parse_date(v)


class SaisieOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    infraction_id: int
    date_saisie: date
    agent_id: Optional[int]
    remarques: Optional[str]
    # Enrichissement agent (renseigné par le router)
    agent_matricule: Optional[str] = None
    agent_nom_complet: Optional[str] = None


# =========================================================================
#  Détail opération
# =========================================================================
class OperationDetailOut(OperationOut):
    infractions: List[InfractionOut] = Field(default_factory=list)
