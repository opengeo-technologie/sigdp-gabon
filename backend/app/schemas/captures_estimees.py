"""
SIGPA — Module « Captures estimées »
Schémas Pydantic v2 (validation + sérialisation).

Messages d'erreur en français, cohérents avec le reste de la plateforme.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

MOIS_LIBELLES = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
]


class GroupeEspeceEnum(str, Enum):
    PELAGIQUE = "PELAGIQUE"
    DEMERSAL = "DEMERSAL"
    CRUSTACE = "CRUSTACE"


# ---------------------------------------------------------------------------
# Référentiels
# ---------------------------------------------------------------------------
class EnginOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    libelle: str
    agrege: bool
    actif: bool


class EspeceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    nom: str
    groupe: Optional[GroupeEspeceEnum] = None
    actif: bool


# ---------------------------------------------------------------------------
# Capture estimée
# ---------------------------------------------------------------------------
class CaptureBase(BaseModel):
    annee: int = Field(..., ge=2000, le=2100, description="Année de référence")
    mois: int = Field(
        ..., ge=1, le=12, description="Mois (1 = Janvier … 12 = Décembre)"
    )
    engin_id: int = Field(..., gt=0)
    espece_id: int = Field(..., gt=0)
    strate_mineure_id: int = Field(..., gt=0)
    capture_kg: float = Field(0.0, ge=0, description="Capture estimée en kilogrammes")
    valeur_fcfa: float = Field(0.0, ge=0, description="Valeur estimée en f.CFA")
    source: Optional[str] = Field(None, max_length=120)

    @field_validator("capture_kg", "valeur_fcfa")
    @classmethod
    def _pas_de_nan(cls, v: float) -> float:
        if v != v:  # NaN
            raise ValueError("La valeur ne doit pas être vide ou non numérique.")
        return round(float(v), 6)


class CaptureCreate(CaptureBase):
    pass


class CaptureUpdate(BaseModel):
    """Mise à jour partielle : seuls les champs fournis sont modifiés."""

    capture_kg: Optional[float] = Field(None, ge=0)
    valeur_fcfa: Optional[float] = Field(None, ge=0)
    source: Optional[str] = Field(None, max_length=120)


class CaptureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    annee: int
    mois: int
    mois_libelle: str = ""
    engin_id: int
    engin_libelle: Optional[str] = None
    espece_id: int
    espece_nom: Optional[str] = None
    espece_groupe: Optional[str] = None
    strate_mineure_id: int = None
    strate_mineure_libelle: Optional[str] = None
    capture_kg: float
    capture_tonnes: float = 0.0
    valeur_fcfa: float
    source: Optional[str] = None
    date_maj: Optional[datetime] = None

    @classmethod
    def depuis_orm(cls, c) -> "CaptureOut":
        return cls(
            id=c.id,
            annee=c.annee,
            mois=c.mois,
            mois_libelle=MOIS_LIBELLES[c.mois - 1],
            engin_id=c.engin_id,
            engin_libelle=c.engin.libelle if c.engin else None,
            espece_id=c.espece_id,
            espece_nom=c.espece.nom_commun_francais if c.espece else None,
            espece_groupe=(
                c.espece.categorie if (c.espece and c.espece.categorie) else None
            ),
            strate_mineure_id=c.strate_mineure_id,
            strate_mineure_libelle=(
                c.strate_mineure.libelle if c.strate_mineure else None
            ),
            capture_kg=c.capture_kg,
            capture_tonnes=round((c.capture_kg or 0) / 1000, 6),
            valeur_fcfa=c.valeur_fcfa,
            source=c.source,
            date_maj=c.date_maj,
        )


# ---------------------------------------------------------------------------
# Effort estimé
# ---------------------------------------------------------------------------
class EffortUpsert(BaseModel):
    annee: int = Field(..., ge=2000, le=2100)
    mois: int = Field(..., ge=1, le=12)
    engin_id: int = Field(..., gt=0)
    strate_mineure_id: int = Field(..., gt=0)
    efforts_jours: float = Field(0.0, ge=0)
    nombre_debarquements: int = Field(0, ge=0)
    taux_echantillonnage: Optional[float] = Field(None, ge=0, le=5)


class EffortOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    annee: int
    mois: int
    mois_libelle: str = ""
    engin_id: int
    engin_libelle: Optional[str] = None
    strate_mineure_id: int
    strate_mineure_libelle: Optional[str] = None
    efforts_jours: float
    nombre_debarquements: int
    taux_echantillonnage: Optional[float] = None
    cpue_kg_jour: Optional[float] = None  # calculée côté service


# ---------------------------------------------------------------------------
# Requêtes (POST-only : tous les filtres passent dans le corps)
# ---------------------------------------------------------------------------
class CaptureFiltre(BaseModel):
    annee: Optional[int] = None
    mois: Optional[int] = Field(None, ge=1, le=12)
    engin_id: Optional[int] = None
    espece_id: Optional[int] = None
    espece_id: Optional[int] = None
    strate_mineure_id: Optional[int] = None
    groupe: Optional[GroupeEspeceEnum] = None
    inclure_agrege: bool = False  # inclure l'engin « TOTAL »
    page: int = Field(1, ge=1)
    taille_page: int = Field(50, ge=1, le=500)
    tri: str = Field("annee,mois", description="colonnes séparées par des virgules")


class CaptureListe(BaseModel):
    total: int
    page: int
    taille_page: int
    elements: list[CaptureOut]


class IdRequete(BaseModel):
    id: int = Field(..., gt=0)


# ---------------------------------------------------------------------------
# Export & statistiques
# ---------------------------------------------------------------------------
class FormatExport(str, Enum):
    excel = "excel"
    csv = "csv"
    json = "json"
    pdf = "pdf"


class ExportRequete(BaseModel):
    format: FormatExport = FormatExport.excel
    filtre: CaptureFiltre = Field(default_factory=CaptureFiltre)


class StatsRequete(BaseModel):
    annee: int = Field(..., ge=2000, le=2100)
    engin_id: Optional[int] = None  # None = tous engins réels (hors agrégé)
    strate_mineure_id: Optional[int] = None  # None = tous les groupes


# ---------------------------------------------------------------------------
# Résultat d'import Excel (gestion d'erreurs ligne par ligne)
# ---------------------------------------------------------------------------
class LigneErreur(BaseModel):
    feuille: str
    reference: str  # ex. « Filet mulet / Bars / Mars »
    message: str


class ImportResultat(BaseModel):
    lignes_lues: int
    captures_importees: int
    efforts_importes: int
    engins_crees: int
    especes_creees: int
    erreurs: list[LigneErreur] = []
    succes: bool = True
