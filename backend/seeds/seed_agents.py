"""
SIGPA — Module Surveillance : jeu de données initial (agents de contrôle).

Peuple les 3 tables du référentiel : fonctions_agents, organismes_agents,
agents_surveillance.

Idempotent : les fonctions/organismes sont dédupliqués par `libelle`,
les agents par `matricule`. Le script peut donc être rejoué sans créer de doublon.

Exécution :
    python seed_agents.py
ou depuis le shell projet :
    python -c "from seed_agents import seed; seed()"

⚠️ Données d'exemple. Noms, matricules et contacts sont fictifs et destinés
   à l'amorçage/démonstration ; à remplacer par les données officielles.
"""

import argparse
import importlib
import pkgutil
from datetime import date

from app.database import SessionLocal, Base, engine
import app.models  # noqa: E402

for module in pkgutil.walk_packages(app.models.__path__, prefix="app.models."):
    try:
        importlib.import_module(module.name)
    except Exception as e:
        print(f"[warn] import {module.name} ignoré : {e}")
from app.models.surveillance import FonctionAgent, OrganismeAgent, AgentSurveillance

# ---------------------------------------------------------------------------
#  Données
# ---------------------------------------------------------------------------
FONCTIONS = [
    "Inspecteur des pêches",
    "Contrôleur des pêches",
    "Chef de mission de surveillance",
    "Agent de surveillance",
    "Observateur des pêches",
    "Garde-pêche",
    "Officier de police judiciaire (OPJ)",
    "Pilote / Chef de bord",
]

ORGANISMES = [
    ("Direction Générale des Pêches et de l'Aquaculture", "DGPA"),
    ("Marine Nationale Gabonaise", "MNG"),
    ("Gendarmerie Nationale — Brigade nautique", "GN-BN"),
    ("Direction Générale des Douanes et Droits Indirects", "DGDDI"),
    ("Agence Nationale des Parcs Nationaux", "ANPN"),
    ("Agence Gabonaise d'Études et d'Observations Spatiales", "AGEOS"),
]

# (matricule, nom, prenom, date_naissance, fonction, organisme_abbr, email, tel)
AGENTS = [
    (
        "DGPA-0142",
        "OBAME",
        "Jean-Pierre",
        date(1981, 3, 12),
        "Inspecteur des pêches",
        "DGPA",
        "jp.obame@peche.gouv.ga",
        "+241 06 12 34 56",
    ),
    (
        "DGPA-0187",
        "MOUSSAVOU",
        "Sylvie",
        date(1986, 7, 4),
        "Contrôleur des pêches",
        "DGPA",
        "s.moussavou@peche.gouv.ga",
        "+241 06 45 78 90",
    ),
    (
        "DGPA-0203",
        "NDONG MBA",
        "Landry",
        date(1990, 11, 22),
        "Contrôleur des pêches",
        "DGPA",
        "l.ndong@peche.gouv.ga",
        "+241 07 11 22 33",
    ),
    (
        "DGPA-0221",
        "KOUMBA",
        "Chancelle",
        date(1992, 2, 15),
        "Observateur des pêches",
        "DGPA",
        "c.koumba@peche.gouv.ga",
        "+241 07 88 44 21",
    ),
    (
        "DGPA-0255",
        "IVANGA",
        "Serge",
        date(1984, 9, 8),
        "Chef de mission de surveillance",
        "DGPA",
        "s.ivanga@peche.gouv.ga",
        "+241 06 33 55 77",
    ),
    (
        "MNG-1032",
        "NGUEMA",
        "Aristide",
        date(1979, 5, 30),
        "Chef de mission de surveillance",
        "MNG",
        "a.nguema@marine.ga",
        "+241 74 20 10 05",
    ),
    (
        "MNG-1058",
        "BOUSSOUGOU",
        "Willy",
        date(1988, 1, 19),
        "Pilote / Chef de bord",
        "MNG",
        "w.boussougou@marine.ga",
        "+241 74 62 18 43",
    ),
    (
        "MNG-1074",
        "MABIKA",
        "Hervé",
        date(1991, 6, 3),
        "Agent de surveillance",
        "MNG",
        "h.mabika@marine.ga",
        "+241 74 09 55 12",
    ),
    (
        "GN-4411",
        "ONDO",
        "Rich Ghislain",
        date(1983, 8, 27),
        "Officier de police judiciaire (OPJ)",
        "GN-BN",
        "r.ondo@gendarmerie.ga",
        "+241 62 30 44 11",
    ),
    (
        "GN-4429",
        "MINTSA",
        "Nadège",
        date(1989, 12, 9),
        "Agent de surveillance",
        "GN-BN",
        "n.mintsa@gendarmerie.ga",
        "+241 62 71 22 08",
    ),
    (
        "DOU-2210",
        "MOMBO",
        "Franck",
        date(1982, 4, 17),
        "Contrôleur des pêches",
        "DGDDI",
        "f.mombo@douanes.ga",
        "+241 65 14 77 39",
    ),
    (
        "DOU-2237",
        "LENDOYE",
        "Patience",
        date(1993, 10, 1),
        "Agent de surveillance",
        "DGDDI",
        "p.lendoye@douanes.ga",
        "+241 65 90 12 66",
    ),
    (
        "ANPN-0808",
        "EKOMI",
        "Cédric",
        date(1987, 3, 25),
        "Garde-pêche",
        "ANPN",
        "c.ekomi@anpn.ga",
        "+241 77 45 60 21",
    ),
    (
        "ANPN-0821",
        "BEKALE",
        "Marie-Claire",
        date(1990, 9, 14),
        "Observateur des pêches",
        "ANPN",
        "mc.bekale@anpn.ga",
        "+241 77 08 33 90",
    ),
    (
        "AGEOS-0117",
        "MENGUE",
        "Ghislain",
        date(1985, 1, 7),
        "Inspecteur des pêches",
        "AGEOS",
        "g.mengue@ageos.ga",
        "+241 66 22 11 47",
    ),
]


