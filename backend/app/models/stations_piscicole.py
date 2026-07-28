# -*- coding: utf-8 -*-
"""
Modèles SQLAlchemy — Module Stations Piscicoles (SIGDP-GABON)
Conventions : SQLAlchemy synchrone, enums PostgreSQL, champs multi-valeurs
en chaînes séparées par virgules (split/join côté Angular).
"""

import enum
from datetime import datetime, date

from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Date,
    DateTime,
    Text,
    ForeignKey,
    Enum as SAEnum,
)
from sqlalchemy.orm import relationship

from app.database import Base  # à ajuster selon l'arborescence du projet

# ---------------------------------------------------------------------------
# Enums PostgreSQL
# ---------------------------------------------------------------------------


class TypeStationEnum(str, enum.Enum):
    ETANGS = "ETANGS"
    BACS_HORS_SOL = "BACS_HORS_SOL"
    CAGES_FLOTTANTES = "CAGES_FLOTTANTES"
    ECLOSERIE = "ECLOSERIE"
    MIXTE = "MIXTE"


class SourceEauEnum(str, enum.Enum):
    FORAGE = "FORAGE"
    RIVIERE = "RIVIERE"
    LAC = "LAC"
    RESEAU = "RESEAU"
    AUTRE = "AUTRE"


class TypePromoteurEnum(str, enum.Enum):
    PRIVE = "PRIVE"
    COOPERATIVE = "COOPERATIVE"
    ETATIQUE = "ETATIQUE"
    PROJET = "PROJET"


class StatutStationEnum(str, enum.Enum):
    EN_CONSTRUCTION = "EN_CONSTRUCTION"
    ACTIVE = "ACTIVE"
    SUSPENDUE = "SUSPENDUE"
    FERMEE = "FERMEE"


class StatutCycleEnum(str, enum.Enum):
    EN_COURS = "EN_COURS"
    RECOLTE = "RECOLTE"
    ABANDONNE = "ABANDONNE"


# Transitions d'état autorisées pour une station
TRANSITIONS_STATUT_STATION = {
    StatutStationEnum.EN_CONSTRUCTION: [
        StatutStationEnum.ACTIVE,
        StatutStationEnum.FERMEE,
    ],
    StatutStationEnum.ACTIVE: [StatutStationEnum.SUSPENDUE, StatutStationEnum.FERMEE],
    StatutStationEnum.SUSPENDUE: [StatutStationEnum.ACTIVE, StatutStationEnum.FERMEE],
    StatutStationEnum.FERMEE: [],
}


# ---------------------------------------------------------------------------
# Modèles
# ---------------------------------------------------------------------------


class StationPiscicole(Base):
    __tablename__ = "stations_piscicoles"

    id = Column(Integer, primary_key=True, index=True)
    code_station = Column(
        String(30), unique=True, index=True, nullable=False
    )  # SP-2026-0001

    # Identification
    nom = Column(String(200), nullable=False)
    date_creation = Column(Date, nullable=True)

    # Localisation
    province = Column(String(100), nullable=False, index=True)
    departement = Column(String(100), nullable=True)
    localite = Column(String(150), nullable=True)
    adresse = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Caractéristiques techniques
    type_station = Column(
        SAEnum(TypeStationEnum, name="type_station_enum"), nullable=False, index=True
    )
    superficie_totale = Column(Float, nullable=True)  # m²
    nombre_bassins = Column(Integer, nullable=True)
    capacite_production = Column(Float, nullable=True)  # tonnes/an
    source_eau = Column(SAEnum(SourceEauEnum, name="source_eau_enum"), nullable=True)

    # Espèces élevées — chaîne séparée par virgules ("TILAPIA,CLARIAS,CARPE")
    especes_elevees = Column(String(500), nullable=True)

    # Promoteur / responsable
    promoteur_nom = Column(String(200), nullable=False)
    promoteur_contact = Column(String(100), nullable=True)
    promoteur_type = Column(
        SAEnum(TypePromoteurEnum, name="type_promoteur_enum"),
        nullable=False,
        default=TypePromoteurEnum.PRIVE,
    )

    # Statut administratif
    statut = Column(
        SAEnum(StatutStationEnum, name="statut_station_enum"),
        nullable=False,
        default=StatutStationEnum.EN_CONSTRUCTION,
        index=True,
    )

    # Agrément
    numero_agrement = Column(String(50), nullable=True, unique=True)
    date_agrement = Column(Date, nullable=True)
    date_expiration_agrement = Column(Date, nullable=True)

    observations = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # Relations
    cycles = relationship(
        "CycleProduction",
        back_populates="station",
        cascade="all, delete-orphan",
        order_by="desc(CycleProduction.date_empoissonnement)",
    )


class CycleProduction(Base):
    __tablename__ = "cycles_production"

    id = Column(Integer, primary_key=True, index=True)
    code_cycle = Column(
        String(30), unique=True, index=True, nullable=False
    )  # CY-2026-0001

    station_id = Column(
        Integer,
        ForeignKey("stations_piscicoles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    espece = Column(String(100), nullable=False)

    # Empoissonnement
    date_empoissonnement = Column(Date, nullable=False)
    nombre_alevins = Column(Integer, nullable=True)
    origine_alevins = Column(String(200), nullable=True)

    # Récolte
    date_recolte_prevue = Column(Date, nullable=True)
    date_recolte_effective = Column(Date, nullable=True)
    tonnage_recolte = Column(Float, nullable=True)  # tonnes
    taux_mortalite = Column(Float, nullable=True)  # %

    statut_cycle = Column(
        SAEnum(StatutCycleEnum, name="statut_cycle_enum"),
        nullable=False,
        default=StatutCycleEnum.EN_COURS,
        index=True,
    )

    observations = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    station = relationship("StationPiscicole", back_populates="cycles")
