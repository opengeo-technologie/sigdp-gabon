from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.models.espece import CategorieEspece, StatutReglementaire


class EspeceBase(BaseModel):
    code_espece: str = Field(
        ..., min_length=2, max_length=20, description="Code FAO ou national"
    )
    nom_scientifique: str = Field(..., min_length=3, max_length=200)
    nom_commun_francais: str = Field(..., min_length=2, max_length=200)
    nom_commun_fang: Optional[str] = Field(None, max_length=200)
    nom_commun_myene: Optional[str] = Field(None, max_length=200)
    autres_noms_locaux: Optional[str] = None

    # Classification
    categorie: CategorieEspece
    famille: Optional[str] = Field(None, max_length=100)
    ordre: Optional[str] = Field(None, max_length=100)
    classe: Optional[str] = Field(None, max_length=100)

    # Statut réglementaire
    statut_reglementaire: StatutReglementaire = StatutReglementaire.LIBRE
    taille_minimale_legale_cm: Optional[float] = Field(None, ge=0)

    # Quotas
    quota_annuel_tonnes: Optional[float] = Field(None, ge=0)
    quota_mensuel_tonnes: Optional[float] = Field(None, ge=0)
    quota_hebdomadaire_tonnes: Optional[float] = Field(None, ge=0)

    # Saisonnalité
    saison_peche_debut: Optional[str] = Field(None, max_length=20)
    saison_peche_fin: Optional[str] = Field(None, max_length=20)
    saison_reproduction_debut: Optional[str] = Field(None, max_length=20)
    saison_reproduction_fin: Optional[str] = Field(None, max_length=20)

    # Valeur commerciale
    prix_reference_kg_min: Optional[float] = Field(None, ge=0)
    prix_reference_kg_max: Optional[float] = Field(None, ge=0)

    # Informations biologiques
    habitat: Optional[str] = None
    alimentation: Optional[str] = None
    taille_maximale_cm: Optional[float] = Field(None, ge=0)
    poids_maximal_kg: Optional[float] = Field(None, ge=0)
    esperance_vie_annees: Optional[int] = Field(None, ge=0)

    # Importance écologique
    importance_ecologique: Optional[str] = None
    vulnerabilite_surpeche: Optional[str] = Field(None, max_length=20)

    photo_url: Optional[str] = None

    actif: bool = True


class EspeceCreate(EspeceBase):
    pass


class EspeceUpdate(BaseModel):
    nom_scientifique: Optional[str] = None
    nom_commun_francais: Optional[str] = None
    nom_commun_fang: Optional[str] = None
    nom_commun_myene: Optional[str] = None
    autres_noms_locaux: Optional[str] = None
    categorie: Optional[CategorieEspece] = None
    famille: Optional[str] = None
    ordre: Optional[str] = None
    classe: Optional[str] = None
    statut_reglementaire: Optional[StatutReglementaire] = None
    taille_minimale_legale_cm: Optional[float] = None
    quota_annuel_tonnes: Optional[float] = None
    quota_mensuel_tonnes: Optional[float] = None
    quota_hebdomadaire_tonnes: Optional[float] = None
    saison_peche_debut: Optional[str] = None
    saison_peche_fin: Optional[str] = None
    prix_reference_kg_min: Optional[float] = None
    prix_reference_kg_max: Optional[float] = None
    habitat: Optional[str] = None
    vulnerabilite_surpeche: Optional[str] = None
    actif: Optional[bool] = None


class EspeceInDB(EspeceBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EspeceResponse(EspeceInDB):
    """Response model with computed fields"""

    quota_disponible: Optional[float] = None
    en_saison: Optional[bool] = None
