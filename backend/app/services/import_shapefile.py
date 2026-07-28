"""
Service d'import de shapefiles (polygones) vers PostGIS — SIGPA.

Chaîne de traitement :
  ZIP -> extraction sécurisée -> lecture GeoPandas -> reprojection EPSG:4326
      -> réparation des géométries -> MULTIPOLYGON -> insertion ligne à ligne
      (savepoint par entité) -> calcul superficie/périmètre en PostGIS.

Aucune erreur de ligne n'annule l'import complet (sauf options.ignorer_erreurs=False).
"""

from __future__ import annotations

import json
import logging
import math
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Iterable

import geopandas as gpd
from geoalchemy2.shape import from_shape
from shapely.geometry import MultiPolygon, Polygon
from shapely.geometry.base import BaseGeometry
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.models.zone_geographique import (
    ImportShapefile,
    StatutImport,
    TypeZone,
    ZoneGeographique,
)
from app.schemas.zone_geographique import ErreurLigne, OptionsImport, RapportImport

logger = logging.getLogger(__name__)

TAILLE_MAX_ARCHIVE = 200 * 1024 * 1024  # 200 Mo compressés
TAILLE_MAX_DECOMPRESSEE = 1024 * 1024 * 1024  # 1 Go (garde-fou anti zip-bomb)
EXTENSIONS_AUTORISEES = {
    ".shp",
    ".shx",
    ".dbf",
    ".prj",
    ".cpg",
    ".qpj",
    ".sbn",
    ".sbx",
    ".xml",
    ".qmd",
}

# Détection automatique des colonnes (comparaison en minuscules, sans accents)
CANDIDATS_NOM = [
    "nom",
    "nom_fr",
    "nom_zone",
    "nom_parc",
    "libelle",
    "designation",
    "intitule",
    "name",
    "name_0",
    "name_1",
    "name_2",
    "admin",
    "shapename",
    "nam",
    "wdpa_name",
    "territory1",
    "geoname",
    "province",
    "region",
]
CANDIDATS_CODE = [
    "code",
    "code_zone",
    "code_iso",
    "insee",
    "cod",
    "id_zone",
    "gid_0",
    "gid_1",
    "gid_2",
    "iso",
    "iso3",
    "iso_a3",
    "iso_sov1",
    "shapeiso",
    "hasc_1",
    "wdpaid",
    "mrgid",
]
CANDIDATS_PARENT = [
    "code_parent",
    "parent",
    "gid_0",
    "iso3",
    "iso_a3",
    "pays",
    "country",
    "adm0_a3",
]
CANDIDATS_NIVEAU = ["niveau", "level", "adm_level", "hierarchy"]


class ErreurImportShapefile(Exception):
    """Erreur bloquante : l'archive est inexploitable."""


# --------------------------------------------------------------------------
# Extraction
# --------------------------------------------------------------------------
def _extraire_archive(chemin_zip: Path, dossier: Path) -> None:
    if not zipfile.is_zipfile(chemin_zip):
        raise ErreurImportShapefile(
            "Le fichier fourni n'est pas une archive ZIP valide."
        )

    with zipfile.ZipFile(chemin_zip) as archive:
        total = 0
        membres = []
        for info in archive.infolist():
            if info.is_dir():
                continue
            nom = Path(info.filename)
            if nom.is_absolute() or ".." in nom.parts:
                raise ErreurImportShapefile(
                    f"Chemin non autorisé dans l'archive : {info.filename}"
                )
            if nom.suffix.lower() not in EXTENSIONS_AUTORISEES:
                continue  # on ignore silencieusement les fichiers parasites
            total += info.file_size
            if total > TAILLE_MAX_DECOMPRESSEE:
                raise ErreurImportShapefile(
                    "Archive trop volumineuse une fois décompressée (limite : 1 Go)."
                )
            membres.append(info)

        if not membres:
            raise ErreurImportShapefile(
                "Archive vide ou ne contenant aucun composant de shapefile."
            )
        archive.extractall(dossier, members=membres)


def _localiser_shp(dossier: Path, nom_couche: str | None) -> Path:
    shp_trouves = sorted(dossier.rglob("*.shp")) + sorted(dossier.rglob("*.SHP"))
    if not shp_trouves:
        raise ErreurImportShapefile("Aucun fichier .shp trouvé dans l'archive.")

    if nom_couche:
        cible = nom_couche.lower().removesuffix(".shp")
        for chemin in shp_trouves:
            if chemin.stem.lower() == cible:
                shp = chemin
                break
        else:
            dispo = ", ".join(c.stem for c in shp_trouves)
            raise ErreurImportShapefile(
                f"Couche « {nom_couche} » introuvable. Couches disponibles : {dispo}."
            )
    elif len(shp_trouves) > 1:
        dispo = ", ".join(c.stem for c in shp_trouves)
        raise ErreurImportShapefile(
            f"L'archive contient plusieurs couches ({dispo}). "
            "Précisez « nom_couche » dans les options."
        )
    else:
        shp = shp_trouves[0]

    for ext in (".shx", ".dbf"):
        if not any(shp.with_suffix(v).exists() for v in (ext, ext.upper())):
            raise ErreurImportShapefile(
                f"Composant obligatoire manquant : {shp.stem}{ext}. "
                "Le ZIP doit contenir au minimum .shp, .shx et .dbf (et .prj)."
            )
    return shp


