"""
Endpoints SIGPA — couches géographiques (parcs aquatiques, ZEE, frontières).

Convention du projet : endpoints POST uniquement, session SQLAlchemy synchrone.
"""

import json
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session

from app.database import get_db  # <-- à adapter
from app.auth import get_current_active_user  # <-- à adapter
from app.models.zone_geographique import (
    ImportShapefile,
    StatutImport,
    TypeZone,
    ZoneGeographique,
)
from app.schemas.zone_geographique import (
    FiltreZones,
    ImportResume,
    ListeZones,
    OptionsImport,
    RapportImport,
    RequeteGeoJSON,
    RequetePoint,
    SuppressionImport,
    ZoneResume,
)
from app.services.import_shapefile import (
    ErreurImportShapefile,
    analyser_archive,
    importer_shapefile,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/zones", tags=["Zones géographiques"])


def _parser_options(options_json: str | None) -> OptionsImport:
    if not options_json:
        return OptionsImport()
    try:
        return OptionsImport.model_validate(json.loads(options_json))
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Le champ « options » n'est pas un JSON valide : {exc}",
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc


@router.post("/analyser", summary="Inspecter une archive avant import")
def analyser(fichier: UploadFile = File(...)):
    """Retourne couches, CRS, colonnes et correspondance suggérée. N'écrit rien."""
    try:
        return analyser_archive(fichier.file.read())
    except ErreurImportShapefile as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/importer",
    response_model=RapportImport,
    summary="Importer un shapefile de polygones",
)
def importer(
    fichier: UploadFile = File(..., description="Archive ZIP (.shp, .shx, .dbf, .prj)"),
    type_zone: TypeZone = Form(...),
    options: str | None = Form(
        default=None,
        description='JSON, ex. {"correspondance":{"nom":"NAME_1"},"remplacer":true}',
    ),
    db: Session = Depends(get_db),
    # utilisateur=Depends(get_current_active_user),
):
    if not (fichier.filename or "").lower().endswith(".zip"):
        raise HTTPException(
            status_code=400,
            detail="Envoyez le shapefile sous forme d'archive ZIP contenant "
            "au minimum les fichiers .shp, .shx, .dbf et .prj.",
        )

    opts = _parser_options(options)
    try:
        return importer_shapefile(
            db=db,
            contenu_zip=fichier.file.read(),
            nom_fichier=fichier.filename,
            type_zone=type_zone,
            options=opts,
            utilisateur_id=1,
            # utilisateur_id=getattr(utilisateur, "id", None),
        )
    except ErreurImportShapefile as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("Import shapefile en échec")
        raise HTTPException(
            status_code=500, detail="Erreur interne durant l'import du shapefile."
        ) from exc


@router.post("/liste", response_model=ListeZones, summary="Lister les zones")
def lister(filtre: FiltreZones, db: Session = Depends(get_db)):
    requete = db.query(ZoneGeographique)

    if filtre.type_zone:
        requete = requete.filter(ZoneGeographique.type_zone == filtre.type_zone)
    if filtre.types_zone:
        requete = requete.filter(ZoneGeographique.type_zone.in_(filtre.types_zone))
    if filtre.code_parent:
        requete = requete.filter(ZoneGeographique.code_parent == filtre.code_parent)
    if filtre.actif is not None:
        requete = requete.filter(ZoneGeographique.actif == filtre.actif)
    if filtre.recherche:
        motif = f"%{filtre.recherche.strip()}%"
        requete = requete.filter(
            or_(ZoneGeographique.nom.ilike(motif), ZoneGeographique.code.ilike(motif))
        )

    total = requete.count()
    resultats = (
        requete.order_by(ZoneGeographique.type_zone, ZoneGeographique.nom)
        .offset((filtre.page - 1) * filtre.taille_page)
        .limit(filtre.taille_page)
        .all()
    )
    return ListeZones(
        total=total,
        page=filtre.page,
        taille_page=filtre.taille_page,
        resultats=[ZoneResume.model_validate(z) for z in resultats],
    )


