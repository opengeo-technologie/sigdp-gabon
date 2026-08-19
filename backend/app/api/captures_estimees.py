"""
SIGPA — Module « Captures estimées »
Routeur FastAPI (convention plateforme : endpoints POST uniquement).

Montage :
    from .captures_estimees.router import router as captures_estimees_router
    app.include_router(captures_estimees_router)
"""

from __future__ import annotations
from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.services.captures_estimees_services import (
    export_services,
    main_services as service,
    import_captures_estimees_service as import_service_all,
)
from app.schemas import captures_estimees as schemas
from app.schemas.espece import EspeceResponse
from app.schemas.engin_peche import EnginPecheResponse
from app.database import get_db  # dépendance de session partagée

router = APIRouter(prefix="/api/captures-estimees", tags=["Captures estimées"])


# ---------------------------------------------------------------------------
# Référentiels
# ---------------------------------------------------------------------------
@router.post("/engins/list", response_model=list[EnginPecheResponse])
def lister_engins(db: Session = Depends(get_db)):
    return service.lister_engins(db)


@router.post("/especes/list", response_model=list[EspeceResponse])
def lister_especes(db: Session = Depends(get_db)):
    return service.lister_especes(db)


# ---------------------------------------------------------------------------
# Captures — CRUD
# ---------------------------------------------------------------------------
@router.post("/list", response_model=schemas.CaptureListe)
def lister(filtre: schemas.CaptureFiltre, db: Session = Depends(get_db)):
    return service.lister_captures(db, filtre)


@router.post("/get", response_model=schemas.CaptureOut)
def obtenir(req: schemas.IdRequete, db: Session = Depends(get_db)):
    c = service.get_capture(db, req.id)
    if c is None:
        raise HTTPException(404, "Capture estimée introuvable.")
    return schemas.CaptureOut.depuis_orm(c)


@router.post("/create", response_model=schemas.CaptureOut, status_code=201)
def creer(data: schemas.CaptureCreate, db: Session = Depends(get_db)):
    try:
        c = service.creer_capture(db, data)
    except ValueError as exc:
        raise HTTPException(409, str(exc))
    return schemas.CaptureOut.depuis_orm(c)


@router.post("/update", response_model=schemas.CaptureOut)
def modifier(
    req: schemas.IdRequete, data: schemas.CaptureUpdate, db: Session = Depends(get_db)
):
    # print("modifier", req.id, data)
    try:
        c = service.maj_capture(db, req.id, data)
    except LookupError as exc:
        raise HTTPException(404, str(exc))
    return schemas.CaptureOut.depuis_orm(c)


@router.post("/delete")
def supprimer(req: schemas.IdRequete, db: Session = Depends(get_db)):
    try:
        service.supprimer_capture(db, req.id)
    except LookupError as exc:
        raise HTTPException(404, str(exc))
    return {"succes": True, "message": "Capture estimée supprimée."}


# ---------------------------------------------------------------------------
# Efforts
# ---------------------------------------------------------------------------
@router.post("/efforts/upsert", response_model=schemas.EffortOut)
def upsert_effort(data: schemas.EffortUpsert, db: Session = Depends(get_db)):
    e = service.upsert_effort(db, data)
    for o in service.lister_efforts(db, e.annee, e.engin_id):
        if (
            o.mois == data.mois
        ):  # renvoie l'occurrence du mois enregistré (CPUE incluse)
            return o
    raise HTTPException(500, "Effort enregistré mais illisible.")


@router.post("/efforts/list", response_model=list[schemas.EffortOut])
def lister_efforts(req: schemas.StatsRequete, db: Session = Depends(get_db)):
    return service.lister_efforts(db, req.annee, req.engin_id)


# ---------------------------------------------------------------------------
# Statistiques (Chart.js)
# ---------------------------------------------------------------------------
@router.post("/stats")
def statistiques(req: schemas.StatsRequete, db: Session = Depends(get_db)):
    return service.statistiques(db, req)


# ---------------------------------------------------------------------------
# Import Excel (multipart) — gestion d'erreurs ligne par ligne
# ---------------------------------------------------------------------------
@router.post("/import-excel")
async def importer(
    fichier: UploadFile = File(...),
    annee: int = Form(...),
    db: Session = Depends(get_db),
):
    if not (fichier.filename or "").lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(400, "Format attendu : classeur Excel (.xlsx).")
    contenu = await fichier.read()
    try:
        return import_service_all.importer_classeur(db, contenu, fichier.filename)
    except Exception as exc:  # erreur globale (fichier corrompu, etc.)
        db.rollback()
        raise HTTPException(422, f"Import impossible : {exc}")


# ---------------------------------------------------------------------------
# Export multi-format
# ---------------------------------------------------------------------------
@router.post("/export")
def exporter(req: schemas.ExportRequete, db: Session = Depends(get_db)):
    contenu, media_type, nom = export_services.exporter(db, req)
    return Response(
        content=contenu,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{nom}"'},
    )
