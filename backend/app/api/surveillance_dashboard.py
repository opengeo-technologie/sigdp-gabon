"""
SIGPA — Module Surveillance : tableau de bord & rapport de surveillance.

  • POST /api/surveillance/dashboard            → agrégats JSON prêts pour Chart.js
  • GET  /api/surveillance/rapport?debut&fin    → rapport de surveillance (PDF)

Branchement dans main.py :
    from surveillance_dashboard_router import router as dashboard_router
    app.include_router(dashboard_router)
"""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, field_validator
from sqlalchemy import func, inspect as sa_inspect, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.surveillance import (
    MissionSurveillance,
    RapportSurveillance,
    OperationSurveillance,
    InfractionSurveillance,
    SaisieInfraction,
    AgentSurveillance,
)
from app.schemas.surveillance import _parse_date
from app.services.rapport_surveillance_pdf import build_rapport

router = APIRouter(prefix="/api/surveillance", tags=["Surveillance - Dashboard"])

_PDF = {
    200: {
        "content": {"application/pdf": {}},
        "description": "Rapport de surveillance (PDF)",
    }
}
_MOIS_FR = [
    "",
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


class PeriodeFiltre(BaseModel):
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None

    @field_validator("date_debut", "date_fin", mode="before")
    @classmethod
    def _d(cls, v):
        return _parse_date(v)


# =========================================================================
#  Helpers
# =========================================================================
def _labels_infractions(db: Session) -> dict:
    insp = sa_inspect(db.bind)
    if not insp.has_table("infractions"):
        return {}
    cols = [c["name"] for c in insp.get_columns("infractions")]
    col = next(
        (
            c
            for c in ["libelle", "intitule", "nom", "label", "description"]
            if c in cols
        ),
        None,
    )
    if not col:
        return {}
    return {
        r[0]: r[1]
        for r in db.execute(text(f"SELECT id, {col} FROM infractions")).fetchall()
    }


def _mois_buckets(fin: date, n: int = 12):
    buckets, y, m = [], fin.year, fin.month
    for _ in range(n):
        buckets.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    buckets.reverse()
    return buckets


def _aggreger(db: Session, debut: Optional[date], fin: Optional[date]) -> dict:
    fin_eff = fin or date.today()
    op_dt = OperationSurveillance.date_operation
    inf_dt = InfractionSurveillance.date_infraction

    def borne(q, col):
        if debut:
            q = q.filter(col >= debut)
        if fin:
            q = q.filter(col <= fin)
        return q

    q_op = borne(db.query(OperationSurveillance), op_dt)
    q_inf = borne(db.query(InfractionSurveillance), inf_dt)
    q_mis = borne(db.query(MissionSurveillance), MissionSurveillance.date_depart)
    q_rap = borne(db.query(RapportSurveillance), RapportSurveillance.date_rapport)
    q_sai = borne(db.query(SaisieInfraction), SaisieInfraction.date_saisie)

    total_op = q_op.count()
    total_inf = q_inf.count()
    total_mis = q_mis.count()
    total_rap = q_rap.count()
    total_sai = q_sai.count()

    # taux de conformité (opérations)
    conformes = (
        borne(
            db.query(func.count(OperationSurveillance.id)).filter(
                func.lower(func.trim(OperationSurveillance.resultat)) == "conforme"
            ),
            op_dt,
        ).scalar()
        or 0
    )
    taux = round(100.0 * conformes / total_op, 1) if total_op else 0.0

    # opérations par type
    op_type = dict(
        borne(
            db.query(
                OperationSurveillance.type_operation,
                func.count(OperationSurveillance.id),
            ),
            op_dt,
        )
        .group_by(OperationSurveillance.type_operation)
        .all()
    )
    op_type = {(k or "—"): v for k, v in op_type.items()}

    # opérations par résultat (conforme / non conforme / autre)
    res_rows = (
        borne(
            db.query(
                OperationSurveillance.resultat, func.count(OperationSurveillance.id)
            ),
            op_dt,
        )
        .group_by(OperationSurveillance.resultat)
        .all()
    )
    conf = nonconf = autre = 0
    for r, n in res_rows:
        rl = (r or "").strip().lower()
        if rl == "conforme":
            conf += n
        elif rl:
            nonconf += n
        else:
            autre += n

    # infractions par gravité
    grav_rows = (
        borne(
            db.query(
                InfractionSurveillance.gravite_infraction,
                func.count(InfractionSurveillance.id),
            ),
            inf_dt,
        )
        .group_by(InfractionSurveillance.gravite_infraction)
        .all()
    )
    grav = {"mineure": 0, "majeure": 0, "critique": 0}
    for g, n in grav_rows:
        gl = (g or "").strip().lower()
        if gl in grav:
            grav[gl] += n

    # infractions par type (catalogue)
    labels = _labels_infractions(db)
    type_rows = (
        borne(
            db.query(
                InfractionSurveillance.infraction_id,
                func.count(InfractionSurveillance.id),
            ),
            inf_dt,
        )
        .group_by(InfractionSurveillance.infraction_id)
        .all()
    )
    inf_type = {labels.get(tid, f"#{tid}"): n for tid, n in type_rows}

    # missions par type
    mis_rows = (
        borne(
            db.query(
                MissionSurveillance.type_mission, func.count(MissionSurveillance.id)
            ),
            MissionSurveillance.date_depart,
        )
        .group_by(MissionSurveillance.type_mission)
        .all()
    )
    mis_type = {(k or "—"): v for k, v in mis_rows}

    # activité par mois (12 mois)
    buckets = _mois_buckets(fin_eff, 12)
    m_labels, m_ops, m_infs = [], [], []
    for yy, mm in buckets:
        d0 = date(yy, mm, 1)
        d1 = date(yy + (mm // 12), (mm % 12) + 1, 1)
        m_labels.append(f"{_MOIS_FR[mm]} {yy}")
        m_ops.append(
            db.query(func.count(OperationSurveillance.id))
            .filter(op_dt >= d0, op_dt < d1)
            .scalar()
            or 0
        )
        m_infs.append(
            db.query(func.count(InfractionSurveillance.id))
            .filter(inf_dt >= d0, inf_dt < d1)
            .scalar()
            or 0
        )

    # =====================================================================
    #  Tableaux de synthèse
    # =====================================================================
    # Dernières opérations (8 plus récentes)
    recent_ops = (
        borne(db.query(OperationSurveillance), op_dt)
        .order_by(OperationSurveillance.date_operation.desc())
        .limit(8)
        .all()
    )
    dernieres_operations = []
    for o in recent_ops:
        n = (
            db.query(func.count(InfractionSurveillance.id))
            .filter(InfractionSurveillance.operation_id == o.id)
            .scalar()
            or 0
        )
        dernieres_operations.append(
            {
                "date": o.date_operation.isoformat() if o.date_operation else None,
                "lieu": o.lieu_operation or "—",
                "type": o.type_operation or "—",
                "resultat": o.resultat or "—",
                "nb_infractions": n,
            }
        )

    # Missions les plus actives
    op_by_mission = dict(
        borne(
            db.query(
                OperationSurveillance.mission_id, func.count(OperationSurveillance.id)
            ),
            op_dt,
        )
        .group_by(OperationSurveillance.mission_id)
        .all()
    )
    inf_by_mission = dict(
        borne(
            db.query(
                OperationSurveillance.mission_id, func.count(InfractionSurveillance.id)
            ).join(
                InfractionSurveillance,
                InfractionSurveillance.operation_id == OperationSurveillance.id,
            ),
            inf_dt,
        )
        .group_by(OperationSurveillance.mission_id)
        .all()
    )
    mission_ids = set(op_by_mission) | set(inf_by_mission)
    missions_info = {}
    if mission_ids:
        missions_info = {
            m.id: m
            for m in db.query(MissionSurveillance)
            .filter(MissionSurveillance.id.in_(mission_ids))
            .all()
        }
    missions_actives = []
    for mid in mission_ids:
        m = missions_info.get(mid)
        libelle = (
            f"{m.date_depart.isoformat()} — {m.lieu_mission or ''}".strip(" —")
            if m
            else f"#{mid}"
        )
        missions_actives.append(
            {
                "mission": libelle,
                "nb_operations": op_by_mission.get(mid, 0),
                "nb_infractions": inf_by_mission.get(mid, 0),
            }
        )
    missions_actives.sort(
        key=lambda r: (r["nb_infractions"], r["nb_operations"]), reverse=True
    )
    missions_actives = missions_actives[:8]

    # Saisies par agent
    sai_rows = (
        borne(
            db.query(
                AgentSurveillance.matricule,
                AgentSurveillance.nom,
                AgentSurveillance.prenom,
                func.count(SaisieInfraction.id),
            ).join(SaisieInfraction, SaisieInfraction.agent_id == AgentSurveillance.id),
            SaisieInfraction.date_saisie,
        )
        .group_by(AgentSurveillance.id)
        .all()
    )
    saisies_par_agent = sorted(
        [
            {"agent": f"{mat} — {nom} {pre}".strip(), "nb": n}
            for mat, nom, pre, n in sai_rows
        ],
        key=lambda r: r["nb"],
        reverse=True,
    )[:8]

    # Sanctions proposées
    sanc_rows = (
        borne(
            db.query(
                InfractionSurveillance.sanction_proposee,
                func.count(InfractionSurveillance.id),
            ),
            inf_dt,
        )
        .group_by(InfractionSurveillance.sanction_proposee)
        .all()
    )
    sanctions_proposees = sorted(
        [{"sanction": s, "nb": n} for s, n in sanc_rows if s and s.strip()],
        key=lambda r: r["nb"],
        reverse=True,
    )[:8]

    return {
        "periode": {
            "debut": debut.isoformat() if debut else None,
            "fin": fin.isoformat() if fin else None,
        },
        "kpi": {
            "missions": total_mis,
            "operations": total_op,
            "infractions": total_inf,
            "saisies": total_sai,
            "rapports": total_rap,
            "taux_conformite": taux,
        },
        "operations_par_type": {
            "labels": list(op_type.keys()),
            "data": list(op_type.values()),
        },
        "operations_par_resultat": {
            "labels": ["Conforme", "Non conforme", "Non renseigné"],
            "data": [conf, nonconf, autre],
        },
        "infractions_par_gravite": {
            "labels": ["Mineure", "Majeure", "Critique"],
            "data": [grav["mineure"], grav["majeure"], grav["critique"]],
        },
        "infractions_par_type": {
            "labels": list(inf_type.keys()),
            "data": list(inf_type.values()),
        },
        "missions_par_type": {
            "labels": list(mis_type.keys()),
            "data": list(mis_type.values()),
        },
        "activite_par_mois": {
            "labels": m_labels,
            "operations": m_ops,
            "infractions": m_infs,
        },
        "dernieres_operations": dernieres_operations,
        "missions_actives": missions_actives,
        "saisies_par_agent": saisies_par_agent,
        "sanctions_proposees": sanctions_proposees,
    }


# =========================================================================
#  Endpoints
# =========================================================================
@router.post("/dashboard")
def dashboard(filtre: PeriodeFiltre = PeriodeFiltre(), db: Session = Depends(get_db)):
    return _aggreger(db, filtre.date_debut, filtre.date_fin)


@router.get("/rapport", responses=_PDF)
def rapport(
    debut: Optional[str] = None,
    fin: Optional[str] = None,
    download: bool = False,
    db: Session = Depends(get_db),
):
    d0 = _parse_date(debut) if debut else None
    d1 = _parse_date(fin) if fin else None
    agg = _aggreger(db, d0, d1)
    pdf = build_rapport(agg)
    disp = "attachment" if download else "inline"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disp}; filename="rapport_surveillance.pdf"'},
    )