# --------------------------------------------------------------------------
# Lecture / normalisation
# --------------------------------------------------------------------------
def _lire_couche(shp: Path, options: OptionsImport) -> gpd.GeoDataFrame:
    encodages = (
        [options.encodage] if options.encodage else ["utf-8", "latin-1", "cp1252"]
    )
    derniere = None
    for enc in encodages:
        try:
            gdf = gpd.read_file(shp, encoding=enc)
            break
        except UnicodeDecodeError as exc:
            derniere = exc
            continue
        except Exception as exc:  # noqa: BLE001 — remonté proprement à l'appelant
            raise ErreurImportShapefile(
                f"Lecture du shapefile impossible : {exc}"
            ) from exc
    else:
        raise ErreurImportShapefile(
            f"Encodage du fichier .dbf non reconnu ({derniere}). "
            "Précisez « encodage » dans les options."
        )

    if gdf.empty:
        raise ErreurImportShapefile("La couche ne contient aucune entité.")

    if gdf.crs is None:
        if not options.crs_source:
            raise ErreurImportShapefile(
                "Système de coordonnées absent (.prj manquant). "
                "Précisez « crs_source », par exemple EPSG:4326 ou EPSG:32732."
            )
        gdf = gdf.set_crs(options.crs_source, allow_override=True)

    if gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs(epsg=4326)

    return gdf


def _normaliser(nom: str) -> str:
    remplacements = {
        "é": "e",
        "è": "e",
        "ê": "e",
        "à": "a",
        "ç": "c",
        "ô": "o",
        "û": "u",
    }
    resultat = nom.strip().lower()
    for source, cible in remplacements.items():
        resultat = resultat.replace(source, cible)
    return resultat.replace(" ", "_").replace("-", "_")


def _detecter(colonnes: Iterable[str], candidats: list[str]) -> str | None:
    index = {_normaliser(c): c for c in colonnes}
    for candidat in candidats:
        if candidat in index:
            return index[candidat]
    # repli : correspondance partielle
    for candidat in candidats:
        for normalise, original in index.items():
            if candidat in normalise:
                return original
    return None


def _construire_correspondance(
    colonnes: list[str], options: OptionsImport
) -> dict[str, str]:
    mapping = dict(options.correspondance)
    inconnues = [c for c in mapping.values() if c not in colonnes]
    if inconnues:
        raise ErreurImportShapefile(
            f"Colonnes absentes du shapefile : {', '.join(inconnues)}. "
            f"Colonnes disponibles : {', '.join(colonnes)}."
        )

    mapping.setdefault("nom", _detecter(colonnes, CANDIDATS_NOM) or "")
    mapping.setdefault("code", _detecter(colonnes, CANDIDATS_CODE) or "")
    mapping.setdefault("code_parent", _detecter(colonnes, CANDIDATS_PARENT) or "")
    mapping.setdefault("niveau", _detecter(colonnes, CANDIDATS_NIVEAU) or "")
    mapping = {k: v for k, v in mapping.items() if v}

    if "nom" not in mapping:
        raise ErreurImportShapefile(
            "Impossible d'identifier la colonne du nom. "
            f'Indiquez-la via correspondance, ex. {{"nom": "NAME_1"}}. '
            f"Colonnes disponibles : {', '.join(colonnes)}."
        )
    return mapping


def _en_multipolygone(geom: BaseGeometry | None) -> MultiPolygon:
    if geom is None or geom.is_empty:
        raise ValueError("Géométrie vide ou absente.")

    if not geom.is_valid:
        geom = geom.buffer(0)
        if not geom.is_valid or geom.is_empty:
            raise ValueError("Géométrie invalide et non réparable (auto-intersection).")

    if isinstance(geom, Polygon):
        return MultiPolygon([geom])
    if isinstance(geom, MultiPolygon):
        return geom

    # GeometryCollection : on ne garde que les composants surfaciques
    parties = [
        g for g in getattr(geom, "geoms", []) if isinstance(g, (Polygon, MultiPolygon))
    ]
    polygones: list[Polygon] = []
    for partie in parties:
        if isinstance(partie, Polygon):
            polygones.append(partie)
        else:
            polygones.extend(partie.geoms)
    if not polygones:
        raise ValueError(
            f"Type de géométrie non surfacique : {geom.geom_type}. "
            "Seuls les polygones sont acceptés."
        )
    return MultiPolygon(polygones)


