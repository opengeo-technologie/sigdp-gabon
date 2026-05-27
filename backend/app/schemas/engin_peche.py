from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from app.models.bateau import TypeBateau, Propulsion, MateriauCoque
from app.schemas.pecheur import PecheurResponse


class EnginPecheBase(BaseModel):
    libelle: Optional[str] = Field(..., max_length=150)


class EnginPecheCreate(EnginPecheBase):
    pass


class EnginPecheUpdate(EnginPecheBase):
    pass


class EnginPecheResponse(EnginPecheBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
