from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from app.models.debarcadere import DebarcadereType, Milieu, StatutOperationnel


class DebarcadereBase(BaseModel):
    code: str = Field(
        ...,
        min_length=5,
        max_length=50,
        description="Code unique du débarcadère (ex: GA-EST-DEB-001)",
    )
    denomination: str = Field(
        ..., min_length=2, max_length=200, description="Dénomination officielle"
    )
    nom_local: Optional[str] = Field(None, max_length=200)
    type: DebarcadereType
    milieu: Milieu
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    province: str = Field(..., max_length=100)
    departement: Optional[str] = Field(None, max_length=100)
    localite: Optional[str] = Field(None, max_length=100)

    # Infrastructures
    infrastructure_quai: bool = False
    infrastructure_chambre_froide: bool = False
    infrastructure_glace: bool = False
    infrastructure_marche: bool = False
    infrastructure_carburant: bool = False
    infrastructure_eau: bool = False
    infrastructure_electricite: bool = False

    capacite_accueil: Optional[int] = Field(None, ge=0)

    # Agent responsable
    agent_responsable_nom: Optional[str] = Field(None, max_length=200)
    agent_responsable_matricule: Optional[str] = Field(None, max_length=50)
    agent_responsable_telephone: Optional[str] = Field(None, max_length=20)

    statut_operationnel: StatutOperationnel = StatutOperationnel.ACTIF
    description: Optional[str] = None
    photo_url: Optional[str] = None


class DebarcadereCreate(DebarcadereBase):
    pass


class DebarcadereUpdate(BaseModel):
    denomination: Optional[str] = Field(None, min_length=3, max_length=200)
    nom_local: Optional[str] = None
    type: Optional[DebarcadereType] = None
    milieu: Optional[Milieu] = None
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    province: Optional[str] = None
    departement: Optional[str] = None
    localite: Optional[str] = None
    infrastructure_quai: Optional[bool] = None
    infrastructure_chambre_froide: Optional[bool] = None
    infrastructure_glace: Optional[bool] = None
    infrastructure_marche: Optional[bool] = None
    infrastructure_carburant: Optional[bool] = None
    infrastructure_eau: Optional[bool] = None
    infrastructure_electricite: Optional[bool] = None
    capacite_accueil: Optional[int] = None
    agent_responsable_nom: Optional[str] = None
    agent_responsable_matricule: Optional[str] = None
    agent_responsable_telephone: Optional[str] = None
    statut_operationnel: Optional[StatutOperationnel] = None
    description: Optional[str] = None


class DebarcadereInDB(DebarcadereBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DebarcadereResponse(DebarcadereInDB):
    """Response model with GeoJSON point"""

    geojson: Optional[dict] = None
