"""
SIGPA — Module « Captures estimées » (module Captures & Débarquements)
Modèles SQLAlchemy (ORM synchrone).

Ce module stocke les statistiques HALIEUTIQUES ESTIMÉES issues de l'extrapolation
du cadre d'échantillonnage (enquêtes-cadres FAO/COPACE) : pour une année et un mois
donnés, ventilées par engin de pêche et par espèce, on conserve la capture estimée
(kg) et sa valeur estimée (f.CFA), ainsi que les agrégats d'effort par engin/mois
(efforts en jours, nombre de débarquements, taux d'échantillonnage) permettant de
calculer la CPUE (kg/jour).

Convention plateforme : ORM synchrone, contraintes d'unicité explicites,
libellés/erreurs en français.
"""

from __future__ import annotations

import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base  # base déclarative partagée de la plateforme


class GroupeEspece(str, enum.Enum):
    """Regroupement biologique utilisé pour la production par groupe d'espèces."""

    PELAGIQUE = "PELAGIQUE"
    DEMERSAL = "DEMERSAL"
    CRUSTACE = "CRUSTACE"


# class EnginPeche(Base):
#     """
#     Engin de pêche (art de pêche) servant de dimension d'analyse.
#     Ex. : Filet maillant de fond, Filet maillant dérivant, Filet mulet, Filet sardine.
#     L'engin conventionnel « TOTAL » (tous engins confondus) est marqué agrege=True.
#     """

#     __tablename__ = "ce_engins_peche"

#     id = Column(Integer, primary_key=True)
#     code = Column(String(30), nullable=False, unique=True, index=True)
#     libelle = Column(String(120), nullable=False)
#     # True pour la ligne de synthèse « tous engins » (bloc TOTAL du tableau source)
#     agrege = Column(Boolean, nullable=False, default=False)
#     actif = Column(Boolean, nullable=False, default=True)

#     captures = relationship("CaptureEstimee", back_populates="engin")
#     efforts = relationship("EffortEstime", back_populates="engin")

#     def __repr__(self) -> str:  # pragma: no cover
#         return f"<EnginPeche {self.code}>"


# class Espece(Base):
#     """
#     Référentiel des espèces (module « Espèces »). Défini ici de façon minimale
#     afin que le module soit autonome ; si un modèle Espece existe déjà dans la
#     plateforme, réutilisez-le et supprimez cette classe (les FK pointent sur
#     `ce_especes.id` — adaptez le nom de table le cas échéant).
#     """

#     __tablename__ = "ce_especes"

#     id = Column(Integer, primary_key=True)
#     code = Column(String(30), nullable=False, unique=True, index=True)
#     nom = Column(String(120), nullable=False, unique=True)
#     groupe = Column(Enum(GroupeEspece), nullable=True)
#     actif = Column(Boolean, nullable=False, default=True)

#     captures = relationship("CaptureEstimee", back_populates="espece")

#     def __repr__(self) -> str:  # pragma: no cover
#         return f"<Espece {self.nom}>"


class CaptureEstimee(Base):
    """
    Fait central : capture estimée pour un quadruplet (année, mois, engin, espèce).
    capture_kg = tonnage estimé (kg) ; valeur_fcfa = valeur estimée (f.CFA).
    Unicité sur (annee, mois, engin_id, espece_id) : un enregistrement par cellule.
    """

    __tablename__ = "ce_captures_estimees"
    __table_args__ = (
        UniqueConstraint(
            "annee",
            "mois",
            "engin_id",
            "espece_id",
            "strate_mineure_id",
            name="uq_ce_capture_annee_mois_engin_espece",
        ),
        CheckConstraint("mois BETWEEN 1 AND 12", name="ck_ce_capture_mois"),
        CheckConstraint("capture_kg >= 0", name="ck_ce_capture_kg_positif"),
        CheckConstraint("valeur_fcfa >= 0", name="ck_ce_capture_valeur_positive"),
    )

    id = Column(Integer, primary_key=True)
    annee = Column(Integer, nullable=False, index=True)
    mois = Column(Integer, nullable=False, index=True)  # 1..12

    engin_id = Column(
        Integer, ForeignKey("engins_peche.id"), nullable=False, index=True
    )
    espece_id = Column(Integer, ForeignKey("especes.id"), nullable=False, index=True)
    strate_mineure_id = Column(
        Integer, ForeignKey("strates_mineures.id"), nullable=False, index=True
    )

    capture_kg = Column(Float, nullable=False, default=0.0)
    valeur_fcfa = Column(Float, nullable=False, default=0.0)

    source = Column(String(120), nullable=True)  # ex. « Import Excel 2024 »
    date_import = Column(DateTime, nullable=False, default=datetime.utcnow)
    date_maj = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    engin = relationship("EnginPeche", back_populates="captures")
    espece = relationship("Espece", back_populates="captures")
    strate_mineure = relationship("StrateMineure", back_populates="captures_estimees")

    @property
    def capture_tonnes(self) -> float:
        return round((self.capture_kg or 0.0) / 1000.0, 6)


class EffortEstime(Base):
    """
    Agrégats d'effort par (année, mois, engin), indépendants de l'espèce.
    Permettent de restituer CPUE = captures totales / efforts, ainsi que le
    taux d'échantillonnage et le nombre de débarquements du tableau source.
    """

    __tablename__ = "ce_efforts_estimes"
    __table_args__ = (
        UniqueConstraint(
            "annee",
            "mois",
            "engin_id",
            "strate_mineure_id",
            name="uq_ce_effort_annee_mois_engin",
        ),
        CheckConstraint("mois BETWEEN 1 AND 12", name="ck_ce_effort_mois"),
    )

    id = Column(Integer, primary_key=True)
    annee = Column(Integer, nullable=False, index=True)
    mois = Column(Integer, nullable=False, index=True)
    engin_id = Column(
        Integer, ForeignKey("engins_peche.id"), nullable=False, index=True
    )

    strate_mineure_id = Column(
        Integer, ForeignKey("strates_mineures.id"), nullable=False, index=True
    )

    efforts_jours = Column(Float, nullable=False, default=0.0)
    nombre_debarquements = Column(Integer, nullable=False, default=0)
    taux_echantillonnage = Column(Float, nullable=True)  # ratio 0..1

    date_import = Column(DateTime, nullable=False, default=datetime.utcnow)
    date_maj = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    engin = relationship("EnginPeche", back_populates="efforts")
    strate_mineure = relationship("StrateMineure", back_populates="efforts")
