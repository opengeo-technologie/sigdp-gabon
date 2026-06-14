from pydantic import BaseModel, ConfigDict, Field, validator
from typing import Optional, List
from datetime import date
from decimal import Decimal

# ==========================================
# Schémas Licence de Pêche
# ==========================================


class LicencePecheBase(BaseModel):

    type_licence: str = Field(
        ..., description="artisanale, industrielle, semi-industrielle"
    )
    categorie: Optional[str] = Field(
        None, description="peche_cotiere, peche_hauturiere, peche_continentale"
    )

    pecheur_id: Optional[int] = None
    # entreprise_id: Optional[int] = None

    annee_validite: int
    date_emission: date
    date_debut: date
    date_expiration: date

    zone_peche: Optional[str] = None
    coordonnees_zone: Optional[str] = None

    types_peche_autorises: Optional[str] = None
    especes_autorisees: Optional[str] = None

    quota_annuel_kg: Optional[Decimal] = None
    taille_minimale_maille: Optional[Decimal] = None
    profondeur_max_metres: Optional[int] = None

    bateau_id: Optional[int] = None
    nombre_embarcations_max: int = 1
    nombre_pecheurs_max: Optional[int] = None

    montant_paye: Optional[Decimal] = None
    mode_paiement: Optional[str] = None
    reference_paiement: Optional[str] = None

    autorite_emission: str = "Ministère de la Mer, de la Pêche et de l'Économie Bleue"
    agent_emission: Optional[str] = None
    bureau_emission: Optional[str] = None
    pour_ordre: Optional[bool] = None
    signataire_id: Optional[int] = None

    remarques: Optional[str] = None
    actif: bool = True


class LicencePecheCreate(LicencePecheBase):
    """Création d'une nouvelle licence"""

    numero_licence: Optional[str] = None

    @validator("date_expiration")
    def expiration_apres_debut(cls, v, values):
        if "date_debut" in values and v <= values["date_debut"]:
            raise ValueError("La date d'expiration doit être après la date de début")
        return v

    # @validator("pecheur_id", "entreprise_id")
    # def au_moins_un_titulaire(cls, v, values):
    #     if not v and not values.get("pecheur_id") and not values.get("entreprise_id"):
    #         raise ValueError(
    #             "La licence doit avoir un titulaire (pêcheur ou entreprise)"
    #         )
    #     return v


class LicencePecheUpdate(BaseModel):
    """Mise à jour d'une licence"""

    numero_licence: Optional[str] = None
    type_licence: Optional[str] = None
    categorie: Optional[str] = None

    date_expiration: Optional[date] = None

    zone_peche: Optional[str] = None
    types_peche_autorises: Optional[str] = None
    especes_autorisees: Optional[str] = None

    quota_annuel_kg: Optional[Decimal] = None

    statut: Optional[str] = None
    raison_suspension: Optional[str] = None

    remarques: Optional[str] = None
    actif: Optional[bool] = None


class LicencePecheInDB(LicencePecheBase):
    """Licence depuis la base de données"""

    id: int
    statut: Optional[str] = None
    raison_suspension: Optional[str] = None
    date_suspension: Optional[date] = None
    est_renouvellement: Optional[bool] = False
    licence_precedente_id: Optional[int] = None
    document_scan: Optional[str] = None

    class Config:
        from_attributes = True


class LicencePecheSimpleResponse(LicencePecheInDB):
    numero_licence: str = Field(..., min_length=0, max_length=50)
    est_active: bool = False


class LicencePecheResponse(LicencePecheInDB):
    """Réponse avec informations calculées"""

    numero_licence: str = Field(..., min_length=0, max_length=50)
    est_active: bool = False
    jours_avant_expiration: int = 0
    necessite_renouvellement: bool = False
    duree_mois: int = 0

    # Informations titulaire
    nom_titulaire: Optional[str] = None
    type_titulaire: Optional[str] = None  # pecheur ou entreprise

    # Informations bateau
    bateau_info: Optional[dict] = None

    # Info proprietaire
    proprietaire_info: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True, frozen=False)


# ==========================================
# Schémas Inspection
# ==========================================


class InspectionLicenceBase(BaseModel):
    licence_id: int
    date_inspection: date
    lieu_inspection: Optional[str] = None
    type_inspection: str = Field(..., description="terrain, bureau, aleatoire")
    inspecteur: str
    organisme: str
    conforme: bool
    remarques: Optional[str] = None
    mesures_correctives: Optional[str] = None


class InspectionLicenceCreate(InspectionLicenceBase):
    pass


