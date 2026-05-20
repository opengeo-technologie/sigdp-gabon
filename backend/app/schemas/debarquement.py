from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class DetailDebarquementCreate(BaseModel):
    espece_id: int
    quantite_kg: float = Field(..., gt=0)
    nombre_individus: Optional[int] = Field(None, ge=0)
    taille_moyenne_cm: Optional[float] = Field(None, ge=0)
    taille_min_cm: Optional[float] = Field(None, ge=0)
    taille_max_cm: Optional[float] = Field(None, ge=0)
    prix_unitaire_kg: Optional[float] = Field(None, ge=0)
    valeur_totale: Optional[float] = Field(None, ge=0)
    etat_fraicheur: Optional[str] = Field(None, max_length=50)
    destination: Optional[str] = Field(None, max_length=100)


class DebarquementBase(BaseModel):
    debarcadere_id: int
    bateau_id: int
    pecheur_principal_id: int
    date_debarquement: datetime
    heure_depart_peche: Optional[datetime] = None
    heure_arrivee_debarcadere: Optional[datetime] = None
    duree_sortie_heures: Optional[float] = Field(None, ge=0)
    
    # Zone de pêche
    zone_peche_nom: Optional[str] = Field(None, max_length=200)
    zone_peche_latitude: Optional[float] = Field(None, ge=-90, le=90)
    zone_peche_longitude: Optional[float] = Field(None, ge=-180, le=180)
    zone_peche_profondeur_m: Optional[float] = Field(None, ge=0)
    
    # Conditions météo
    meteo_conditions: Optional[str] = Field(None, max_length=100)
    meteo_etat_mer: Optional[str] = Field(None, max_length=100)
    meteo_temperature_c: Optional[float] = None
    
    # Équipage
    nombre_pecheurs: Optional[int] = Field(None, ge=1)
    liste_pecheurs_ids: Optional[str] = None
    
    # Validation
    agent_controle_nom: Optional[str] = Field(None, max_length=200)
    agent_controle_matricule: Optional[str] = Field(None, max_length=50)
    
    # Observations
    observations: Optional[str] = None
    anomalies_detectees: Optional[str] = None


class DebarquementCreate(DebarquementBase):
    details: List[DetailDebarquementCreate] = Field(..., min_items=1)


class DebarquementUpdate(BaseModel):
    date_debarquement: Optional[datetime] = None
    zone_peche_nom: Optional[str] = None
    meteo_conditions: Optional[str] = None
    observations: Optional[str] = None
    anomalies_detectees: Optional[str] = None


class DetailDebarquementInDB(BaseModel):
    id: int
    debarquement_id: int
    espece_id: int
    quantite_kg: float
    nombre_individus: Optional[int]
    prix_unitaire_kg: Optional[float]
    valeur_totale: Optional[float]
    alerte_taille_illegale: bool
    alerte_quota: bool
    created_at: datetime
    
    # Données enrichies
    espece_nom: Optional[str] = None
    espece_code: Optional[str] = None
    
    class Config:
        from_attributes = True


class DebarquementInDB(DebarquementBase):
    id: int
    numero_debarquement: str
    alerte_espece_protegee: bool
    alerte_quota_depasse: bool
    alerte_taille_illegale: bool
    alerte_bateau_non_conforme: bool
    alerte_details: Optional[str]
    synchronise: bool
    created_at: datetime
    updated_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class DebarquementResponse(DebarquementInDB):
    """Response with enriched data"""
    details: List[DetailDebarquementInDB] = []
    debarcadere_nom: Optional[str] = None
    bateau_immatriculation: Optional[str] = None
    pecheur_nom: Optional[str] = None
    total_quantite_kg: Optional[float] = None
    total_valeur: Optional[float] = None
    nb_especes: Optional[int] = None
    has_alertes: bool = False
