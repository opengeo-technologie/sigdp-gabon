# app/schemas/mareyeur.py
# Module Mareyeurs - SIGDP-GABON
# Schémas Pydantic v2 (from_attributes=True)

from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

# ---------------------------------------------------------------------------
# Requêtes génériques (pattern POST-only SIGDP)
# ---------------------------------------------------------------------------


class IdRequest(BaseModel):
    id: int


# ---------------------------------------------------------------------------
# Mareyeur
# ---------------------------------------------------------------------------


class MareyeurBase(BaseModel):
    type_personne: str = "physique"  # physique | morale
    nom: Optional[str] = None
    prenom: Optional[str] = None
    raison_sociale: Optional[str] = None
    sexe: Optional[str] = None
    date_naissance: Optional[date] = None
    lieu_naissance: Optional[str] = None
    nationalite: Optional[str] = None
    nif: Optional[str] = None
    rccm: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse: Optional[str] = None
    photo: Optional[str] = None
    zones_activite: Optional[str] = None  # "Libreville, Port-Gentil"
    sites_debarquement: Optional[str] = None  # chaîne séparée par virgules
    statut: str = "actif"  # actif | suspendu | radie
    observations: Optional[str] = None


class MareyeurCreate(MareyeurBase):
    pass


class MareyeurUpdate(MareyeurBase):
    id: int


class MareyeurListFilter(BaseModel):
    statut: Optional[str] = None
    recherche: Optional[str] = None  # nom, raison sociale, code, NIF, téléphone
    page: int = 1
    taille_page: int = 25


class MareyeurResponse(MareyeurBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Agrément de mareyage
# ---------------------------------------------------------------------------


class AgrementBase(BaseModel):
    mareyeur_id: int
    categorie: str = "mareyeur_simple"  # mareyeur_simple | mareyeur_exportateur
    date_demande: Optional[date] = None
    duree_validite_mois: int = 12
    montant_redevance: Optional[float] = None
    observations: Optional[str] = None


class AgrementCreate(AgrementBase):
    pass


class AgrementUpdate(BaseModel):
    id: int
    categorie: Optional[str] = None
    date_demande: Optional[date] = None
    duree_validite_mois: Optional[int] = None
    montant_redevance: Optional[float] = None
    observations: Optional[str] = None


class AgrementListFilter(BaseModel):
    mareyeur_id: Optional[int] = None
    statut: Optional[str] = None
    categorie: Optional[str] = None
    page: int = 1
    taille_page: int = 25


class AgrementStatutRequest(BaseModel):
    """Suspension / retrait d'un agrément."""

    id: int
    motif: Optional[str] = None


class AgrementRenouvelerRequest(BaseModel):
    id: int  # agrément à renouveler
    duree_validite_mois: int = 12
    montant_redevance: Optional[float] = None


class AgrementExpirantRequest(BaseModel):
    jours: int = 30


class AgrementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    mareyeur_id: int
    categorie: str
    date_demande: Optional[date] = None
    date_delivrance: Optional[date] = None
    duree_validite_mois: int
    date_expiration: Optional[date] = None
    montant_redevance: Optional[float] = None
    statut: str
    motif_statut: Optional[str] = None
    renouvele_de_id: Optional[int] = None
    observations: Optional[str] = None
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Installations
# ---------------------------------------------------------------------------


class InstallationBase(BaseModel):
    mareyeur_id: int
    type_installation: (
        str  # chambre_froide | vehicule_frigorifique | entrepot | etal | autre
    )
    designation: str
    capacite_tonnes: Optional[float] = None
    immatriculation: Optional[str] = None
    adresse: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    statut: str = "fonctionnelle"
    observations: Optional[str] = None


class InstallationCreate(InstallationBase):
    pass


class InstallationUpdate(InstallationBase):
    id: int


class InstallationListFilter(BaseModel):
    mareyeur_id: Optional[int] = None
    type_installation: Optional[str] = None


class InstallationResponse(InstallationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Transactions d'achat (traçabilité)
# ---------------------------------------------------------------------------


class TransactionBase(BaseModel):
    mareyeur_id: int
    date_transaction: date
    site_debarquement: Optional[str] = None
    pecheur: Optional[str] = None
    pirogue: Optional[str] = None
    site_debarquement_id: Optional[int] = None
    pecheur_id: Optional[int] = None
    pirogue_id: Optional[int] = None
    etat_poisson: str = "frais"  # frais | sale | fume | autre
    espece: str
    quantite_kg: float = 0
    prix_unitaire_fcfa: Optional[float] = None
    observations: Optional[str] = None


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(TransactionBase):
    id: int


class TransactionListFilter(BaseModel):
    mareyeur_id: Optional[int] = None
    espece: Optional[str] = None
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    page: int = 1
    taille_page: int = 25


class TransactionResponse(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    montant_total_fcfa: Optional[float] = None
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Réponses paginées / statistiques
# ---------------------------------------------------------------------------


class MareyeurListResponse(BaseModel):
    total: int
    page: int
    taille_page: int
    resultats: List[MareyeurResponse]


class AgrementListResponse(BaseModel):
    total: int
    page: int
    taille_page: int
    resultats: List[AgrementResponse]


class TransactionListResponse(BaseModel):
    total: int
    page: int
    taille_page: int
    resultats: List[TransactionResponse]


class StatistiquesMareyeursResponse(BaseModel):
    """Alimente les graphiques Chart.js du dashboard."""

    total_mareyeurs: int
    par_statut: dict  # {"actif": 42, "suspendu": 3, ...}
    par_type_personne: dict  # {"physique": 30, "morale": 15}
    agrements_par_statut: dict  # {"delivre": 25, "en_instruction": 5, ...}
    agrements_expirant_30j: int
    volume_total_kg: float
    volumes_par_espece: dict  # {"Bar": 1200.5, "Capitaine": 800, ...}
    volumes_par_site: dict  # {"Port Môle": 950, ...}
