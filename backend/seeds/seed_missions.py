"""
SIGPA — Module Surveillance : jeu de données initial (missions).

Peuple missions_surveillance, equipes_surveillance (liaison aux agents du
référentiel) et rapports_surveillance.

Idempotent :
  • mission dédupliquée par (date_depart, lieu_mission, type_mission) ;
  • membre d'équipe dédupliqué par (mission_id, agent_id) ;
  • rapport dédupliqué par (mission_id, date_rapport).
Rejouable sans créer de doublon.

Dépendance : les agents doivent exister (référentiel). Si la table est vide,
seed_agents.seed() est appelé automatiquement.

Exécution :
    python seed_missions.py
ou :
    python -c "from seed_missions import seed; seed()"

⚠️ Données d'exemple, fictives, destinées à la démonstration.
"""

import importlib
import pkgutil
from datetime import date

from sqlalchemy import inspect as sa_inspect

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
    RapportSurveillance,
    AgentSurveillance,
)

# ---------------------------------------------------------------------------
#  Données  (équipe : (matricule, rôle) ; rapports : (date, contenu))
# ---------------------------------------------------------------------------
MISSIONS = [
    {
        "date_depart": date(2026, 2, 10),
        "date_retour": date(2026, 2, 13),
        "lieu_mission": "Port-Gentil",
        "type_mission": "terrain",
        "moyen_controle": "Vedette VG-02",
        "equipe": [
            ("DGPA-0255", "chef d'équipe"),
            ("MNG-1032", "membre"),
            ("MNG-1058", "pilote"),
            ("DGPA-0142", "membre"),
        ],
        "rapports": [
            (
                date(2026, 2, 14),
                "Patrouille côtière au large de Port-Gentil. 12 embarcations "
                "contrôlées, 2 non conformités relevées (engins prohibés).",
            )
        ],
    },
    {
        "date_depart": date(2026, 3, 5),
        "date_retour": date(2026, 3, 5),
        "lieu_mission": "Débarcadère de Libreville",
        "type_mission": "aleatoire",
        "moyen_controle": "4x4 Toyota Land Cruiser",
        "equipe": [
            ("DGPA-0142", "chef d'équipe"),
            ("DGPA-0187", "membre"),
            ("GN-4429", "membre"),
        ],
        "rapports": [
            (
                date(2026, 3, 6),
                "Contrôle inopiné au débarcadère. Vérification des licences "
                "et des tailles minimales de capture.",
            )
        ],
    },
    {
        "date_depart": date(2026, 3, 22),
        "date_retour": date(2026, 3, 25),
        "lieu_mission": "Mayumba",
        "type_mission": "terrain",
        "moyen_controle": "Vedette rapide",
        "equipe": [
            ("MNG-1032", "chef d'équipe"),
            ("MNG-1074", "membre"),
            ("ANPN-0808", "garde-pêche"),
            ("DGPA-0221", "observateur"),
        ],
        "rapports": [
            (
                date(2026, 3, 26),
                "Surveillance de l'aire marine protégée de Mayumba. "
                "Sensibilisation des pêcheurs artisanaux, aucune infraction majeure.",
            )
        ],
    },
    {
        "date_depart": date(2026, 4, 14),
        "date_retour": None,
        "lieu_mission": "Port d'Owendo",
        "type_mission": "bureau",
        "moyen_controle": None,
        "equipe": [("DOU-2210", "chef d'équipe"), ("DOU-2237", "membre")],
        "rapports": [],
    },
    {
        "date_depart": date(2026, 5, 2),
        "date_retour": date(2026, 5, 4),
        "lieu_mission": "Gamba",
        "type_mission": "terrain",
        "moyen_controle": "Pirogue motorisée",
        "equipe": [
            ("ANPN-0808", "chef d'équipe"),
            ("ANPN-0821", "observateur"),
            ("DGPA-0203", "membre"),
        ],
        "rapports": [
            (
                date(2026, 5, 5),
                "Contrôle des zones de pêche autour de Gamba. Saisie d'un filet "
                "à maille non réglementaire.",
            )
        ],
    },
    {
        "date_depart": date(2026, 6, 11),
        "date_retour": date(2026, 6, 11),
        "lieu_mission": "Cocobeach",
        "type_mission": "aleatoire",
        "moyen_controle": "Vedette Gendarmerie",
        "equipe": [
            ("GN-4411", "OPJ — chef d'équipe"),
            ("GN-4429", "membre"),
            ("MNG-1074", "membre"),
        ],
        "rapports": [
            (
                date(2026, 6, 12),
                "Opération conjointe frontalière. Interception d'une embarcation "
                "sans autorisation de pêche.",
            )
        ],
    },
    {
        "date_depart": date(2026, 6, 28),
        "date_retour": date(2026, 7, 2),
        "lieu_mission": "Omboué (Fernan Vaz)",
        "type_mission": "terrain",
        "moyen_controle": "Vedette VG-05",
        "equipe": [
            ("DGPA-0255", "chef d'équipe"),
            ("AGEOS-0117", "appui SIG"),
            ("DGPA-0221", "observateur"),
            ("MNG-1058", "pilote"),
        ],
        "rapports": [
            (
                date(2026, 7, 3),
                "Mission dans la lagune Fernan Vaz. Cartographie des sites de "
                "débarquement et contrôle des captures.",
            )
        ],
    },
    {
        "date_depart": date(2026, 7, 20),
        "date_retour": None,
        "lieu_mission": "DGPA — Libreville",
        "type_mission": "bureau",
        "moyen_controle": None,
        "equipe": [
            ("DGPA-0142", "chef d'équipe"),
            ("DGPA-0187", "membre"),
            ("AGEOS-0117", "analyse satellite"),
        ],
        "rapports": [],
    },
]


