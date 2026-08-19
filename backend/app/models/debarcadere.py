from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Enum,
    Text,
)
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
import enum
from app.database import Base


class DebarcadereType(str, enum.Enum):
    OFFICIEL = "Officiel"
    INFORMEL = "Informel"
    SAISONNIER = "Saisonnier"
    CAPA = "Centre d'Appui à la Pêche Artisanale"


class Milieu(str, enum.Enum):
    MARITIME = "Maritime"
    CONTINENTAL = "Continental"
    LAGUNAIRE = "Lagunaire"
    HAUTURIERE = "Hauturière"


class StatutOperationnel(str, enum.Enum):
    ACTIF = "Actif"
    INACTIF = "Inactif"
    EN_TRAVAUX = "En travaux"


class Debarcadere(Base):
    __tablename__ = "debarcaderes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # GA-EST-DEB-001
    denomination = Column(String(200), nullable=False)
    nom_local = Column(String(200))
    type = Column(Enum(DebarcadereType), nullable=False)
    milieu = Column(Enum(Milieu), nullable=False)

    # Géolocalisation (PostGIS)
    geom = Column(Geometry("POINT", srid=4326), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    est_localise = Column(
        Boolean, default=False
    )  # Indique si la géolocalisation est confirmée

    # Localisation administrative
    province = Column(String(100), nullable=False)
    departement = Column(String(100))
    localite = Column(String(100))

    # Photo et biométrie
    photo_url = Column(String(200))  # URL de la photo

    # Infrastructures
    infrastructure_quai = Column(Boolean, default=False)
    infrastructure_chambre_froide = Column(Boolean, default=False)
    infrastructure_glace = Column(Boolean, default=False)
    infrastructure_marche = Column(Boolean, default=False)
    infrastructure_carburant = Column(Boolean, default=False)
    infrastructure_eau = Column(Boolean, default=False)
    infrastructure_electricite = Column(Boolean, default=False)

    # Capacité
    capacite_accueil = Column(Integer)  # Nombre max de bateaux simultanés

    # Agent responsable
    agent_responsable_nom = Column(String(200))
    agent_responsable_matricule = Column(String(50))
    agent_responsable_telephone = Column(String(20))

    # Statut
    statut_operationnel = Column(
        Enum(StatutOperationnel), nullable=False, default=StatutOperationnel.ACTIF
    )

    strate_majeure_id = Column(
        Integer,
        ForeignKey("strates_majeures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    strate_mineure_id = Column(
        Integer,
        ForeignKey("strates_mineures.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Métadonnées
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Bidirectionnelle : décommentez sur StrateMineure la ligne

    strate_mineure = relationship("StrateMineure", back_populates="debarcaderes")
    # Unidirectionnelle (aucune modif requise sur StrateMajeure)
    strate_majeure = relationship("StrateMajeure")

    def __repr__(self):
        return f"<Debarcadere {self.code} - {self.denomination}>"
