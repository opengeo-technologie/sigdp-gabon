from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class InfractionBase(BaseModel):
    libelle_infra: Optional[str] = Field(..., max_length=200)
    type_infra: Optional[str] = Field(..., max_length=200)
    description: Optional[str] = Field(None, max_length=200)
    sanction_proposee: Optional[str] = Field(None, max_length=300)


class InfractionCreate(InfractionBase):
    pass


class InfractionUpdate(InfractionBase):
    pass


class InfractionResponse(InfractionBase):
    id: int
