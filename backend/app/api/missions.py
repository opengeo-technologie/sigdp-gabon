"""
SIGPA — Module Surveillance : router missions / équipes / rapports (POST-only).

Branchement dans main.py :
    from surveillance_missions_router import router as missions_router
    app.include_router(missions_router)

Le référentiel des agents (surveillance_agents_router) doit être monté également ;
les équipes lient une mission aux agents de ce référentiel.
"""

import os
import uuid
import shutil
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.surveillance import (
    MissionSurveillance,
    EquipeSurveillance,
    RapportSurveillance,
    AgentSurveillance,
)
import app.schemas.missions as sch
from app.schemas.surveillance import IdIn

router = APIRouter(prefix="/api/missions-controle", tags=["Surveillance - Missions"])

# Emplacement des documents scannés (adapter au déploiement / config projet)
MEDIA_ROOT = os.getenv("MEDIA_ROOT", "media")
SCAN_SUBDIR = "rapports_surveillance"
MEDIA_URL_PREFIX = "/media"


# =========================================================================
#  Helpers
# =========================================================================
def _get_or_404(db: Session, model, obj_id: int, label: str):
    obj = db.query(model).filter(model.id == obj_id).first()
    if not obj:
        raise HTTPException(
            status_code=404, detail=f"{label} introuvable (id={obj_id})."
        )
    return obj


def _mission_counts(db: Session, mission_id: int) -> tuple[int, int]:
    nb_m = (
        db.query(func.count(EquipeSurveillance.id))
        .filter(EquipeSurveillance.mission_id == mission_id)
        .scalar()
        or 0
    )
    nb_r = (
        db.query(func.count(RapportSurveillance.id))
        .filter(RapportSurveillance.mission_id == mission_id)
        .scalar()
        or 0
    )
    return nb_m, nb_r


def _mission_out(db: Session, m: MissionSurveillance) -> sch.MissionOut:
    out = sch.MissionOut.model_validate(m)
    out.nb_membres, out.nb_rapports = _mission_counts(db, m.id)
    return out


def _equipe_out(e: EquipeSurveillance) -> sch.EquipeOut:
    out = sch.EquipeOut.model_validate(e)
    a = e.agent
    if a:
        out.matricule = a.matricule
        out.nom_complet = f"{a.nom} {a.prenom}".strip()
        if a.fonction:
            out.fonction_libelle = a.fonction.libelle
        if a.organisme:
            out.organisme_abbreviation = a.organisme.abbreviation
    return out


# =========================================================================
#  MISSIONS
# =========================================================================
@router.post("/missions/create", response_model=sch.MissionOut)
def creer_mission(payload: sch.MissionCreate, db: Session = Depends(get_db)):
    m = MissionSurveillance(**payload.model_dump())
    db.add(m)
    db.commit()
    db.refresh(m)
    return _mission_out(db, m)


@router.post("/missions/update", response_model=sch.MissionOut)
def modifier_mission(payload: sch.MissionUpdate, db: Session = Depends(get_db)):
    m = _get_or_404(db, MissionSurveillance, payload.id, "Mission")
    for k, v in payload.model_dump(exclude_unset=True, exclude={"id"}).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return _mission_out(db, m)


@router.post("/missions/list", response_model=List[sch.MissionOut])
def lister_missions(
    filtre: sch.MissionFiltre = sch.MissionFiltre(), db: Session = Depends(get_db)
):
    q = db.query(MissionSurveillance)
    if filtre.type_mission:
        q = q.filter(MissionSurveillance.type_mission == filtre.type_mission)
    if filtre.date_debut:
        q = q.filter(MissionSurveillance.date_depart >= filtre.date_debut)
    if filtre.date_fin:
        q = q.filter(MissionSurveillance.date_depart <= filtre.date_fin)
    if filtre.q:
        like = f"%{filtre.q}%"
        q = q.filter(
            or_(
                MissionSurveillance.lieu_mission.ilike(like),
                MissionSurveillance.moyen_controle.ilike(like),
            )
        )
    rows = (
        q.order_by(MissionSurveillance.date_depart.desc())
        .offset(filtre.skip)
        .limit(filtre.limit)
        .all()
    )
    return [_mission_out(db, m) for m in rows]


