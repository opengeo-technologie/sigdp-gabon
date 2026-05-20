from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum, Text
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
import enum
from app.database import Base


class TypeAssociation(str, enum.Enum):
    ARMEMENT = "Armement"
    COOPERATIVE = "Cooperative"


class ArmementCooperative(Base):
    __tablename__ = "armement_cooperatives"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # GA-ARM-001
    denomination = Column(String(200), nullable=False)
    sigle = Column(String(50), nullable=True)
    siege = Column(String(200), nullable=True)
    type_association = Column(Enum(TypeAssociation), nullable=False)
    adresse = Column(String(200), nullable=True)
    telephone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    site_web = Column(String(100), nullable=True)
    date_creation = Column(DateTime, nullable=True)

    # Localisation administrative
    province = Column(String(100), nullable=True)
    departement = Column(String(100), nullable=True)
    localite = Column(String(100), nullable=True)

    # Photo et biométrie
    photo_url = Column(String(200), nullable=True)  # URL de la photo

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
