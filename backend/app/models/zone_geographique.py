"""
Modèles SQLAlchemy — couches géographiques SIGPA.

Une seule table `zone_geographique` porte les 4 couches (parcs aquatiques, ZEE,
frontières pays, frontières régions), discriminées par `type_zone`.
Rationale : mêmes attributs, même géométrie (MULTIPOLYGON 4326), un seul
endpoint d'import, une seule requête GeoJSON pour la carte Leaflet.

Adapter l'import `Base` à votre projet (app.database / app.db.base).
"""

import enum
import uuid as uuid_lib
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.database import Base  # <-- à adapter


class TypeZone(str, enum.Enum):
    PARC_AQUATIQUE = "PARC_AQUATIQUE"
    ZEE = "ZEE"
    FRONTIERE_PAYS = "FRONTIERE_PAYS"
    FRONTIERE_REGION = "FRONTIERE_REGION"


class StatutImport(str, enum.Enum):
    EN_COURS = "EN_COURS"
    TERMINE = "TERMINE"
    TERMINE_AVEC_ERREURS = "TERMINE_AVEC_ERREURS"
    ECHOUE = "ECHOUE"


class ImportShapefile(Base):
    """Trace d'un import : permet de rejouer, auditer ou supprimer un lot."""

    __tablename__ = "import_shapefile"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(
        String(36), unique=True, nullable=False, default=lambda: str(uuid_lib.uuid4())
    )

    type_zone = Column(
        SAEnum(TypeZone, name="type_zone_enum"), nullable=False, index=True
    )
    nom_fichier = Column(String(255), nullable=False)
    nom_couche = Column(String(255), nullable=True)
    crs_source = Column(String(100), nullable=True)

    nb_entites_total = Column(Integer, default=0, nullable=False)
    nb_entites_importees = Column(Integer, default=0, nullable=False)
    nb_erreurs = Column(Integer, default=0, nullable=False)

    statut = Column(
        SAEnum(StatutImport, name="statut_import_enum"),
        default=StatutImport.EN_COURS,
        nullable=False,
    )
    message = Column(Text, nullable=True)
    rapport = Column(JSONB, nullable=True)  # erreurs ligne par ligne
    correspondance = Column(JSONB, nullable=True)  # mapping colonnes retenu

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    date_import = Column(DateTime, default=datetime.utcnow, nullable=False)

    zones = relationship(
        "ZoneGeographique", back_populates="import_source", cascade="all, delete-orphan"
    )


class ZoneGeographique(Base):
    __tablename__ = "zone_geographique"

    id = Column(Integer, primary_key=True, index=True)
    import_id = Column(
        Integer,
        ForeignKey("import_shapefile.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    type_zone = Column(
        SAEnum(TypeZone, name="type_zone_enum"), nullable=False, index=True
    )
    code = Column(String(60), nullable=True, index=True)
    nom = Column(String(255), nullable=False, index=True)
    nom_alternatif = Column(String(255), nullable=True)

    # Hiérarchie : une région pointe vers le code de son pays.
    code_parent = Column(String(60), nullable=True, index=True)
    niveau = Column(Integer, nullable=True)  # 0 = pays, 1 = province, 2 = département

    superficie_km2 = Column(Float, nullable=True)
    perimetre_km = Column(Float, nullable=True)

    # Tous les champs du .dbf non mappés sont conservés ici (aucune perte).
    attributs = Column(JSONB, nullable=True)

    geom = Column(
        Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True),
        nullable=False,
    )

    actif = Column(Boolean, default=True, nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_modification = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    import_source = relationship("ImportShapefile", back_populates="zones")

    __table_args__ = (
        # NULL n'est pas égal à NULL en PostgreSQL : les entités sans code
        # ne se bloquent pas entre elles.
        UniqueConstraint("type_zone", "code", name="uq_zone_type_code"),
        Index("ix_zone_type_actif", "type_zone", "actif"),
    )

    def __repr__(self) -> str:
        return f"<ZoneGeographique {self.type_zone} {self.code or ''} {self.nom}>"
