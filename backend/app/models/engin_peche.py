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


class EnginPeche(Base):
    __tablename__ = "engins_peche"

    id = Column(Integer, primary_key=True, index=True)
    libelle = Column(String(150))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<EnginPecheEmbarque Bateau ID: {self.bateau_id}, Type: {self.type_engin}, Quantité: {self.quantite}>"
