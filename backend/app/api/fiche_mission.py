"""
SIGPA — Module Surveillance : génération de la fiche de mission (PDF).

Endpoint POST qui interroge la base (mission + équipe + rapports) et renvoie la
fiche de mission de contrôle PRÉ-REMPLIE. Passer {"vierge": true} pour obtenir
la fiche vierge.

Branchement dans main.py :
    from fiche_mission_router import router as fiche_router
    app.include_router(fiche_router)
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import inspect as sa_inspect, text

from app.database import get_db
from app.models.surveillance import (
    MissionSurveillance,
    EquipeSurveillance,
    RapportSurveillance,
    OperationSurveillance,
    InfractionSurveillance,
)
from app.services.fiche_mission import build_pdf

router = APIRouter(prefix="/api/surveillance", tags=["Surveillance - Fiche"])

# Déclare le type binaire pour la doc OpenAPI (évite l'aperçu texte)
_PDF_RESPONSE = {
    200: {"content": {"application/pdf": {}}, "description": "Fiche de mission (PDF)"}
}


class FicheRequest(BaseModel):
    id: int
    vierge: bool = False


def _fr_date(d) -> str:
    return d.strftime("%d/%m/%Y") if d else ""


def _labels_infractions(db: Session) -> dict:
    """Correspondance id -> libellé du catalogue externe `infractions` (best effort)."""
    insp = sa_inspect(db.bind)
    if not insp.has_table("infractions"):
        return {}
    cols = [c["name"] for c in insp.get_columns("infractions")]
    label_col = next(
        (
            c
            for c in ["libelle", "intitule", "nom", "label", "description"]
            if c in cols
        ),
        None,
    )
    if not label_col:
        return {}
    rows = db.execute(text(f"SELECT id, {label_col} FROM infractions")).fetchall()
    return {r[0]: r[1] for r in rows}


def _mission_to_data(db: Session, mission: MissionSurveillance) -> dict:
    membres = (
        db.query(EquipeSurveillance)
        .filter(EquipeSurveillance.mission_id == mission.id)
        .order_by(EquipeSurveillance.id)
        .all()
    )
    rapports = (
        db.query(RapportSurveillance)
        .filter(RapportSurveillance.mission_id == mission.id)
        .order_by(RapportSurveillance.date_rapport)
        .all()
    )

    equipe_rows, chef_nom = [], ""
    for e in membres:
        a = e.agent
        nom = f"{a.nom} {a.prenom}".strip() if a else ""
        org = (a.organisme.abbreviation if (a and a.organisme) else "") or ""
        role = e.role_agent or ""
        equipe_rows.append([a.matricule if a else "", nom, org, role, ""])
        if not chef_nom and "chef" in role.lower():
            chef_nom = nom

    obs = "\n".join(
        f"[{_fr_date(r.date_rapport)}] {r.contenu_rapport or ''}".strip()
        for r in rapports
    )

    # --- Opérations / infractions / saisies rattachées à la mission ---
    operations = (
        db.query(OperationSurveillance)
        .filter(OperationSurveillance.mission_id == mission.id)
        .order_by(OperationSurveillance.date_operation)
        .all()
    )
    labels = _labels_infractions(db)

    op_rows, inf_rows, sai_rows = [], [], []
    n_inf = 0
    for o in operations:
        res = (o.resultat or "").strip().lower()
        conforme = "X" if res == "conforme" else ""
        non_conforme = "X" if (res and res != "conforme") else ""
        op_rows.append(
            [
                _fr_date(o.date_operation),
                o.lieu_operation or "",
                o.type_operation or "",
                conforme,
                non_conforme,
                o.remarques or "",
            ]
        )

        infractions = (
            db.query(InfractionSurveillance)
            .filter(InfractionSurveillance.operation_id == o.id)
            .order_by(InfractionSurveillance.gravite_infraction)
            .all()
        )

        for inf in infractions:
            n_inf += 1
            type_lbl = labels.get(inf.infraction_id, f"#{inf.infraction_id}")
            inf_rows.append(
                [
                    str(n_inf),
                    type_lbl,
                    inf.gravite_infraction or "",
                    "",
                    "",  # Contrevenant / Sexe : non gérés par ce modèle
                    inf.description_infraction or "",
                ]
            )
            for s in inf.saisies:
                agent = s.agent.matricule if s.agent else ""
                design = " - ".join(
                    x for x in [_fr_date(s.date_saisie), s.remarques or ""] if x
                )
                if agent:
                    design = f"{design} (agent {agent})"
                sai_rows.append([design, "", "", ""])

    return {
        "ref": f"MIS-{mission.id:04d}",
        "dep": _fr_date(mission.date_depart),
        "ret": _fr_date(mission.date_retour),
        "lieu": mission.lieu_mission or "",
        "type": (mission.type_mission or "").lower(),
        "moyen": mission.moyen_controle or "",
        "equipe": equipe_rows[:6],
        "operations": op_rows[:5],
        "infractions": inf_rows[:5],
        "saisies": sai_rows[:4],
        "obs": obs,
        "chef_nom": chef_nom,
    }


def _pdf_response(
    db: Session, mission_id: int, vierge: bool, disposition: str = "inline"
) -> Response:
    mission = (
        db.query(MissionSurveillance)
        .filter(MissionSurveillance.id == mission_id)
        .first()
    )
    if not mission:
        raise HTTPException(
            status_code=404, detail=f"Mission introuvable (id={mission_id})."
        )
    data = None if vierge else _mission_to_data(db, mission)
    # print(data)
    pdf = build_pdf(data)
    suffixe = "vierge" if vierge else f"MIS-{mission.id:04d}"
    filename = f"fiche_mission_{suffixe}.pdf"
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'{disposition}; filename="{filename}"'},
    )


@router.get("/missions/{mission_id}/fiche", responses=_PDF_RESPONSE)
def fiche_get(
    mission_id: int,
    vierge: bool = False,
    download: bool = False,
    db: Session = Depends(get_db),
):
    """Ouvre la fiche dans le navigateur (aperçu/impression), ou la télécharge
    si ?download=true."""
    return _pdf_response(
        db, mission_id, vierge, disposition="attachment" if download else "inline"
    )


@router.post("/missions/fiche", responses=_PDF_RESPONSE)
def fiche_post(req: FicheRequest, db: Session = Depends(get_db)):
    """Renvoie le PDF (usage programmatique / blob Angular)."""
    return _pdf_response(db, req.id, req.vierge, disposition="attachment")
