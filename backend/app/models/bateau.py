from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    Float,
    DateTime,
    Enum,
    Date,
    Text,
    Boolean,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from app.database import Base


class TypeBateau(str, enum.Enum):
    PIROGUE = "Pirogue"
    BALEINIERE = "Baleinière"
    CANOT_MOTORISE = "Canot motorisé"
    FILEYEUR = "Fileyeur"
    CHALUTIER_ARTISANAL = "Chalutier artisanal"


class Propulsion(str, enum.Enum):
    RAME = "À rame"
    VOILE = "Voile"
    MOTEUR_HORS_BORD = "Moteur hors-bord"
    MOTEUR_INBOARD = "Moteur inboard"


class MateriauCoque(str, enum.Enum):
    BOIS = "Bois"
    ALUMINIUM = "Aluminium"
    FIBRE_VERRE = "Fibre de verre"
    ACIER = "Acier"
    PLASTIQUE = "Plastique"


class EnginPeche(str, enum.Enum):
    FILET_MAILLANT = "Filet maillant"
    SENNE = "Senne"
    LIGNE = "Ligne"
    CASIER = "Casier"
    HARPON = "Harpon"
    PALANGRE = "Palangre"


class Bateau(Base):
    __tablename__ = "bateaux"

    id = Column(Integer, primary_key=True, index=True)
    numero_immatriculation = Column(
        String(50), unique=True, nullable=False, index=True
    )  # GA-PCH-2025-0123

    # Caractéristiques du bateau
    nom_bateau = Column(String(100))
    type_bateau = Column(Enum(TypeBateau), nullable=False)
    propulsion = Column(Enum(Propulsion), nullable=False)

    # Dimensions
    longueur_hors_tout = Column(Float)  # en mètres
    largeur = Column(Float)  # en mètres
    tirant_eau = Column(Float)  # en mètres
    jauge_brute = Column(Float)  # en tonneaux

    # Motorisation
    moteur_marque = Column(String(50))
    moteur_puissance_cv = Column(Integer)
    moteur_type_carburant = Column(String(50))
    moteur_numero_serie = Column(String(100))

    # Construction
    materiau_coque = Column(Enum(MateriauCoque), nullable=False)
    annee_construction = Column(Integer)
    chantier_construction = Column(String(100))

    # Engins de pêche embarqués
    engins_peche = Column(String(200))  # Liste séparée par virgules

    # Propriétaire et équipage
    proprietaire_pecheur_id = Column(Integer)  # Référence au pêcheur propriétaire
    proprietaire_nom = Column(String(200))
    nombre_equipage = Column(Integer)

    # Zone de pêche
    zone_peche_habituelle = Column(String(200))
    zone_peche_coordonnees = Column(Text)  # Coordonnées GPS de la zone

    # Certificat de navigabilité
    certificat_navigabilite_numero = Column(String(50))
    certificat_navigabilite_date_delivrance = Column(Date)
    certificat_navigabilite_date_expiration = Column(Date)

    # Équipements de sécurité
    equipement_gilets_sauvetage = Column(Boolean, default=False)
    equipement_extincteur = Column(Boolean, default=False)
    equipement_radio_vhf = Column(Boolean, default=False)
    equipement_gps = Column(Boolean, default=False)
    equipement_balise_detresse = Column(Boolean, default=False)

    # Balise GPS (optionnel pour tracking)
    balise_gps_imei = Column(String(50))
    balise_gps_actif = Column(Boolean, default=False)

    # Cooperative ou armement
    cooperative_armement_id = Column(
        Integer, ForeignKey("armement_cooperatives.id"), nullable=True
    )

    # Photo et biométrie
    photo_url = Column(String(200))  # URL de la photo

    # Statut
    statut = Column(
        String(20), default="Actif"
    )  # Actif, Inactif, En réparation, Retiré

    # Métadonnées
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # RelationShips
    cooperative_armement = relationship("ArmementCooperative", back_populates="bateau")
    equipage = relationship("Equipage", back_populates="bateau")

    def __repr__(self):
        return (
            f"<Bateau {self.numero_immatriculation} - {self.nom_bateau or 'Sans nom'}>"
        )


class Equipage(Base):
    __tablename__ = "equipages"

    id = Column(Integer, primary_key=True, index=True)
    bateau_id = Column(
        Integer, ForeignKey("bateaux.id"), nullable=True
    )  # Référence au bateau
    pecheur_id = Column(
        Integer, ForeignKey("pecheurs.id"), nullable=True
    )  # Référence au pêcheur
    role = Column(String(50))  # Rôle dans l'équipage (ex: Capitaine, Matelot)

    pecheur = relationship("Pecheur", back_populates="equipages")
    bateau = relationship("Bateau", back_populates="equipage")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Equipage Bateau ID: {self.bateau_id}, Pêcheur ID: {self.pecheur_id}, Rôle: {self.role}>"


# class EnginPecheEmbarque(Base):
#     __tablename__ = "engins_peche_embarques"

#     id = Column(Integer, primary_key=True, index=True)
#     bateau_id = Column(Integer, ForeignKey("bateaux.id"), nullable=False)
#     type_engin = Column(Enum(EnginPeche), nullable=False)
#     quantite = Column(Integer, default=1)

#     bateau = relationship("Bateau", back_populates="engins_peche")

#     created_at = Column(DateTime(timezone=True), server_default=func.now())
#     updated_at = Column(DateTime(timezone=True), onupdate=func.now())

#     def __repr__(self):
#         return f"<EnginPecheEmbarque Bateau ID: {self.bateau_id}, Type: {self.type_engin}, Quantité: {self.quantite}>"