@router.post("/missions/get", response_model=sch.MissionDetailOut)
def detail_mission(body: IdIn, db: Session = Depends(get_db)):
    m = _get_or_404(db, MissionSurveillance, body.id, "Mission")
    membres = (
        db.query(EquipeSurveillance)
        .filter(EquipeSurveillance.mission_id == m.id)
        .order_by(EquipeSurveillance.id)
        .all()
    )
    rapports = (
        db.query(RapportSurveillance)
        .filter(RapportSurveillance.mission_id == m.id)
        .order_by(RapportSurveillance.date_rapport.desc())
        .all()
    )
    out = sch.MissionDetailOut.model_validate(m)
    out.nb_membres, out.nb_rapports = len(membres), len(rapports)
    out.membres = [_equipe_out(e) for e in membres]
    out.rapports = [sch.RapportOut.model_validate(r) for r in rapports]
    return out


@router.post("/missions/delete")
def supprimer_mission(body: IdIn, db: Session = Depends(get_db)):
    m = _get_or_404(db, MissionSurveillance, body.id, "Mission")
    # cascade applicative (pas d'ON DELETE CASCADE sur les FK)
    db.query(EquipeSurveillance).filter(EquipeSurveillance.mission_id == m.id).delete()
    db.query(RapportSurveillance).filter(
        RapportSurveillance.mission_id == m.id
    ).delete()
    db.delete(m)
    db.commit()
    return {"ok": True, "message": "Mission supprimée (équipe et rapports inclus)."}