# ---------------------------------------------------------------------------
#  Helpers idempotents
# ---------------------------------------------------------------------------
def _get_or_create_mission(db, m: dict):
    q = (
        db.query(MissionSurveillance)
        .filter(
            MissionSurveillance.date_depart == m["date_depart"],
            MissionSurveillance.lieu_mission == m["lieu_mission"],
            MissionSurveillance.type_mission == m["type_mission"],
        )
        .first()
    )
    if q:
        return q, False
    obj = MissionSurveillance(
        date_depart=m["date_depart"],
        date_retour=m["date_retour"],
        lieu_mission=m["lieu_mission"],
        type_mission=m["type_mission"],
        moyen_controle=m["moyen_controle"],
    )
    db.add(obj)
    db.flush()
    return obj, True


def _ensure_equipe(db, mission_id: int, agent_id: int, role: str) -> bool:
    e = (
        db.query(EquipeSurveillance)
        .filter(
            EquipeSurveillance.mission_id == mission_id,
            EquipeSurveillance.agent_id == agent_id,
        )
        .first()
    )
    if e:
        if role and e.role_agent != role:
            e.role_agent = role
        return False
    db.add(
        EquipeSurveillance(mission_id=mission_id, agent_id=agent_id, role_agent=role)
    )
    return True


def _ensure_rapport(db, mission_id: int, d: date, contenu: str) -> bool:
    r = (
        db.query(RapportSurveillance)
        .filter(
            RapportSurveillance.mission_id == mission_id,
            RapportSurveillance.date_rapport == d,
        )
        .first()
    )
    if r:
        return False
    db.add(
        RapportSurveillance(
            mission_id=mission_id, date_rapport=d, contenu_rapport=contenu
        )
    )
    return True


# ---------------------------------------------------------------------------
#  Seed
# ---------------------------------------------------------------------------
def seed(create_tables: bool = True) -> None:
    if create_tables:
        Base.metadata.create_all(
            bind=engine,
            tables=[
                MissionSurveillance.__table__,
                EquipeSurveillance.__table__,
                RapportSurveillance.__table__,
            ],
        )

    db = SessionLocal()
    try:
        # Le référentiel agents doit être peuplé ; sinon on l'amorce.
        # (contrôle défensif : la table peut ne pas encore exister à froid)
        table_agents = AgentSurveillance.__tablename__
        agents_prets = (
            sa_inspect(engine).has_table(table_agents)
            and db.query(AgentSurveillance).count() > 0
        )
        if not agents_prets:
            print("Référentiel agents absent/vide → exécution de seed_agents…")
            from seed_agents import seed as seed_agents

            seed_agents(create_tables=True)

        agents = {a.matricule: a for a in db.query(AgentSurveillance).all()}

        n_miss = n_equipe = n_rap = 0
        introuvables = set()

        for m in MISSIONS:
            mission, cree = _get_or_create_mission(db, m)
            n_miss += int(cree)

            for matricule, role in m["equipe"]:
                agent = agents.get(matricule)
                if not agent:
                    introuvables.add(matricule)
                    continue
                n_equipe += int(_ensure_equipe(db, mission.id, agent.id, role))

            for d, contenu in m["rapports"]:
                n_rap += int(_ensure_rapport(db, mission.id, d, contenu))

        db.commit()

        t_m = db.query(MissionSurveillance).count()
        t_e = db.query(EquipeSurveillance).count()
        t_r = db.query(RapportSurveillance).count()
        print("── Seed missions de surveillance ───────────────────────")
        print(f"  Missions    : {t_m}  (nouvelles ce run : {n_miss})")
        print(f"  Affectations: {t_e}  (nouvelles ce run : {n_equipe})")
        print(f"  Rapports    : {t_r}  (nouveaux ce run : {n_rap})")
        if introuvables:
            print(
                f"  ⚠ Matricules introuvables (ignorés) : {', '.join(sorted(introuvables))}"
            )
        print("────────────────────────────────────────────────────────")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
