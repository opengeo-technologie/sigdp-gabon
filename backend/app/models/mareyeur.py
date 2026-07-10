# app/models/mareyeur.py
# Module Mareyeurs - SIGDP-GABON
# Modèles SQLAlchemy 2 (async) — adapter l'import de Base selon votre projet

from datetime import datetime, date
from typing import Optional, List

from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Date,
    DateTime,
    ForeignKey,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Mareyeur(Base):
    """Mareyeur (personne physique ou morale) exerçant l'achat/revente
    de produits halieutiques."""

    __tablename__ = "mareyeurs"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), unique=True, index=True)  # MAR-2026-0001

    type_personne = Column(String(20), default="physique")  # physique | morale
    nom = Column(String(120), nullable=True)
    prenom = Column(String(120), nullable=True)
    raison_sociale = Column(String(200), nullable=True)
    sexe = Column(String(10), nullable=True)
    date_naissance = Column(Date, nullable=True)
    lieu_naissance = Column(String(150), nullable=True)
    nationalite = Column(String(80), nullable=True)

    nif = Column(String(50), nullable=True)
    rccm = Column(String(50), nullable=True)

    telephone = Column(String(50), nullable=True)
    email = Column(String(120), nullable=True)
    adresse = Column(String(255), nullable=True)
    photo = Column(String(255), nullable=True)  # chemin/URL

    # Champs multiples stockés en chaîne séparée par des virgules
    # (pattern SIGDP : split(',') au chargement, join(', ') à l'enregistrement)
    zones_activite = Column(Text, nullable=True)
    sites_debarquement = Column(Text, nullable=True)

    statut = Column(String(20), default="actif")  # actif | suspendu | radie
    observations = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    agrements = relationship(
        "AgrementMareyage",
        back_populates="mareyeur",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    installations = relationship(
        "InstallationMareyage",
        back_populates="mareyeur",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    transactions = relationship(
        "TransactionAchat",
        back_populates="mareyeur",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class AgrementMareyage(Base):
    """Agrément de mareyage.
    Cycle de vie : en_instruction -> delivre -> expire | suspendu | retire
    (expiration automatique lorsque date_expiration < aujourd'hui)."""

    __tablename__ = "agrements_mareyage"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), unique=True, index=True)  # AGR-MAR-2026-0001

    mareyeur_id = Column(
        Integer, ForeignKey("mareyeurs.id", ondelete="CASCADE"), index=True
    )

    categorie = Column(String(50), default="mareyeur_simple")
    # mareyeur_simple | mareyeur_exportateur

    date_demande = Column(Date, nullable=True)
    date_delivrance = Column(Date, nullable=True)
    duree_validite_mois = Column(Integer, default=12)
    date_expiration = Column(Date, nullable=True)

    montant_redevance = Column(Float, nullable=True)  # FCFA

    statut = Column(String(20), default="en_instruction", index=True)
    motif_statut = Column(Text, nullable=True)  # suspension/retrait

    # Chaîne de renouvellement (agrément précédent)
    renouvele_de_id = Column(
        ForeignKey("agrements_mareyage.id", ondelete="SET NULL"), nullable=True
    )

    observations = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    mareyeur = relationship("Mareyeur", back_populates="agrements", lazy="selectin")


class InstallationMareyage(Base):
    """Installations et équipements du mareyeur (chambre froide,
    véhicule frigorifique, entrepôt, étal...)."""

    __tablename__ = "installations_mareyage"

    id = Column(Integer, primary_key=True, index=True)

    mareyeur_id = Column(
        Integer, ForeignKey("mareyeurs.id", ondelete="CASCADE"), index=True
    )

    type_installation = Column(String(50))
    # chambre_froide | vehicule_frigorifique | entrepot | etal | autre
    designation = Column(String(150))
    capacite_tonnes = Column(Float, nullable=True)
    immatriculation = Column(String(50), nullable=True)  # véhicules
    adresse = Column(String(255), nullable=True)

    # Coordonnées pour affichage Leaflet (attention aux 0,0 -> laisser NULL si inconnu)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    statut = Column(String(30), default="fonctionnelle")
    # fonctionnelle | hors_service
    observations = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    mareyeur = relationship("Mareyeur", back_populates="installations", lazy="selectin")


class TransactionAchat(Base):
    """Registre d'achats (traçabilité) : une ligne par espèce achetée."""

    __tablename__ = "transactions_achat_mareyage"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(30), unique=True, index=True)  # TRX-MAR-2026-0001

    mareyeur_id = Column(
        Integer, ForeignKey("mareyeurs.id", ondelete="CASCADE"), index=True
    )

    date_transaction = Column(Date, index=True)
    site_debarquement = Column(String(150), nullable=True)
    pecheur = Column(String(150), nullable=True)
    pirogue = Column(String(100), nullable=True)

    espece = Column(String(120), index=True)
    quantite_kg = Column(Float, default=0)
    prix_unitaire_fcfa = Column(Float, nullable=True)
    montant_total_fcfa = Column(Float, nullable=True)

    observations = Column(Text, nullable=True)

    created_at = Column(DateTime, server_default=func.now())

    mareyeur = relationship("Mareyeur", back_populates="transactions", lazy="selectin")
