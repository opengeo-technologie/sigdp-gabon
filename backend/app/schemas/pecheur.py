from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date, datetime
from app.models.pecheur import CategoriePecheur, TypePeche, StatutPecheur


class PecheurBase(BaseModel):
    numero_carte: str = Field(
        ..., min_length=5, max_length=50, description="Numéro de carte CNP-XXXX-XXXX"
    )
    nom: str = Field(..., min_length=2, max_length=100)
    prenom: str = Field(None, min_length=0, max_length=100)
    date_naissance: Optional[datetime] = None
    lieu_naissance: Optional[str] = Field(None, max_length=100)
    nationalite: str = Field(default="Gabonaise", max_length=50)
    type_carte: Optional[str] = Field(None, max_length=100)
    numero_piece_identite: str = Field(
        None, max_length=100, description="Numéro de pièce d'identité"
    )
    # nif: Optional[str] = Field(
    #     None, max_length=20, description="Numéro d'Identification Fiscale"
    # )

    # Contact
    telephone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=100)
    adresse: Optional[str] = Field(None, max_length=200)

    # Catégorisation
    categorie: CategoriePecheur
    # type_peche: TypePeche

    # Débarcadère habituel
    debarcadere_habituel_code: Optional[str] = Field(None, max_length=50)
    debarcadere_habituel_nom: Optional[str] = None
    debarcadere_habituel_id: Optional[int] = None
    cooperative_id: Optional[int] = None
    cooperative_nom: Optional[str] = None

    # Licence
    # licence_numero: Optional[str] = Field(None, max_length=50)
    # licence_date_delivrance: Optional[date] = None
    # licence_date_expiration: Optional[date] = None

    # Contacts d'urgence
    contact_urgence_nom: Optional[str] = Field(None, max_length=100)
    contact_urgence_telephone: Optional[str] = Field(None, max_length=20)
    contact_urgence_relation: Optional[str] = Field(None, max_length=50)

    statut: StatutPecheur = StatutPecheur.ACTIF


class PecheurCreate(PecheurBase):
    pass


class PecheurUpdate(BaseModel):
    nom: Optional[str] = Field(None, min_length=2, max_length=100)
    prenom: Optional[str] = Field(None, min_length=2, max_length=100)
    date_naissance: Optional[date] = None
    lieu_naissance: Optional[str] = None
    nationalite: Optional[str] = None
    type_carte: Optional[str] = None
    numero_piece_identite: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse: Optional[str] = None
    categorie: Optional[CategoriePecheur] = None
    # type_peche: Optional[TypePeche] = None
    debarcadere_habituel_code: Optional[str] = None

    licence_date_delivrance: Optional[date] = None
    licence_date_expiration: Optional[date] = None
    contact_urgence_nom: Optional[str] = None
    contact_urgence_telephone: Optional[str] = None
    contact_urgence_relation: Optional[str] = None
    statut: Optional[StatutPecheur] = None


class PecheurInDB(PecheurBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PecheurResponse(PecheurInDB):
    """Response model with computed fields"""

    age: Optional[int] = None
    # licence_active: bool = False
    photo_url: Optional[str] = None
    qr_code_url: Optional[str] = None


class CartePecheurGenerate(BaseModel):
    """Request to generate a fisherman card"""

    pecheur_id: int
    include_photo: bool = True
    include_qr_code: bool = True
