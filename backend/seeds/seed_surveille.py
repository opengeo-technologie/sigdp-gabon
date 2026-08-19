"""
SIGPA — Module Surveillance : jeu de données initial (opérations / infractions / saisies).

Peuple operations_surveillance, infractions_surveillance et saisies_infractions,
en s'appuyant sur les missions et agents déjà présents.

Particularités :
  • Les types d'infraction proviennent du CATALOGUE EXTERNE `infractions` : le
    script lit les IDs réellement présents et les affecte en rotation
    (il n'invente aucun ID). Si le catalogue est vide/absent, les infractions
    et saisies sont ignorées (les opérations restent créées) avec un avertissement.
  • `bateau_id` est renseigné depuis la table `bateaux` si elle contient des
    lignes, sinon laissé à NULL.
  • L'agent d'une saisie est choisi parmi l'équipe de la mission (rotation).

Idempotent :
  • opération : (mission_id, date_operation, type_operation, lieu_operation)
  • infraction : (operation_id, date_infraction, infraction_id, description)
  • saisie : (infraction_id, date_saisie, agent_id, remarques)

Dépendances : missions + agents. Si les missions manquent, seed_missions() est
appelé (qui amorce aussi les agents).

Exécution :
    python seed_operations.py
⚠️ Données d'exemple, fictives.
"""

import importlib
import pkgutil
from datetime import date

from sqlalchemy import inspect as sa_inspect, text

from app.database import SessionLocal, Base, engine
import app.models  # noqa: E402

for module in pkgutil.walk_packages(app.models.__path__, prefix="app.models."):
    try:
        importlib.import_module(module.name)
    except Exception as e:
        print(f"[warn] import {module.name} ignoré : {e}")
from app.models.surveillance import (
    MissionSurveillance,
    EquipeSurveillance,
    OperationSurveillance,
    InfractionSurveillance,
    SaisieInfraction,
)

# ---------------------------------------------------------------------------
#  Données (par lieu de mission) — le type d'infraction est pris dans le
#  catalogue existant, en rotation ; on ne fixe donc pas d'ID ici.
# ---------------------------------------------------------------------------
OPERATIONS = {
    "Port-Gentil": [
        {
            "date": date(2026, 2, 11),
            "lieu": "Zone A — large de Port-Gentil",
            "type": "inspection",
            "resultat": "non conforme",
            "remarques": "Contrôle de 6 embarcations, 2 en infraction.",
            "infractions": [
                {
                    "date": date(2026, 2, 11),
                    "gravite": "majeure",
                    "bateau": 0,
                    "description": "Engin prohibé : filet monofilament.",
                    "sanction": "Amende + saisie de l'engin",
                    "saisies": [
                        {
                            "date": date(2026, 2, 11),
                            "remarques": "1 filet monofilament saisi.",
                        }
                    ],
                },
                {
                    "date": date(2026, 2, 12),
                    "gravite": "mineure",
                    "bateau": None,
                    "description": "Journal de pêche non tenu à jour.",
                    "sanction": "Avertissement",
                    "saisies": [],
                },
            ],
        },
        {
            "date": date(2026, 2, 12),
            "lieu": "Débarcadère de Port-Gentil",
            "type": "contrôle",
            "resultat": "conforme",
            "remarques": "Vérification des licences au débarquement.",
            "infractions": [],
        },
    ],
    "Mayumba": [
        {
            "date": date(2026, 3, 23),
            "lieu": "Aire marine protégée de Mayumba",
            "type": "patrouille",
            "resultat": "non conforme",
            "remarques": "Pêche détectée en zone de réserve.",
            "infractions": [
                {
                    "date": date(2026, 3, 23),
                    "gravite": "critique",
                    "bateau": 1,
                    "description": "Pêche dans une zone interdite (réserve).",
                    "sanction": "Poursuite judiciaire + saisie des captures",
                    "saisies": [
                        {
                            "date": date(2026, 3, 23),
                            "remarques": "Captures saisies (~120 kg).",
                        },
                        {
                            "date": date(2026, 3, 23),
                            "remarques": "GPS et documents de bord saisis.",
                        },
                    ],
                },
            ],
        },
    ],
    "Gamba": [
        {
            "date": date(2026, 5, 3),
            "lieu": "Chenaux de Gamba",
            "type": "inspection",
            "resultat": "non conforme",
            "remarques": "Maillage non réglementaire constaté.",
            "infractions": [
                {
                    "date": date(2026, 5, 3),
                    "gravite": "majeure",
                    "bateau": 0,
                    "description": "Filet à maille inférieure au minimum légal.",
                    "sanction": "Amende + saisie de l'engin",
                    "saisies": [
                        {
                            "date": date(2026, 5, 3),
                            "remarques": "1 filet non réglementaire saisi.",
                        }
                    ],
                },
            ],
        },
    ],
    "Cocobeach": [
        {
            "date": date(2026, 6, 11),
            "lieu": "Zone frontalière de Cocobeach",
            "type": "opération conjointe",
            "resultat": "non conforme",
            "remarques": "Embarcation sans autorisation interceptée.",
            "infractions": [
                {
                    "date": date(2026, 6, 11),
                    "gravite": "critique",
                    "bateau": 1,
                    "description": "Pêche sans autorisation (eaux gabonaises).",
                    "sanction": "Immobilisation de l'embarcation",
                    "saisies": [
                        {
                            "date": date(2026, 6, 11),
                            "remarques": "Embarcation consignée au port.",
                        }
                    ],
                },
            ],
        },
    ],
}


