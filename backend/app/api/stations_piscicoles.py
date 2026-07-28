# -*- coding: utf-8 -*-
"""
Router FastAPI — Module Stations Piscicoles (SIGDP-GABON)
Conventions : endpoints POST-only avec body JSON, SQLAlchemy synchrone.
Préfixe : /api/stations-piscicoles
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, extract
from sqlalchemy.orm import Session, joinedload

from app.database import get_db  # à ajuster selon l'arborescence
from app.models.stations_piscicole import (
    StationPiscicole,
    CycleProduction,
    StatutStationEnum,
    StatutCycleEnum,
    TRANSITIONS_STATUT_STATION,
)
from app.schemas.stations_piscicoles import (
    StationPiscicoleCreate,
    StationPiscicoleUpdate,
    StationPiscicoleRead,
    StationPiscicoleDetail,
    StationListRequest,
    StationListResponse,
    ChangerStatutRequest,
    IdRequest,
    MessageResponse,
    CycleProductionCreate,
    CycleProductionUpdate,
    CycleProductionRead,
    CycleRecolteRequest,
    CycleListRequest,
    CycleListResponse,
)

router = APIRouter(prefix="/api/stations-piscicoles", tags=["Stations piscicoles"])


# ---------------------------------------------------------------------------
# Helpers — génération de codes SP-2026-0001 / CY-2026-0001
# ---------------------------------------------------------------------------


def _generer_code(db: Session, model, prefixe: str, colonne) -> str:
    annee = datetime.utcnow().year
    motif = f"{prefixe}-{annee}-%"
    dernier = (
        db.query(colonne).filter(colonne.like(motif)).order_by(colonne.desc()).first()
    )
    if dernier:
        numero = int(dernier[0].split("-")[-1]) + 1
    else:
        numero = 1
    return f"{prefixe}-{annee}-{numero:04d}"


def _get_station_or_404(db: Session, station_id: int) -> StationPiscicole:
    station = (
        db.query(StationPiscicole).filter(StationPiscicole.id == station_id).first()
    )
    if not station:
        raise HTTPException(status_code=404, detail="Station piscicole introuvable")
    return station


def _get_cycle_or_404(db: Session, cycle_id: int) -> CycleProduction:
    cycle = db.query(CycleProduction).filter(CycleProduction.id == cycle_id).first()
    if not cycle:
        raise HTTPException(status_code=404, detail="Cycle de production introuvable")
    return cycle


# ---------------------------------------------------------------------------
# Stations — CRUD
# ---------------------------------------------------------------------------


@router.post("/list", response_model=StationListResponse)
def lister_stations(req: StationListRequest, db: Session = Depends(get_db)):
    query = db.query(StationPiscicole)

    if req.search:
        terme = f"%{req.search.strip()}%"
        query = query.filter(
            or_(
                StationPiscicole.nom.ilike(terme),
                StationPiscicole.code_station.ilike(terme),
                StationPiscicole.promoteur_nom.ilike(terme),
                StationPiscicole.localite.ilike(terme),
            )
        )
    if req.province:
        query = query.filter(StationPiscicole.province == req.province)
    if req.type_station:
        query = query.filter(StationPiscicole.type_station == req.type_station)
    if req.statut:
        query = query.filter(StationPiscicole.statut == req.statut)
    if req.espece:
        query = query.filter(StationPiscicole.especes_elevees.ilike(f"%{req.espece}%"))

    total = query.count()
    items = (
        query.order_by(StationPiscicole.created_at.desc())
        .offset((req.page - 1) * req.page_size)
        .limit(req.page_size)
        .all()
    )
    return StationListResponse(
        total=total, page=req.page, page_size=req.page_size, items=items
    )


@router.post("/get", response_model=StationPiscicoleDetail)
def obtenir_station(req: IdRequest, db: Session = Depends(get_db)):
    station = (
        db.query(StationPiscicole)
        .options(joinedload(StationPiscicole.cycles))
        .filter(StationPiscicole.id == req.id)
        .first()
    )
    if not station:
        raise HTTPException(status_code=404, detail="Station piscicole introuvable")
    return station


@router.post("/create", response_model=StationPiscicoleRead)
def creer_station(payload: StationPiscicoleCreate, db: Session = Depends(get_db)):
    station = StationPiscicole(**payload.model_dump())
    station.code_station = _generer_code(
        db, StationPiscicole, "SP", StationPiscicole.code_station
    )
    station.statut = StatutStationEnum.EN_CONSTRUCTION
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


@router.post("/update", response_model=StationPiscicoleRead)
def modifier_station(payload: StationPiscicoleUpdate, db: Session = Depends(get_db)):
    station = _get_station_or_404(db, payload.id)
    donnees = payload.model_dump(exclude_unset=True, exclude={"id"})
    for champ, valeur in donnees.items():
        setattr(station, champ, valeur)
    db.commit()
    db.refresh(station)
    return station


@router.post("/delete", response_model=MessageResponse)
def supprimer_station(req: IdRequest, db: Session = Depends(get_db)):
    station = _get_station_or_404(db, req.id)
    db.delete(station)  # cascade -> cycles supprimés
    db.commit()
    return MessageResponse(
        success=True, message=f"Station {station.code_station} supprimée"
    )


@router.post("/changer-statut", response_model=StationPiscicoleRead)
def changer_statut(req: ChangerStatutRequest, db: Session = Depends(get_db)):
    station = _get_station_or_404(db, req.id)
    transitions = TRANSITIONS_STATUT_STATION.get(station.statut, [])
    if req.nouveau_statut not in transitions:
        raise HTTPException(
            status_code=400,
            detail=f"Transition non autorisée : {station.statut.value} -> {req.nouveau_statut.value}",
        )
    station.statut = req.nouveau_statut
    if req.motif:
        horodatage = datetime.utcnow().strftime("%d/%m/%Y %H:%M")
        note = f"[{horodatage}] Changement de statut -> {req.nouveau_statut.value} : {req.motif}"
        station.observations = (
            f"{station.observations}\n{note}" if station.observations else note
        )
    db.commit()
    db.refresh(station)
    return station


# ---------------------------------------------------------------------------
# Cycles de production
# ---------------------------------------------------------------------------


@router.post("/cycles/list", response_model=CycleListResponse)
def lister_cycles(req: CycleListRequest, db: Session = Depends(get_db)):
    query = db.query(CycleProduction)
    if req.station_id:
        query = query.filter(CycleProduction.station_id == req.station_id)
    if req.statut_cycle:
        query = query.filter(CycleProduction.statut_cycle == req.statut_cycle)
    if req.espece:
        query = query.filter(CycleProduction.espece.ilike(f"%{req.espece}%"))

    total = query.count()
    items = (
        query.order_by(CycleProduction.date_empoissonnement.desc())
        .offset((req.page - 1) * req.page_size)
        .limit(req.page_size)
        .all()
    )
    return CycleListResponse(
        total=total, page=req.page, page_size=req.page_size, items=items
    )


@router.post("/cycles/create", response_model=CycleProductionRead)
def creer_cycle(payload: CycleProductionCreate, db: Session = Depends(get_db)):
    station = _get_station_or_404(db, payload.station_id)
    if station.statut != StatutStationEnum.ACTIVE:
        raise HTTPException(
            status_code=400,
            detail="Un cycle ne peut être créé que sur une station ACTIVE",
        )
    cycle = CycleProduction(**payload.model_dump())
    cycle.code_cycle = _generer_code(
        db, CycleProduction, "CY", CycleProduction.code_cycle
    )
    cycle.statut_cycle = StatutCycleEnum.EN_COURS
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle


@router.post("/cycles/update", response_model=CycleProductionRead)
def modifier_cycle(payload: CycleProductionUpdate, db: Session = Depends(get_db)):
    cycle = _get_cycle_or_404(db, payload.id)
    if cycle.statut_cycle != StatutCycleEnum.EN_COURS:
        raise HTTPException(
            status_code=400, detail="Seul un cycle EN_COURS peut être modifié"
        )
    donnees = payload.model_dump(exclude_unset=True, exclude={"id"})
    for champ, valeur in donnees.items():
        setattr(cycle, champ, valeur)
    db.commit()
    db.refresh(cycle)
    return cycle


@router.post("/cycles/recolter", response_model=CycleProductionRead)
def recolter_cycle(req: CycleRecolteRequest, db: Session = Depends(get_db)):
    """Transition EN_COURS -> RECOLTE avec saisie des données de récolte."""
    cycle = _get_cycle_or_404(db, req.id)
    if cycle.statut_cycle != StatutCycleEnum.EN_COURS:
        raise HTTPException(
            status_code=400, detail="Seul un cycle EN_COURS peut être récolté"
        )
    cycle.date_recolte_effective = req.date_recolte_effective
    cycle.tonnage_recolte = req.tonnage_recolte
    cycle.taux_mortalite = req.taux_mortalite
    if req.observations:
        cycle.observations = req.observations
    cycle.statut_cycle = StatutCycleEnum.RECOLTE
    db.commit()
    db.refresh(cycle)
    return cycle


@router.post("/cycles/abandonner", response_model=CycleProductionRead)
def abandonner_cycle(req: IdRequest, db: Session = Depends(get_db)):
    cycle = _get_cycle_or_404(db, req.id)
    if cycle.statut_cycle != StatutCycleEnum.EN_COURS:
        raise HTTPException(
            status_code=400, detail="Seul un cycle EN_COURS peut être abandonné"
        )
    cycle.statut_cycle = StatutCycleEnum.ABANDONNE
    db.commit()
    db.refresh(cycle)
    return cycle


@router.post("/cycles/delete", response_model=MessageResponse)
def supprimer_cycle(req: IdRequest, db: Session = Depends(get_db)):
    cycle = _get_cycle_or_404(db, req.id)
    db.delete(cycle)
    db.commit()
    return MessageResponse(success=True, message=f"Cycle {cycle.code_cycle} supprimé")


# ---------------------------------------------------------------------------
# Statistiques — format prêt pour Chart.js (labels / data)
# ---------------------------------------------------------------------------


@router.post("/stats")
def statistiques(db: Session = Depends(get_db)):
    # 1. Répartition des stations par province
    par_province = (
        db.query(StationPiscicole.province, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.province)
        .order_by(func.count(StationPiscicole.id).desc())
        .all()
    )

    # 2. Répartition par type de station
    par_type = (
        db.query(StationPiscicole.type_station, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.type_station)
        .all()
    )

    # 3. Répartition par statut
    par_statut = (
        db.query(StationPiscicole.statut, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.statut)
        .all()
    )

    # 4. Production récoltée par espèce (cycles RECOLTE)
    production_espece = (
        db.query(
            CycleProduction.espece,
            func.coalesce(func.sum(CycleProduction.tonnage_recolte), 0),
        )
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE)
        .group_by(CycleProduction.espece)
        .order_by(func.sum(CycleProduction.tonnage_recolte).desc())
        .all()
    )

    # 5. Production mensuelle de l'année en cours
    annee = datetime.utcnow().year
    production_mensuelle_raw = (
        db.query(
            extract("month", CycleProduction.date_recolte_effective).label("mois"),
            func.coalesce(func.sum(CycleProduction.tonnage_recolte), 0),
        )
        .filter(
            CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE,
            extract("year", CycleProduction.date_recolte_effective) == annee,
        )
        .group_by("mois")
        .all()
    )
    mois_labels = [
        "Jan",
        "Fév",
        "Mar",
        "Avr",
        "Mai",
        "Juin",
        "Juil",
        "Août",
        "Sep",
        "Oct",
        "Nov",
        "Déc",
    ]
    production_par_mois = {int(m): float(t) for m, t in production_mensuelle_raw}

    # 6. Indicateurs globaux
    total_stations = db.query(func.count(StationPiscicole.id)).scalar()
    stations_actives = (
        db.query(func.count(StationPiscicole.id))
        .filter(StationPiscicole.statut == StatutStationEnum.ACTIVE)
        .scalar()
    )
    cycles_en_cours = (
        db.query(func.count(CycleProduction.id))
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.EN_COURS)
        .scalar()
    )
    tonnage_total = (
        db.query(func.coalesce(func.sum(CycleProduction.tonnage_recolte), 0))
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE)
        .scalar()
    )

    return {
        "indicateurs": {
            "total_stations": total_stations,
            "stations_actives": stations_actives,
            "cycles_en_cours": cycles_en_cours,
            "tonnage_total_recolte": float(tonnage_total),
        },
        "par_province": {
            "labels": [p for p, _ in par_province],
            "data": [c for _, c in par_province],
        },
        "par_type": {
            "labels": [t.value for t, _ in par_type],
            "data": [c for _, c in par_type],
        },
        "par_statut": {
            "labels": [s.value for s, _ in par_statut],
            "data": [c for _, c in par_statut],
        },
        "production_par_espece": {
            "labels": [e for e, _ in production_espece],
            "data": [float(t) for _, t in production_espece],
        },
        "production_mensuelle": {
            "labels": mois_labels,
            "data": [production_par_mois.get(m, 0) for m in range(1, 13)],
        },
    }
