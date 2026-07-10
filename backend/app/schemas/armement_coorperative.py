from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from app.models.armement_coorperative import TypeAssociation


class ArmementCooperativeBase(BaseModel):
    code: str = Field(..., min_length=5, max_length=50, description="GA-ARM-001")
    denomination: str = Field(..., max_length=200)
    sigle: Optional[str] = Field(None, max_length=50)
    siege: Optional[str] = Field(None, max_length=200)
    type_association: TypeAssociation
    adresse: Optional[str] = Field(None, max_length=200)
    telephone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    site_web: Optional[str] = Field(None, max_length=100)
    date_creation: Optional[datetime] = None

    # Localisation administrative
    province: Optional[str] = Field(None, max_length=100)
    departement: Optional[str] = Field(None, max_length=100)
    localite: Optional[str] = Field(None, max_length=100)

    # Photo et biométrie
    photo_url: Optional[str] = Field(None, max_length=200)  # URL de la photo


class ArmementCooperativeCreate(ArmementCooperativeBase):
    pass


class ArmementCooperativeUpdate(ArmementCooperativeBase):
    pass


class ArmementCooperativeResponse(ArmementCooperativeBase):
    id: int
    count_pecheurs: Optional[int] = None
    count_bateaux: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
