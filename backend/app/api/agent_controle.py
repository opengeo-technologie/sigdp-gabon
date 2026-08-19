"""
SIGPA — Module Surveillance : router des agents de surveillance (POST-only).

Référentiel : fonctions, organismes et agents. Sert de source pour les champs
« chef de mission », « agents » et « agent contrôleur » du module surveillance.

Branchement dans main.py :
    from surveillance_agents_router import router as agents_router
    app.include_router(agents_router)
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.surveillance import FonctionAgent, OrganismeAgent, AgentSurveillance
import app.schemas.agents_controle as sch
from app.schemas.surveillance import IdIn  # {id: int} déjà défini dans le module

router = APIRouter(prefix="/api/agents-controle", tags=["Surveillance - Agents"])


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


def _nb_agents(db: Session, colonne, valeur: int) -> int:
    return (
        db.query(func.count(AgentSurveillance.id)).filter(colonne == valeur).scalar()
        or 0
    )


# =========================================================================
#  FONCTIONS
# =========================================================================
@router.post("/fonctions/create", response_model=sch.FonctionOut)
def creer_fonction(payload: sch.FonctionCreate, db: Session = Depends(get_db)):
    f = FonctionAgent(libelle=payload.libelle)
    db.add(f)
    db.commit()
    db.refresh(f)
    return sch.FonctionOut.model_validate(f)


@router.post("/fonctions/update", response_model=sch.FonctionOut)
def modifier_fonction(payload: sch.FonctionUpdate, db: Session = Depends(get_db)):
    f = _get_or_404(db, FonctionAgent, payload.id, "Fonction")
    f.libelle = payload.libelle
    db.commit()
    db.refresh(f)
    out = sch.FonctionOut.model_validate(f)
    out.nb_agents = _nb_agents(db, AgentSurveillance.fonction_id, f.id)
    return out


@router.post("/fonctions/list", response_model=List[sch.FonctionOut])
def lister_fonctions(
    filtre: sch.RefFiltre = sch.RefFiltre(), db: Session = Depends(get_db)
):
    q = db.query(FonctionAgent)
    if filtre.q:
        q = q.filter(FonctionAgent.libelle.ilike(f"%{filtre.q}%"))
    rows = (
        q.order_by(FonctionAgent.libelle).offset(filtre.skip).limit(filtre.limit).all()
    )
    result = []
    for f in rows:
        out = sch.FonctionOut.model_validate(f)
        out.nb_agents = _nb_agents(db, AgentSurveillance.fonction_id, f.id)
        result.append(out)
    return result


@router.post("/fonctions/delete")
def supprimer_fonction(body: IdIn, db: Session = Depends(get_db)):
    f = _get_or_404(db, FonctionAgent, body.id, "Fonction")
    n = _nb_agents(db, AgentSurveillance.fonction_id, f.id)
    if n:
        raise HTTPException(
            status_code=400,
            detail=f"Suppression impossible : {n} agent(s) rattaché(s) à cette fonction.",
        )
    db.delete(f)
    db.commit()
    return {"ok": True, "message": "Fonction supprimée."}


# =========================================================================
#  ORGANISMES
# =========================================================================
@router.post("/organismes/create", response_model=sch.OrganismeOut)
def creer_organisme(payload: sch.OrganismeCreate, db: Session = Depends(get_db)):
    o = OrganismeAgent(libelle=payload.libelle, abbreviation=payload.abbreviation)
    db.add(o)
    db.commit()
    db.refresh(o)
    return sch.OrganismeOut.model_validate(o)


@router.post("/organismes/update", response_model=sch.OrganismeOut)
def modifier_organisme(payload: sch.OrganismeUpdate, db: Session = Depends(get_db)):
    o = _get_or_404(db, OrganismeAgent, payload.id, "Organisme")
    for k, v in payload.model_dump(exclude_unset=True, exclude={"id"}).items():
        setattr(o, k, v)
    db.commit()
    db.refresh(o)
    out = sch.OrganismeOut.model_validate(o)
    out.nb_agents = _nb_agents(db, AgentSurveillance.organisme_id, o.id)
    return out


@router.post("/organismes/list", response_model=List[sch.OrganismeOut])
def lister_organismes(
    filtre: sch.RefFiltre = sch.RefFiltre(), db: Session = Depends(get_db)
):
    q = db.query(OrganismeAgent)
    if filtre.q:
        like = f"%{filtre.q}%"
        q = q.filter(
            or_(
                OrganismeAgent.libelle.ilike(like),
                OrganismeAgent.abbreviation.ilike(like),
            )
        )
    rows = (
        q.order_by(OrganismeAgent.libelle).offset(filtre.skip).limit(filtre.limit).all()
    )
    result = []
    for o in rows:
        out = sch.OrganismeOut.model_validate(o)
        out.nb_agents = _nb_agents(db, AgentSurveillance.organisme_id, o.id)
        result.append(out)
    return result


@router.post("/organismes/delete")
def supprimer_organisme(body: IdIn, db: Session = Depends(get_db)):
    o = _get_or_404(db, OrganismeAgent, body.id, "Organisme")
    n = _nb_agents(db, AgentSurveillance.organisme_id, o.id)
    if n:
        raise HTTPException(
            status_code=400,
            detail=f"Suppression impossible : {n} agent(s) rattaché(s) à cet organisme.",
        )
    db.delete(o)
    db.commit()
    return {"ok": True, "message": "Organisme supprimé."}


# =========================================================================
#  AGENTS
# =========================================================================
def _agent_out(a: AgentSurveillance) -> sch.AgentOut:
    out = sch.AgentOut.model_validate(a)
    out.nom_complet = f"{a.nom} {a.prenom}".strip()
    if a.fonction:
        out.fonction_libelle = a.fonction.libelle
    if a.organisme:
        out.organisme_libelle = a.organisme.libelle
        out.organisme_abbreviation = a.organisme.abbreviation
    return out


def _verifier_matricule_unique(
    db: Session, matricule: str, exclure_id: int | None = None
):
    q = db.query(AgentSurveillance.id).filter(AgentSurveillance.matricule == matricule)
    if exclure_id is not None:
        q = q.filter(AgentSurveillance.id != exclure_id)
    if q.first():
        raise HTTPException(
            status_code=400, detail=f"Le matricule « {matricule} » existe déjà."
        )


@router.post("/agents/create", response_model=sch.AgentOut)
def creer_agent(payload: sch.AgentCreate, db: Session = Depends(get_db)):
    _verifier_matricule_unique(db, payload.matricule)
    if payload.fonction_id:
        _get_or_404(db, FonctionAgent, payload.fonction_id, "Fonction")
    if payload.organisme_id:
        _get_or_404(db, OrganismeAgent, payload.organisme_id, "Organisme")

    a = AgentSurveillance(
        matricule=payload.matricule,
        nom=payload.nom,
        prenom=payload.prenom,
        date_naissance=payload.date_naissance,
        fonction_id=payload.fonction_id,
        organisme_id=payload.organisme_id,
        contact_email=payload.contact_email,
        contact_telephone=payload.contact_telephone,
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _agent_out(a)


@router.post("/agents/update", response_model=sch.AgentOut)
def modifier_agent(payload: sch.AgentUpdate, db: Session = Depends(get_db)):
    a = _get_or_404(db, AgentSurveillance, payload.id, "Agent")
    data = payload.model_dump(exclude_unset=True, exclude={"id"})
    if "matricule" in data and data["matricule"]:
        _verifier_matricule_unique(db, data["matricule"], exclure_id=a.id)
    if data.get("fonction_id"):
        _get_or_404(db, FonctionAgent, data["fonction_id"], "Fonction")
    if data.get("organisme_id"):
        _get_or_404(db, OrganismeAgent, data["organisme_id"], "Organisme")
    for k, v in data.items():
        setattr(a, k, v)
    db.commit()
    db.refresh(a)
    return _agent_out(a)


@router.post("/agents/list", response_model=List[sch.AgentOut])
def lister_agents(
    filtre: sch.AgentFiltre = sch.AgentFiltre(), db: Session = Depends(get_db)
):
    q = db.query(AgentSurveillance)
    if filtre.fonction_id:
        q = q.filter(AgentSurveillance.fonction_id == filtre.fonction_id)
    if filtre.organisme_id:
        q = q.filter(AgentSurveillance.organisme_id == filtre.organisme_id)
    if filtre.q:
        like = f"%{filtre.q}%"
        q = q.filter(
            or_(
                AgentSurveillance.nom.ilike(like),
                AgentSurveillance.prenom.ilike(like),
                AgentSurveillance.matricule.ilike(like),
            )
        )
    rows = (
        q.order_by(AgentSurveillance.nom, AgentSurveillance.prenom)
        .offset(filtre.skip)
        .limit(filtre.limit)
        .all()
    )
    return [_agent_out(a) for a in rows]


@router.post("/agents/get", response_model=sch.AgentOut)
def detail_agent(body: IdIn, db: Session = Depends(get_db)):
    a = _get_or_404(db, AgentSurveillance, body.id, "Agent")
    return _agent_out(a)


@router.post("/agents/delete")
def supprimer_agent(body: IdIn, db: Session = Depends(get_db)):
    a = _get_or_404(db, AgentSurveillance, body.id, "Agent")
    db.delete(a)
    db.commit()
    return {"ok": True, "message": f"Agent {a.matricule} supprimé."}