# ---------------------------------------------------------------------------
#  Helpers idempotents
# ---------------------------------------------------------------------------
def _get_or_create_fonction(db, libelle: str) -> FonctionAgent:
    obj = db.query(FonctionAgent).filter(FonctionAgent.libelle == libelle).first()
    if obj is None:
        obj = FonctionAgent(libelle=libelle)
        db.add(obj)
        db.flush()
    return obj


def _get_or_create_organisme(db, libelle: str, abbreviation: str) -> OrganismeAgent:
    obj = db.query(OrganismeAgent).filter(OrganismeAgent.libelle == libelle).first()
    if obj is None:
        obj = OrganismeAgent(libelle=libelle, abbreviation=abbreviation)
        db.add(obj)
        db.flush()
    elif obj.abbreviation != abbreviation:
        obj.abbreviation = abbreviation
    return obj


def _get_or_create_agent(db, data: dict) -> tuple[AgentSurveillance, bool]:
    obj = (
        db.query(AgentSurveillance)
        .filter(AgentSurveillance.matricule == data["matricule"])
        .first()
    )
    if obj is not None:
        return obj, False
    obj = AgentSurveillance(**data)
    db.add(obj)
    return obj, True


# ---------------------------------------------------------------------------
#  Seed
# ---------------------------------------------------------------------------
def seed(create_tables: bool = True) -> None:
    if create_tables:
        # crée les tables du référentiel si elles n'existent pas encore
        Base.metadata.create_all(
            bind=engine,
            tables=[
                FonctionAgent.__table__,
                OrganismeAgent.__table__,
                AgentSurveillance.__table__,
            ],
        )

    db = SessionLocal()
    try:
        # 1) Fonctions
        fonctions = {lib: _get_or_create_fonction(db, lib) for lib in FONCTIONS}

        # 2) Organismes (indexés par abréviation pour lier les agents)
        organismes = {}
        for libelle, abbr in ORGANISMES:
            organismes[abbr] = _get_or_create_organisme(db, libelle, abbr)

        db.flush()  # garantit les id avant de rattacher les agents

        # 3) Agents
        crees = 0
        for matricule, nom, prenom, ddn, fonction_lib, org_abbr, email, tel in AGENTS:
            payload = {
                "matricule": matricule,
                "nom": nom,
                "prenom": prenom,
                "date_naissance": ddn,
                "fonction_id": fonctions[fonction_lib].id,
                "organisme_id": organismes[org_abbr].id,
                "contact_email": email,
                "contact_telephone": tel,
            }
            _, created = _get_or_create_agent(db, payload)
            crees += int(created)

        db.commit()

        total_f = db.query(FonctionAgent).count()
        total_o = db.query(OrganismeAgent).count()
        total_a = db.query(AgentSurveillance).count()
        print("── Seed agents de contrôle ─────────────────────────────")
        print(f"  Fonctions   : {total_f}")
        print(f"  Organismes  : {total_o}")
        print(f"  Agents      : {total_a}  (nouveaux ce run : {crees})")
        print("────────────────────────────────────────────────────────")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
