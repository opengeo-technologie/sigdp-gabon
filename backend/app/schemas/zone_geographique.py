"""Schémas Pydantic v2 — couches géographiques SIGPA."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.zone_geographique import StatutImport, TypeZone


# --------------------------------------------------------------------------
# Import
# --------------------------------------------------------------------------
class OptionsImport(BaseModel):
    """Options envoyées en champ `options` (JSON) du formulaire multipart."""

    model_config = ConfigDict(extra="forbid")

    nom_couche: str | None = Field(
        default=None,
        description="Nom du .shp à utiliser si l'archive en contient plusieurs.",
    )
    crs_source: str | None = Field(
        default=None,
        description="CRS de repli si le .prj est absent (ex. 'EPSG:32732').",
    )
    encodage: str | None = Field(
        default=None, description="Encodage du .dbf (utf-8, latin-1…)."
    )
    correspondance: dict[str, str] = Field(
        default_factory=dict,
        description=(
            "Mapping champ_modele -> colonne_shapefile. "
            "Clés admises : nom, code, nom_alternatif, code_parent, niveau. "
            "Vide = détection automatique."
        ),
    )
    remplacer: bool = Field(
        default=False,
        description="Supprime les zones existantes de ce type avant l'import.",
    )
    tolerance_simplification: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="Degrés (ST_SimplifyPreserveTopology). 0.001 ≈ 100 m.",
    )
    ignorer_erreurs: bool = Field(
        default=True,
        description="False = toute erreur de ligne annule l'import complet.",
    )
    code_parent_defaut: str | None = Field(
        default=None,
        description="Code parent appliqué aux entités sans colonne parent (ex. 'GAB').",
    )

    @field_validator("correspondance")
    @classmethod
    def _valider_cles(cls, v: dict[str, str]) -> dict[str, str]:
        autorisees = {"nom", "code", "nom_alternatif", "code_parent", "niveau"}
        inconnues = set(v) - autorisees
        if inconnues:
            raise ValueError(
                f"Clés de correspondance inconnues : {', '.join(sorted(inconnues))}. "
                f"Attendues : {', '.join(sorted(autorisees))}."
            )
        return v


class ErreurLigne(BaseModel):
    index: int
    identifiant: str | None = None
    message: str


class RapportImport(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    uuid: str
    type_zone: TypeZone
    nom_fichier: str
    nom_couche: str | None = None
    crs_source: str | None = None
    statut: StatutImport
    nb_entites_total: int
    nb_entites_importees: int
    nb_erreurs: int
    correspondance: dict[str, str] | None = None
    erreurs: list[ErreurLigne] = Field(default_factory=list)
    message: str | None = None
    date_import: datetime | None = None


# --------------------------------------------------------------------------
# Lecture
# --------------------------------------------------------------------------
class ZoneResume(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type_zone: TypeZone
    code: str | None = None
    nom: str
    code_parent: str | None = None
    niveau: int | None = None
    superficie_km2: float | None = None
    perimetre_km: float | None = None
    actif: bool
    attributs: dict[str, Any] | None = None


class FiltreZones(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type_zone: TypeZone | None = None
    types_zone: list[TypeZone] | None = None
    code_parent: str | None = None
    recherche: str | None = None
    actif: bool | None = True
    page: int = Field(default=1, ge=1)
    taille_page: int = Field(default=50, ge=1, le=500)


class ListeZones(BaseModel):
    total: int
    page: int
    taille_page: int
    resultats: list[ZoneResume]


class RequeteGeoJSON(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type_zone: TypeZone | None = None
    types_zone: list[TypeZone] | None = None
    ids: list[int] | None = None
    bbox: list[float] | None = Field(
        default=None, description="[ouest, sud, est, nord] en WGS84."
    )
    tolerance: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="Simplification à la volée, en degrés (allège la carte Leaflet).",
    )
    limite: int = Field(default=2000, ge=1, le=10000)

    @field_validator("bbox")
    @classmethod
    def _valider_bbox(cls, v: list[float] | None) -> list[float] | None:
        if v is not None and len(v) != 4:
            raise ValueError(
                "La bbox doit contenir 4 valeurs : [ouest, sud, est, nord]."
            )
        return v


class RequetePoint(BaseModel):
    model_config = ConfigDict(extra="forbid")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    types_zone: list[TypeZone] | None = None


class ImportResume(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    uuid: str
    type_zone: TypeZone
    nom_fichier: str
    statut: StatutImport
    nb_entites_total: int
    nb_entites_importees: int
    nb_erreurs: int
    date_import: datetime


class SuppressionImport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    uuid: str