def _valeur(ligne: Any, colonne: str | None) -> str | None:
    if not colonne:
        return None
    valeur = ligne.get(colonne)
    if valeur is None:
        return None
    if isinstance(valeur, float) and math.isnan(valeur):
        return None
    texte = str(valeur).strip()
    return texte or None


def _attributs_bruts(ligne: dict[str, Any], colonne_geom: str) -> dict[str, Any]:
    resultat: dict[str, Any] = {}
    for cle, valeur in ligne.items():
        if cle == colonne_geom:
            continue
        if valeur is None or (isinstance(valeur, float) and math.isnan(valeur)):
            resultat[cle] = None
        elif isinstance(valeur, (str, int, float, bool)):
            resultat[cle] = valeur
        else:
            resultat[cle] = str(valeur)
    return resultat


# --------------------------------------------------------------------------
# Point d'entrée
# --------------------------------------------------------------------------
def importer_shapefile(
    db: Session,
    contenu_zip: bytes,
    nom_fichier: str,
    type_zone: TypeZone,
    options: OptionsImport | None = None,
    utilisateur_id: int | None = None,
) -> RapportImport:
    options = options or OptionsImport()

    if len(contenu_zip) > TAILLE_MAX_ARCHIVE:
        raise ErreurImportShapefile("Archive trop volumineuse (limite : 200 Mo).")

    trace = ImportShapefile(
        type_zone=type_zone,
        nom_fichier=nom_fichier,
        statut=StatutImport.EN_COURS,
        user_id=utilisateur_id,
    )
    db.add(trace)
    db.flush()  # récupère trace.id sans committer

    erreurs: list[ErreurLigne] = []

    try:
        with tempfile.TemporaryDirectory(prefix="sigpa_shp_") as tmp:
            dossier = Path(tmp)
            chemin_zip = dossier / "archive.zip"
            chemin_zip.write_bytes(contenu_zip)

            extraction = dossier / "extrait"
            extraction.mkdir()
            _extraire_archive(chemin_zip, extraction)

            shp = _localiser_shp(extraction, options.nom_couche)
            gdf = _lire_couche(shp, options)

            colonne_geom = gdf.geometry.name
            colonnes = [c for c in gdf.columns if c != colonne_geom]
            mapping = _construire_correspondance(colonnes, options)

            trace.nom_couche = shp.stem
            trace.crs_source = str(options.crs_source or gdf.crs)
            trace.nb_entites_total = len(gdf)
            trace.correspondance = mapping

            if options.remplacer:
                supprimees = (
                    db.query(ZoneGeographique)
                    .filter(ZoneGeographique.type_zone == type_zone)
                    .delete(synchronize_session=False)
                )
                logger.info(
                    "Remplacement %s : %s zones supprimées", type_zone, supprimees
                )

            importees = 0
            for position, (_, ligne) in enumerate(gdf.iterrows(), start=1):
                donnees = ligne.to_dict()
                identifiant = (
                    _valeur(donnees, mapping.get("nom")) or f"ligne {position}"
                )
                point_sauvegarde = db.begin_nested()
                try:
                    geometrie = _en_multipolygone(donnees.get(colonne_geom))

                    nom = _valeur(donnees, mapping.get("nom"))
                    if not nom:
                        raise ValueError(
                            f"Nom vide (colonne « {mapping.get('nom')} »)."
                        )

                    niveau_brut = _valeur(donnees, mapping.get("niveau"))
                    try:
                        niveau = int(float(niveau_brut)) if niveau_brut else None
                    except ValueError:
                        niveau = None

                    zone = ZoneGeographique(
                        import_id=trace.id,
                        type_zone=type_zone,
                        nom=nom[:255],
                        code=(_valeur(donnees, mapping.get("code")) or None),
                        nom_alternatif=_valeur(donnees, mapping.get("nom_alternatif")),
                        code_parent=(
                            _valeur(donnees, mapping.get("code_parent"))
                            or options.code_parent_defaut
                        ),
                        niveau=niveau,
                        attributs=_attributs_bruts(donnees, colonne_geom),
                        geom=from_shape(geometrie, srid=4326),
                        actif=True,
                    )
                    if zone.code:
                        zone.code = zone.code[:60]

                    db.add(zone)
                    db.flush()
                    point_sauvegarde.commit()
                    importees += 1

                except Exception as exc:  # noqa: BLE001 — collecte ligne par ligne
                    point_sauvegarde.rollback()
                    message = str(exc)
                    if "uq_zone_type_code" in message:
                        message = (
                            "Code déjà présent pour ce type de zone "
                            "(utilisez remplacer=true pour réimporter la couche)."
                        )
                    erreurs.append(
                        ErreurLigne(
                            index=position,
                            identifiant=identifiant,
                            message=message[:500],
                        )
                    )
                    if not options.ignorer_erreurs:
                        raise ErreurImportShapefile(
                            f"Entité {position} ({identifiant}) : {message}"
                        ) from exc

            # Simplification optionnelle + métriques géodésiques, en une passe SQL.
            if options.tolerance_simplification:
                db.execute(
                    text(
                        "UPDATE zone_geographique "
                        "SET geom = ST_Multi(ST_CollectionExtract("
                        "        ST_MakeValid(ST_SimplifyPreserveTopology(geom, :tol)), 3)) "
                        "WHERE import_id = :import_id"
                    ),
                    {"tol": options.tolerance_simplification, "import_id": trace.id},
                )

            db.execute(
                text(
                    "UPDATE zone_geographique SET "
                    "  superficie_km2 = ROUND((ST_Area(geom::geography) / 1000000)::numeric, 4), "
                    "  perimetre_km  = ROUND((ST_Perimeter(geom::geography) / 1000)::numeric, 4) "
                    "WHERE import_id = :import_id"
                ),
                {"import_id": trace.id},
            )

            trace.nb_entites_importees = importees
            trace.nb_erreurs = len(erreurs)
            trace.rapport = {"erreurs": [e.model_dump() for e in erreurs]}
            trace.statut = (
                StatutImport.TERMINE
                if not erreurs
                else StatutImport.TERMINE_AVEC_ERREURS
            )
            trace.message = (
                f"{importees} entité(s) importée(s) sur {trace.nb_entites_total}."
            )
            db.commit()

    except ErreurImportShapefile as exc:
        db.rollback()
        trace = ImportShapefile(
            type_zone=type_zone,
            nom_fichier=nom_fichier,
            statut=StatutImport.ECHOUE,
            message=str(exc),
            user_id=utilisateur_id,
            rapport={"erreurs": [e.model_dump() for e in erreurs]},
        )
        db.add(trace)
        db.commit()
        db.refresh(trace)
        raise

    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.exception("Échec de l'import du shapefile %s", nom_fichier)
        raise ErreurImportShapefile(
            f"Erreur inattendue durant l'import : {exc}"
        ) from exc

    db.refresh(trace)
    return RapportImport(
        uuid=trace.uuid,
        type_zone=trace.type_zone,
        nom_fichier=trace.nom_fichier,
        nom_couche=trace.nom_couche,
        crs_source=trace.crs_source,
        statut=trace.statut,
        nb_entites_total=trace.nb_entites_total,
        nb_entites_importees=trace.nb_entites_importees,
        nb_erreurs=trace.nb_erreurs,
        correspondance=trace.correspondance,
        erreurs=erreurs,
        message=trace.message,
        date_import=trace.date_import,
    )


