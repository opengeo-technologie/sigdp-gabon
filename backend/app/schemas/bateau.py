from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from app.models.bateau import TypeBateau, Propulsion, MateriauCoque
from app.schemas.pecheur import PecheurResponse


class BateauBase(BaseModel):
    numero_immatriculation: str = Field(
        ..., min_length=5, max_length=50, description="GA-PCH-2025-XXXX"
    )
    nom_bateau: Optional[str] = Field(None, max_length=100)
    type_bateau: TypeBateau
    propulsion: Propulsion

    # Dimensions
    longueur_hors_tout: Optional[float] = Field(None, ge=0)
    largeur: Optional[float] = Field(None, ge=0)
    tirant_eau: Optional[float] = Field(None, ge=0)
    jauge_brute: Optional[float] = Field(None, ge=0)

    # Motorisation
    moteur_marque: Optional[str] = Field(None, max_length=50)
    moteur_puissance_cv: Optional[int] = Field(None, ge=0)
    moteur_type_carburant: Optional[str] = Field(None, max_length=50)
    moteur_numero_serie: Optional[str] = Field(None, max_length=100)

    # Construction
    materiau_coque: MateriauCoque
    annee_construction: Optional[int] = Field(None, ge=1900, le=2030)
    chantier_construction: Optional[str] = Field(None, max_length=100)

    # Engins de pêche
    engins_peche: Optional[str] = Field(None, max_length=200)

    # Propriétaire
    proprietaire_pecheur_id: Optional[int] = None
    proprietaire_nom: Optional[str] = Field(None, max_length=200)
    nombre_equipage: Optional[int] = Field(None, ge=1)

    # Zone de pêche
    zone_peche_habituelle: Optional[str] = Field(None, max_length=200)
    zone_peche_coordonnees: Optional[str] = None

    # Certificat
    certificat_navigabilite_numero: Optional[str] = Field(None, max_length=50)
    certificat_navigabilite_date_delivrance: Optional[date] = None
    certificat_navigabilite_date_expiration: Optional[date] = None

    # Équipements de sécurité
    equipement_gilets_sauvetage: bool = False
    equipement_extincteur: bool = False
    equipement_radio_vhf: bool = False
    equipement_gps: bool = False
    equipement_balise_detresse: bool = False

    # Balise GPS
    balise_gps_imei: Optional[str] = Field(None, max_length=50)
    balise_gps_actif: bool = False

    photo_url: Optional[str] = None

    statut: str = "Actif"


class BateauCreate(BateauBase):
    pass


class BateauUpdate(BaseModel):
    nom_bateau: Optional[str] = None
    type_bateau: Optional[TypeBateau] = None
    propulsion: Optional[Propulsion] = None
    longueur_hors_tout: Optional[float] = None
    largeur: Optional[float] = None
    tirant_eau: Optional[float] = None
    jauge_brute: Optional[float] = None
    moteur_marque: Optional[str] = None
    moteur_puissance_cv: Optional[int] = None
    moteur_type_carburant: Optional[str] = None
    moteur_numero_serie: Optional[str] = None
    materiau_coque: Optional[MateriauCoque] = None
    annee_construction: Optional[int] = None
    chantier_construction: Optional[str] = None
    engins_peche: Optional[str] = None
    proprietaire_pecheur_id: Optional[int] = None
    proprietaire_nom: Optional[str] = None
    nombre_equipage: Optional[int] = None
    zone_peche_habituelle: Optional[str] = None
    zone_peche_coordonnees: Optional[str] = None
    certificat_navigabilite_numero: Optional[str] = None
    certificat_navigabilite_date_delivrance: Optional[date] = None
    certificat_navigabilite_date_expiration: Optional[date] = None
    equipement_gilets_sauvetage: Optional[bool] = None
    equipement_extincteur: Optional[bool] = None
    equipement_radio_vhf: Optional[bool] = None
    equipement_gps: Optional[bool] = None
    equipement_balise_detresse: Optional[bool] = None
    balise_gps_imei: Optional[str] = None
    balise_gps_actif: Optional[bool] = None
    photo_url: Optional[str] = None
    statut: Optional[str] = None


class BateauInDB(BateauBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BateauResponse(BateauInDB):
    """Response model with computed fields"""

    certificat_valide: bool = False
    proprietaire_info: Optional[dict] = None


class EquipageCreate(BaseModel):
    pecheur_id: int
    bateau_id: int
    role: Optional[str] = None


class EquipageInfo(BaseModel):
    role: Optional[str] = None
    pecheur: Optional[PecheurResponse] = None


class BateauDetailResponse(BateauResponse):
    equipage: Optional[list[EquipageInfo]] = None
