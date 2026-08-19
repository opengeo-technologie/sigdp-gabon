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


class StrateMajeure(Base):
    __tablename__ = "strates_majeures"

    id = Column(Integer, primary_key=True, index=True)
    libelle = Column(String(150))
    description = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    strates_mineures = relationship(
        "StrateMineure",
        back_populates="strate_majeure",
        cascade="save-update, merge",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<StrateMajeure id={self.id} " f"libelle={self.libelle!r}>"


class StrateMineure(Base):
    __tablename__ = "strates_mineures"

    id = Column(Integer, primary_key=True, index=True)
    libelle = Column(String(150))
    description = Column(Text, nullable=True)
    strate_majeure_id = Column(
        Integer,
        ForeignKey("strates_majeures.id"),
        nullable=True,
        index=True,
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # [AJOUT] Relation inverse.
    strate_majeure = relationship("StrateMajeure", back_populates="strates_mineures")

    captures_estimees = relationship("CaptureEstimee", back_populates="strate_mineure")
    efforts = relationship("EffortEstime", back_populates="strate_mineure")
    debarcaderes = relationship("Debarcadere", back_populates="strate_mineure")

    def __repr__(self) -> str:
        return (
            f"<StrateMineure id={self.id} "
            f"libelle={self.libelle!r} majeure={self.strate_majeure_id}>"
        )