@router.post("/geojson", summary="FeatureCollection pour la carte Leaflet")
def geojson(requete: RequeteGeoJSON, db: Session = Depends(get_db)):
    """Génère le GeoJSON directement en PostGIS (aucune sérialisation Python)."""
    conditions = ["actif = TRUE"]
    params: dict = {"limite": requete.limite}

    if requete.type_zone:
        conditions.append("type_zone = :type_zone")
        params["type_zone"] = requete.type_zone.value
    if requete.types_zone:
        conditions.append("type_zone = ANY(:types_zone)")
        params["types_zone"] = [t.value for t in requete.types_zone]
    if requete.ids:
        conditions.append("id = ANY(:ids)")
        params["ids"] = requete.ids
    if requete.bbox:
        conditions.append("geom && ST_MakeEnvelope(:o, :s, :e, :n, 4326)")
        params.update(dict(zip(["o", "s", "e", "n"], requete.bbox)))

    if requete.tolerance:
        expression_geom = "ST_SimplifyPreserveTopology(geom, :tol)"
        params["tol"] = requete.tolerance
    else:
        expression_geom = "geom"

    sql = text(f"""
        WITH selection AS (
            SELECT id, type_zone, code, nom, code_parent, niveau,
                   superficie_km2, {expression_geom} AS geom
            FROM zone_geographique
            WHERE {' AND '.join(conditions)}
            ORDER BY nom
            LIMIT :limite
        )
        SELECT jsonb_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(jsonb_agg(
                jsonb_build_object(
                    'type', 'Feature',
                    'id', id,
                    'geometry', ST_AsGeoJSON(geom)::jsonb,
                    'properties', jsonb_build_object(
                        'id', id,
                        'type_zone', type_zone,
                        'code', code,
                        'nom', nom,
                        'code_parent', code_parent,
                        'niveau', niveau,
                        'superficie_km2', superficie_km2
                    )
                )
            ), '[]'::jsonb)
        ) AS fc
        FROM selection
        """)
    return db.execute(sql, params).scalar_one()


@router.post("/localiser", summary="Zones contenant un point (lat/lon)")
def localiser(requete: RequetePoint, db: Session = Depends(get_db)):
    """Utile pour rattacher un débarquement ou une capture à un parc / à la ZEE."""
    sql = text("""
        SELECT id, type_zone, code, nom, code_parent, superficie_km2
        FROM zone_geographique
        WHERE actif = TRUE
          AND (:tous OR type_zone = ANY(:types))
          AND ST_Intersects(geom, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
        ORDER BY superficie_km2 NULLS LAST
        """)
    types = [t.value for t in (requete.types_zone or [])]
    lignes = (
        db.execute(
            sql,
            {
                "lon": requete.longitude,
                "lat": requete.latitude,
                "types": types or [""],
                "tous": not types,
            },
        )
        .mappings()
        .all()
    )
    return {"nb_resultats": len(lignes), "zones": [dict(l) for l in lignes]}


@router.post(
    "/imports/liste",
    response_model=list[ImportResume],
    summary="Historique des imports",
)
def lister_imports(db: Session = Depends(get_db), _=Depends(get_current_active_user)):
    imports = (
        db.query(ImportShapefile)
        .order_by(ImportShapefile.date_import.desc())
        .limit(100)
        .all()
    )
    return [ImportResume.model_validate(i) for i in imports]


@router.post("/imports/supprimer", summary="Annuler un import (cascade)")
def supprimer_import(
    requete: SuppressionImport,
    db: Session = Depends(get_db),
    _=Depends(get_current_active_user),
):
    trace = (
        db.query(ImportShapefile).filter(ImportShapefile.uuid == requete.uuid).first()
    )
    if not trace:
        raise HTTPException(status_code=404, detail="Import introuvable.")

    nb = (
        db.query(ZoneGeographique)
        .filter(ZoneGeographique.import_id == trace.id)
        .delete(synchronize_session=False)
    )
    db.delete(trace)
    db.commit()
    return {
        "succes": True,
        "nb_zones_supprimees": nb,
        "message": f"{nb} zone(s) supprimée(s).",
    }


@router.post("/statistiques", summary="Compteurs par type de couche")
def statistiques(db: Session = Depends(get_db)):
    lignes = (
        db.query(
            ZoneGeographique.type_zone,
            func.count(ZoneGeographique.id),
            func.sum(ZoneGeographique.superficie_km2),
        )
        .filter(ZoneGeographique.actif.is_(True))
        .group_by(ZoneGeographique.type_zone)
        .all()
    )
    return {
        "couches": [
            {
                "type_zone": t.value if hasattr(t, "value") else t,
                "nb_zones": n,
                "superficie_totale_km2": round(float(s), 2) if s else 0.0,
            }
            for t, n, s in lignes
        ]
    }