def analyser_archive(contenu_zip: bytes) -> dict[str, Any]:
    """Inspection sans écriture : couches, colonnes, CRS, nombre d'entités.

    Sert à alimenter l'écran de correspondance des colonnes côté Angular.
    """
    with tempfile.TemporaryDirectory(prefix="sigpa_shp_") as tmp:
        dossier = Path(tmp)
        chemin_zip = dossier / "archive.zip"
        chemin_zip.write_bytes(contenu_zip)
        extraction = dossier / "extrait"
        extraction.mkdir()
        _extraire_archive(chemin_zip, extraction)

        couches = []
        for shp in sorted(extraction.rglob("*.shp")):
            gdf = gpd.read_file(shp, rows=1)
            with_meta = gpd.read_file(shp, ignore_geometry=True)
            colonnes = [c for c in with_meta.columns]
            couches.append(
                {
                    "nom_couche": shp.stem,
                    "crs": str(gdf.crs) if gdf.crs else None,
                    "type_geometrie": (
                        str(gdf.geometry.iloc[0].geom_type) if not gdf.empty else None
                    ),
                    "nb_entites": len(with_meta),
                    "colonnes": colonnes,
                    "correspondance_suggeree": {
                        "nom": _detecter(colonnes, CANDIDATS_NOM),
                        "code": _detecter(colonnes, CANDIDATS_CODE),
                        "code_parent": _detecter(colonnes, CANDIDATS_PARENT),
                    },
                    "apercu": json.loads(with_meta.head(3).to_json(orient="records")),
                }
            )
        if not couches:
            raise ErreurImportShapefile("Aucun fichier .shp trouvé dans l'archive.")
        return {"couches": couches}
