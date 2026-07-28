# -*- coding: utf-8 -*-
"""
Schémas Pydantic v2 — Module Stations Piscicoles (SIGDP-GABON)
Endpoints POST-only : les filtres/identifiants passent dans le body JSON.
"""

from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, Field, ConfigDict

from app.models.stations_piscicole import (  # à ajuster selon l'arborescence
    TypeStationEnum,
    SourceEauEnum,
    TypePromoteurEnum,
    StatutStationEnum,
    StatutCycleEnum,
)

# ---------------------------------------------------------------------------
# Cycles de production
# ---------------------------------------------------------------------------


class CycleProductionBase(BaseModel):
    espece: str = Field(..., max_length=100)
    date_empoissonnement: date
    nombre_alevins: Optional[int] = Field(None, ge=0)
    origine_alevins: Optional[str] = Field(None, max_length=200)
    date_recolte_prevue: Optional[date] = None
    observations: Optional[str] = None


class CycleProductionCreate(CycleProductionBase):
    station_id: int


class CycleProductionUpdate(BaseModel):
    id: int
    espece: Optional[str] = Field(None, max_length=100)
    date_empoissonnement: Optional[date] = None
    nombre_alevins: Optional[int] = Field(None, ge=0)
    origine_alevins: Optional[str] = Field(None, max_length=200)
    date_recolte_prevue: Optional[date] = None
    observations: Optional[str] = None


class CycleRecolteRequest(BaseModel):
    """Clôture d'un cycle : passage EN_COURS -> RECOLTE."""

    id: int
    date_recolte_effective: date
    tonnage_recolte: float = Field(..., ge=0)
    taux_mortalite: Optional[float] = Field(None, ge=0, le=100)
    observations: Optional[str] = None


class CycleProductionRead(CycleProductionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code_cycle: str
    station_id: int
    date_recolte_effective: Optional[date] = None
    tonnage_recolte: Optional[float] = None
    taux_mortalite: Optional[float] = None
    statut_cycle: StatutCycleEnum
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Stations piscicoles
# ---------------------------------------------------------------------------


class StationPiscicoleBase(BaseModel):
    nom: str = Field(..., max_length=200)
    date_creation: Optional[date] = None

    province: str = Field(..., max_length=100)
    departement: Optional[str] = Field(None, max_length=100)
    localite: Optional[str] = Field(None, max_length=150)
    adresse: Optional[str] = Field(None, max_length=255)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)

    type_station: TypeStationEnum
    superficie_totale: Optional[float] = Field(None, ge=0)
    nombre_bassins: Optional[int] = Field(None, ge=0)
    capacite_production: Optional[float] = Field(None, ge=0)
    source_eau: Optional[SourceEauEnum] = None

    # Chaîne séparée par virgules, ex. "TILAPIA,CLARIAS"
    especes_elevees: Optional[str] = Field(None, max_length=500)

    promoteur_nom: str = Field(..., max_length=200)
    promoteur_contact: Optional[str] = Field(None, max_length=100)
    promoteur_type: TypePromoteurEnum = TypePromoteurEnum.PRIVE

    numero_agrement: Optional[str] = Field(None, max_length=50)
    date_agrement: Optional[date] = None
    date_expiration_agrement: Optional[date] = None

    observations: Optional[str] = None


class StationPiscicoleCreate(StationPiscicoleBase):
    pass


class StationPiscicoleUpdate(BaseModel):
    id: int
    nom: Optional[str] = Field(None, max_length=200)
    date_creation: Optional[date] = None
    province: Optional[str] = Field(None, max_length=100)
    departement: Optional[str] = Field(None, max_length=100)
    localite: Optional[str] = Field(None, max_length=150)
    adresse: Optional[str] = Field(None, max_length=255)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    type_station: Optional[TypeStationEnum] = None
    superficie_totale: Optional[float] = Field(None, ge=0)
    nombre_bassins: Optional[int] = Field(None, ge=0)
    capacite_production: Optional[float] = Field(None, ge=0)
    source_eau: Optional[SourceEauEnum] = None
    especes_elevees: Optional[str] = Field(None, max_length=500)
    promoteur_nom: Optional[str] = Field(None, max_length=200)
    promoteur_contact: Optional[str] = Field(None, max_length=100)
    promoteur_type: Optional[TypePromoteurEnum] = None
    numero_agrement: Optional[str] = Field(None, max_length=50)
    date_agrement: Optional[date] = None
    date_expiration_agrement: Optional[date] = None
    observations: Optional[str] = None


class StationPiscicoleRead(StationPiscicoleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code_station: str
    statut: StatutStationEnum
    created_at: datetime
    updated_at: datetime


class StationPiscicoleDetail(StationPiscicoleRead):
    cycles: List[CycleProductionRead] = []


# ---------------------------------------------------------------------------
# Requêtes POST-only (filtres, identifiants, actions)
# ---------------------------------------------------------------------------


class IdRequest(BaseModel):
    id: int


class StationListRequest(BaseModel):
    """Filtres + pagination pour /list."""

    search: Optional[str] = None  # nom, code, promoteur, localité
    province: Optional[str] = None
    type_station: Optional[TypeStationEnum] = None
    statut: Optional[StatutStationEnum] = None
    espece: Optional[str] = None  # filtre LIKE sur especes_elevees
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class StationListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[StationPiscicoleRead]


class ChangerStatutRequest(BaseModel):
    id: int
    nouveau_statut: StatutStationEnum
    motif: Optional[str] = None


class CycleListRequest(BaseModel):
    station_id: Optional[int] = None
    statut_cycle: Optional[StatutCycleEnum] = None
    espece: Optional[str] = None
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)


class CycleListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[CycleProductionRead]


class MessageResponse(BaseModel):
    success: bool
    message: str