# ---------------------------------------------------------------------------
#  Helpers idempotents
# ---------------------------------------------------------------------------
def _get_or_create_operation(db, mission_id, o):
    q = (
        db.query(OperationSurveillance)
        .filter_by(
            mission_id=mission_id,
            date_operation=o["date"],
            type_operation=o["type"],
            lieu_operation=o["lieu"],
        )
        .first()
    )
    if q:
        return q, False
    obj = OperationSurveillance(
        mission_id=mission_id,
        date_operation=o["date"],
        lieu_operation=o["lieu"],
        type_operation=o["type"],
        resultat=o["resultat"],
        remarques=o["remarques"],
    )
    db.add(obj)
    db.flush()
    return obj, True


def _get_or_create_infraction(db, operation_id, type_id, inf, bateau_id):
    q = (
        db.query(InfractionSurveillance)
        .filter_by(
            operation_id=operation_id,
            date_infraction=inf["date"],
            infraction_id=type_id,
            description_infraction=inf["description"],
        )
        .first()
    )
    if q:
        return q, False
    obj = InfractionSurveillance(
        operation_id=operation_id,
        date_infraction=inf["date"],
        infraction_id=type_id,
        bateau_id=bateau_id,
        description_infraction=inf["description"],
        gravite_infraction=inf["gravite"],
        sanction_proposee=inf["sanction"],
    )
    db.add(obj)
    db.flush()
    return obj, True


def _get_or_create_saisie(db, infraction_id, s, agent_id):
    q = (
        db.query(SaisieInfraction)
        .filter_by(
            infraction_id=infraction_id,
            date_saisie=s["date"],
            agent_id=agent_id,
            remarques=s["remarques"],
        )
        .first()
    )
    if q:
        return False
    db.add(
        SaisieInfraction(
            infraction_id=infraction_id,
            date_saisie=s["date"],
            agent_id=agent_id,
            remarques=s["remarques"],
        )
    )
    return True


def _ids_catalogue(table):
    """Liste défensive des IDs d'une table externe (catalogue)."""
    if not sa_inspect(engine).has_table(table):
        return []
    with engine.connect() as conn:
        return [
            r[0]
            for r in conn.execute(
                text(f"SELECT id FROM {table} ORDER BY id")
            ).fetchall()
        ]


# ---------------------------------------------------------------------------
#  Seed
# ---------------------------------------------------------------------------
def seed(create_tables: bool = True) -> None:
    if create_tables:
        Base.metadata.create_all(
            bind=engine,
            tables=[
                OperationSurveillance.__table__,
                InfractionSurveillance.__table__,
                SaisieInfraction.__table__,
            ],
        )

    db = SessionLocal()
    try:
        # Prérequis : missions (+ agents). Sinon on amorce.
        if (
            not sa_inspect(engine).has_table(MissionSurveillance.__tablename__)
            or db.query(MissionSurveillance).count() == 0
        ):
            print("Missions absentes/vides → exécution de seed_missions…")
            from seed_missions import seed as seed_missions

            seed_missions(create_tables=True)

        type_ids = _ids_catalogue("infractions")
        bateau_ids = _ids_catalogue("bateaux")
        infractions_ok = len(type_ids) > 0
        if not infractions_ok:
            print(
                "⚠ Catalogue `infractions` vide/absent → infractions et saisies ignorées."
            )

        n_op = n_inf = n_sai = 0
        lieux_absents = []
        type_cursor = 0

        for lieu, operations in OPERATIONS.items():
            mission = (
                db.query(MissionSurveillance)
                .filter(MissionSurveillance.lieu_mission == lieu)
                .first()
            )
            if not mission:
                lieux_absents.append(lieu)
                continue

            # agents de l'équipe de la mission (pour affecter les saisies)
            equipe_agents = [
                e.agent_id
                for e in db.query(EquipeSurveillance)
                .filter(EquipeSurveillance.mission_id == mission.id)
                .all()
            ]
            agent_cursor = 0

            for o in operations:
                op, cree = _get_or_create_operation(db, mission.id, o)
                n_op += int(cree)

                if not infractions_ok:
                    continue

                for inf in o["infractions"]:
                    type_id = type_ids[type_cursor % len(type_ids)]
                    type_cursor += 1
                    bidx = inf.get("bateau")
                    bateau_id = (
                        bateau_ids[bidx]
                        if (bidx is not None and bidx < len(bateau_ids))
                        else None
                    )
                    info, cree_i = _get_or_create_infraction(
                        db, op.id, type_id, inf, bateau_id
                    )
                    n_inf += int(cree_i)

                    for s in inf.get("saisies", []):
                        agent_id = (
                            equipe_agents[agent_cursor % len(equipe_agents)]
                            if equipe_agents
                            else None
                        )
                        agent_cursor += 1
                        n_sai += int(_get_or_create_saisie(db, info.id, s, agent_id))

        db.commit()

        t_op = db.query(OperationSurveillance).count()
        t_inf = db.query(InfractionSurveillance).count()
        t_sai = db.query(SaisieInfraction).count()
        print("── Seed opérations de surveillance ─────────────────────")
        print(f"  Opérations  : {t_op}  (nouvelles ce run : {n_op})")
        print(f"  Infractions : {t_inf}  (nouvelles ce run : {n_inf})")
        print(f"  Saisies     : {t_sai}  (nouvelles ce run : {n_sai})")
        if lieux_absents:
            print(f"  ⚠ Missions introuvables (ignorées) : {', '.join(lieux_absents)}")
        print("────────────────────────────────────────────────────────")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
