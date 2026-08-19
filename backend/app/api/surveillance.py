"""
SIGPA — Module Surveillance : router opérations / infractions / saisies (POST-only).

Chaîne : Mission ─▶ Opération ─▶ Infraction relevée ─▶ Saisie(s)

Branchement dans main.py :
    from surveillance_operations_router import router as operations_router
    app.include_router(operations_router)

⚠️ Ce périmètre remplace l'ancien module srv_* : ne pas monter
   surveillance_router.py simultanément (collisions de chemins).
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.surveillance import (
    MissionSurveillance,
    OperationSurveillance,
    InfractionSurveillance,
    SaisieInfraction,
    AgentSurveillance,
)

import app.schemas.surveillance as sch
from app.schemas.surveillance import IdIn

router = APIRouter(prefix="/api/surveillance", tags=["Surveillance - Opérations"])


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


def _operation_out(db: Session, o: OperationSurveillance) -> sch.OperationOut:
    out = sch.OperationOut.model_validate(o)
    out.nb_infractions = (
        db.query(func.count(InfractionSurveillance.id))
        .filter(InfractionSurveillance.operation_id == o.id)
        .scalar()
        or 0
    )
    return out


def _infraction_out(db: Session, i: InfractionSurveillance) -> sch.InfractionOut:
    out = sch.InfractionOut.model_validate(i)
    out.nb_saisies = (
        db.query(func.count(SaisieInfraction.id))
        .filter(SaisieInfraction.infraction_id == i.id)
        .scalar()
        or 0
    )
    return out


def _saisie_out(s: SaisieInfraction) -> sch.SaisieOut:
    out = sch.SaisieOut.model_validate(s)
    if s.agent:
        out.agent_matricule = s.agent.matricule
        out.agent_nom_complet = f"{s.agent.nom} {s.agent.prenom}".strip()
    return out


# =========================================================================
#  OPÉRATIONS
# =========================================================================
@router.post("/operations/create", response_model=sch.OperationOut)
def creer_operation(payload: sch.OperationCreate, db: Session = Depends(get_db)):
    _get_or_404(db, MissionSurveillance, payload.mission_id, "Mission")
    o = OperationSurveillance(**payload.model_dump())
    db.add(o)
    db.commit()
    db.refresh(o)
    return _operation_out(db, o)


@router.post("/operations/update", response_model=sch.OperationOut)
def modifier_operation(payload: sch.OperationUpdate, db: Session = Depends(get_db)):
    o = _get_or_404(db, OperationSurveillance, payload.id, "Opération")
    for k, v in payload.model_dump(exclude_unset=True, exclude={"id"}).items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    return _operation_out(db, o)


@router.post("/operations/list", response_model=List[sch.OperationOut])
def lister_operations(body: IdIn, db: Session = Depends(get_db)):
    """body.id = mission_id."""
    rows = (
        db.query(OperationSurveillance)
        .filter(OperationSurveillance.mission_id == body.id)
        .order_by(OperationSurveillance.date_operation.desc())
        .all()
    )
    return [_operation_out(db, o) for o in rows]


@router.post("/operations/get", response_model=sch.OperationDetailOut)
def detail_operation(body: IdIn, db: Session = Depends(get_db)):
    o = _get_or_404(db, OperationSurveillance, body.id, "Opération")
    infractions = (
        db.query(InfractionSurveillance)
        .filter(InfractionSurveillance.operation_id == o.id)
        .order_by(InfractionSurveillance.date_infraction.desc())
        .all()
    )
    out = sch.OperationDetailOut.model_validate(o)
    out.nb_infractions = len(infractions)
    out.infractions = [_infraction_out(db, i) for i in infractions]
    return out


@router.post("/operations/delete")
def supprimer_operation(body: IdIn, db: Session = Depends(get_db)):
    o = _get_or_404(db, OperationSurveillance, body.id, "Opération")
    # cascade applicative : infractions -> saisies
    inf_ids = [
        r[0]
        for r in db.query(InfractionSurveillance.id)
        .filter(InfractionSurveillance.operation_id == o.id)
        .all()
    ]
    if inf_ids:
        db.query(SaisieInfraction).filter(
            SaisieInfraction.infraction_id.in_(inf_ids)
        ).delete(synchronize_session=False)
        db.query(InfractionSurveillance).filter(
            InfractionSurveillance.operation_id == o.id
        ).delete(synchronize_session=False)
    db.delete(o)
    db.commit()
    return {
        "ok": True,
        "message": "Opération supprimée (infractions et saisies incluses).",
    }


# =========================================================================
#  INFRACTIONS
# =========================================================================
@router.post("/infractions/create", response_model=sch.InfractionOut)
def creer_infraction(payload: sch.InfractionCreate, db: Session = Depends(get_db)):
    _get_or_404(db, OperationSurveillance, payload.operation_id, "Opération")
    i = InfractionSurveillance(**payload.model_dump())
    db.add(i)
    db.commit()
    db.refresh(i)
    return _infraction_out(db, i)


@router.post("/infractions/update", response_model=sch.InfractionOut)
def modifier_infraction(payload: sch.InfractionUpdate, db: Session = Depends(get_db)):
    i = _get_or_404(db, InfractionSurveillance, payload.id, "Infraction")
    for k, v in payload.model_dump(exclude_unset=True, exclude={"id"}).items():
        setattr(i, k, v)
    db.commit()
    db.refresh(i)
    return _infraction_out(db, i)


@router.post("/infractions/list", response_model=List[sch.InfractionOut])
def lister_infractions(body: IdIn, db: Session = Depends(get_db)):
    """body.id = operation_id."""
    rows = (
        db.query(InfractionSurveillance)
        .filter(InfractionSurveillance.operation_id == body.id)
        .order_by(InfractionSurveillance.date_infraction.desc())
        .all()
    )
    return [_infraction_out(db, i) for i in rows]


@router.post("/infractions/get", response_model=sch.InfractionOut)
def detail_infraction(body: IdIn, db: Session = Depends(get_db)):
    i = _get_or_404(db, InfractionSurveillance, body.id, "Infraction")
    return _infraction_out(db, i)


@router.post("/infractions/delete")
def supprimer_infraction(body: IdIn, db: Session = Depends(get_db)):
    i = _get_or_404(db, InfractionSurveillance, body.id, "Infraction")
    db.query(SaisieInfraction).filter(SaisieInfraction.infraction_id == i.id).delete(
        synchronize_session=False
    )
    db.delete(i)
    db.commit()
    return {"ok": True, "message": "Infraction supprimée (saisies incluses)."}


# =========================================================================
#  SAISIES
# =========================================================================
@router.post("/saisies/create", response_model=sch.SaisieOut)
def creer_saisie(payload: sch.SaisieCreate, db: Session = Depends(get_db)):
    _get_or_404(db, InfractionSurveillance, payload.infraction_id, "Infraction")
    if payload.agent_id:
        _get_or_404(db, AgentSurveillance, payload.agent_id, "Agent")
    s = SaisieInfraction(**payload.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _saisie_out(s)


@router.post("/saisies/update", response_model=sch.SaisieOut)
def modifier_saisie(payload: sch.SaisieUpdate, db: Session = Depends(get_db)):
    s = _get_or_404(db, SaisieInfraction, payload.id, "Saisie")
    data = payload.model_dump(exclude_unset=True, exclude={"id"})
    if data.get("agent_id"):
        _get_or_404(db, AgentSurveillance, data["agent_id"], "Agent")
    for k, v in data.items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return _saisie_out(s)


@router.post("/saisies/list", response_model=List[sch.SaisieOut])
def lister_saisies(body: IdIn, db: Session = Depends(get_db)):
    """body.id = infraction_id (infractions_surveillance)."""
    rows = (
        db.query(SaisieInfraction)
        .filter(SaisieInfraction.infraction_id == body.id)
        .order_by(SaisieInfraction.date_saisie.desc())
        .all()
    )
    return [_saisie_out(s) for s in rows]


@router.post("/saisies/delete")
def supprimer_saisie(body: IdIn, db: Session = Depends(get_db)):
    s = _get_or_404(db, SaisieInfraction, body.id, "Saisie")
    db.delete(s)
    db.commit()
    return {"ok": True, "message": "Saisie supprimée."}