class InspectionLicenceResponse(InspectionLicenceBase):
    id: int
    rapport_scan: Optional[str] = None

    class Config:
        from_attributes = True


# ==========================================
# Schémas Violation
# ==========================================


class ViolationLicenceBase(BaseModel):
    licence_id: int
    date_violation: date
    type_violation: str
    description: str
    lieu: Optional[str] = None
    type_sanction: str = Field(..., description="avertissement, amende, suspension")
    montant_amende: Optional[Decimal] = None
    duree_suspension_jours: Optional[int] = None
    agent: str


class ViolationLicenceCreate(ViolationLicenceBase):
    pass


class ViolationLicenceUpdate(BaseModel):
    statut: Optional[str] = None
    date_reglement: Optional[date] = None


class ViolationLicenceResponse(ViolationLicenceBase):
    id: int
    statut: str
    date_reglement: Optional[date] = None

    class Config:
        from_attributes = True


# ==========================================
# Schémas Renouvellement
# ==========================================


class RenouvellementLicenceCreate(BaseModel):
    licence_actuelle_id: int
    date_demande: date
    remarques: Optional[str] = None


class RenouvellementLicenceTraitement(BaseModel):
    statut: str = Field(..., description="approuve ou rejete")
    motif_rejet: Optional[str] = None
    agent_traitement: str

    # Si approuvé, données de la nouvelle licence
    nouvelle_date_debut: Optional[date] = None
    nouvelle_date_expiration: Optional[date] = None
    nouveau_montant: Optional[Decimal] = None


class RenouvellementLicenceResponse(BaseModel):
    id: int
    licence_actuelle_id: int
    date_demande: date
    date_traitement: Optional[date] = None
    statut: str
    motif_rejet: Optional[str] = None
    nouvelle_licence_id: Optional[int] = None
    agent_traitement: Optional[str] = None
    remarques: Optional[str] = None

    class Config:
        from_attributes = True


# ==========================================
# Statistiques
# ==========================================


class StatistiquesLicences(BaseModel):
    """Statistiques globales sur les licences"""

    total_licences: int
    licences_actives: int
    licences_expirees: int
    licences_suspendues: int
    licences_revoquees: int

    a_renouveler_30_jours: int

    par_type: dict  # {"artisanale": 150, "industrielle": 20}
    par_zone: dict

    total_quotas_kg: Decimal
    montant_total_percu: Decimal


class RapportLicence(BaseModel):
    """Rapport détaillé d'une licence"""

    licence: LicencePecheResponse
    inspections: List[InspectionLicenceResponse]
    violations: List[ViolationLicenceResponse]
    historique_renouvellements: List[RenouvellementLicenceResponse]


class RoleSignataire(BaseModel):
    """Rôle d'un signataire dans le processus de délivrance des licences"""

    id: int
    nom_role: str  # ex: Directeur, Chef de Service, Agent de Terrain
    abbreviation: str  # ex: DIR, CS, AT
    description: Optional[str] = None

    class Config:
        from_attributes = True


class RoleSignataireCreate(BaseModel):
    nom_role: str
    abbreviation: str
    description: Optional[str] = None


class RoleSignataireResponse(RoleSignataireCreate):
    id: int

    class Config:
        from_attributes = True


class Signataire(BaseModel):
    """Signataire d'une licence"""

    id: int
    nom_complet: str
    role_id: int
    organisme: Optional[str] = None
    contact_email: Optional[str] = None
    contact_telephone: Optional[str] = None
    is_actif: bool = True

    # role: Optional[RoleSignataire] = None

    class Config:
        from_attributes = True


class SignataireCreate(BaseModel):
    nom_complet: str
    role_id: int
    organisme: Optional[str] = None
    contact_email: Optional[str] = None
    contact_telephone: Optional[str] = None
    is_actif: bool = True


class SignataireResponse(Signataire):
    id: int
    role: Optional[RoleSignataireResponse] = None

    class Config:
        from_attributes = True


class SignataireLicence(BaseModel):
    """Association entre une licence et un signataire"""

    id: int
    licence_id: int
    signataire_id: int
    date_signature: date
    remarques: Optional[str] = None

    class Config:
        from_attributes = True


class SignataireLicenceCreate(BaseModel):
    licence_id: int
    signataire_id: int
    date_signature: date
    remarques: Optional[str] = None


class SignataireLicenceResponse(SignataireLicence):
    signataire: Optional[Signataire] = None


class SignataireLicenceDetailResponse(SignataireLicence):
    signataire: Optional[Signataire] = None
    role_signataire: Optional[RoleSignataire] = None

    class Config:
        from_attributes = True