@router.post("/missions/upload-rapport-scan")
def uploader_rapport_scan(
    mission_id: int = Form(...),
    fichier: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Téléverse le scan du rapport et met à jour `rapport_scan` de la mission."""
    m = _get_or_404(db, MissionSurveillance, mission_id, "Mission")
    ext = os.path.splitext(fichier.filename or "")[1].lower()
    if ext not in {".pdf", ".jpg", ".jpeg", ".png"}:
        raise HTTPException(status_code=400, detail="Format accepté : PDF, JPG ou PNG.")
    dossier = os.path.join(MEDIA_ROOT, SCAN_SUBDIR)
    os.makedirs(dossier, exist_ok=True)
    nom_fichier = f"mission_{mission_id}_{uuid.uuid4().hex[:8]}{ext}"
    chemin_disque = os.path.join(dossier, nom_fichier)
    with open(chemin_disque, "wb") as buffer:
        shutil.copyfileobj(fichier.file, buffer)
    m.rapport_scan = f"{MEDIA_URL_PREFIX}/{SCAN_SUBDIR}/{nom_fichier}"
    db.commit()
    return {"ok": True, "rapport_scan": m.rapport_scan}


# =========================================================================
#  ÉQUIPES (membres)
# =========================================================================
@router.post("/equipes/add", response_model=sch.EquipeOut)
def ajouter_membre(payload: sch.EquipeCreate, db: Session = Depends(get_db)):
    _get_or_404(db, MissionSurveillance, payload.mission_id, "Mission")
    _get_or_404(db, AgentSurveillance, payload.agent_id, "Agent")
    existe = (
        db.query(EquipeSurveillance.id)
        .filter(
            EquipeSurveillance.mission_id == payload.mission_id,
            EquipeSurveillance.agent_id == payload.agent_id,
        )
        .first()
    )
    if existe:
        raise HTTPException(
            status_code=400, detail="Cet agent fait déjà partie de l'équipe."
        )
    e = EquipeSurveillance(
        mission_id=payload.mission_id,
        agent_id=payload.agent_id,
        role_agent=payload.role_agent,
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _equipe_out(e)


@router.post("/equipes/add-bulk", response_model=List[sch.EquipeOut])
def ajouter_membres(payload: sch.EquipeBulkCreate, db: Session = Depends(get_db)):
    _get_or_404(db, MissionSurveillance, payload.mission_id, "Mission")
    deja = {
        r[0]
        for r in db.query(EquipeSurveillance.agent_id)
        .filter(EquipeSurveillance.mission_id == payload.mission_id)
        .all()
    }
    crees = []
    for agent_id in payload.agent_ids:
        if agent_id in deja:
            continue
        if (
            not db.query(AgentSurveillance.id)
            .filter(AgentSurveillance.id == agent_id)
            .first()
        ):
            continue
        e = EquipeSurveillance(
            mission_id=payload.mission_id,
            agent_id=agent_id,
            role_agent=payload.role_agent,
        )
        db.add(e)
        crees.append(e)
        deja.add(agent_id)
    db.commit()
    for e in crees:
        db.refresh(e)
    return [_equipe_out(e) for e in crees]


@router.post("/equipes/update", response_model=sch.EquipeOut)
def modifier_membre(payload: sch.EquipeUpdate, db: Session = Depends(get_db)):
    e = _get_or_404(db, EquipeSurveillance, payload.id, "Membre d'équipe")
    if payload.role_agent is not None:
        e.role_agent = payload.role_agent
    db.commit()
    db.refresh(e)
    return _equipe_out(e)


@router.post("/equipes/list", response_model=List[sch.EquipeOut])
def lister_membres(body: IdIn, db: Session = Depends(get_db)):
    """body.id = mission_id."""
    rows = (
        db.query(EquipeSurveillance)
        .filter(EquipeSurveillance.mission_id == body.id)
        .order_by(EquipeSurveillance.id)
        .all()
    )
    return [_equipe_out(e) for e in rows]


@router.post("/equipes/remove")
def retirer_membre(body: IdIn, db: Session = Depends(get_db)):
    """body.id = id de la ligne d'équipe."""
    e = _get_or_404(db, EquipeSurveillance, body.id, "Membre d'équipe")
    db.delete(e)
    db.commit()
    return {"ok": True, "message": "Agent retiré de l'équipe."}


# =========================================================================
#  RAPPORTS
# =========================================================================
@router.post("/rapports/create", response_model=sch.RapportOut)
def creer_rapport(payload: sch.RapportCreate, db: Session = Depends(get_db)):
    _get_or_404(db, MissionSurveillance, payload.mission_id, "Mission")
    r = RapportSurveillance(
        mission_id=payload.mission_id,
        date_rapport=payload.date_rapport,
        contenu_rapport=payload.contenu_rapport,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return sch.RapportOut.model_validate(r)


@router.post("/rapports/update", response_model=sch.RapportOut)
def modifier_rapport(payload: sch.RapportUpdate, db: Session = Depends(get_db)):
    r = _get_or_404(db, RapportSurveillance, payload.id, "Rapport")
    for k, v in payload.model_dump(exclude_unset=True, exclude={"id"}).items():
        setattr(r, k, v)
    db.commit()
    db.refresh(r)
    return sch.RapportOut.model_validate(r)


@router.post("/rapports/list", response_model=List[sch.RapportOut])
def lister_rapports(body: IdIn, db: Session = Depends(get_db)):
    """body.id = mission_id."""
    rows = (
        db.query(RapportSurveillance)
        .filter(RapportSurveillance.mission_id == body.id)
        .order_by(RapportSurveillance.date_rapport.desc())
        .all()
    )
    return [sch.RapportOut.model_validate(r) for r in rows]


@router.post("/rapports/delete")
def supprimer_rapport(body: IdIn, db: Session = Depends(get_db)):
    r = _get_or_404(db, RapportSurveillance, body.id, "Rapport")
    db.delete(r)
    db.commit()
    return {"ok": True, "message": "Rapport supprimé."}
