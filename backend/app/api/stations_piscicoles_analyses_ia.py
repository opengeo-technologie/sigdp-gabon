# -*- coding: utf-8 -*-
"""
Analyse IA du rapport — Module Stations Piscicoles (SIGDP-GABON)

- collecter_donnees_analytiques(db, province, annee) : agrégats JSON-ables
- generer_analyse_ia(donnees) : appel à l'API Anthropic, analyse structurée
- POST /stations-piscicoles/rapport/analyse-ia : endpoint pour le frontend

Configuration (variables d'environnement) :
- ANTHROPIC_API_KEY : clé API (obligatoire) — https://platform.claude.com
- SIGDP_IA_MODEL    : modèle utilisé (défaut : claude-opus-4-8)

Dépendance : pip install anthropic
"""

import json
import os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.database import get_db  # à ajuster selon l'arborescence
from app.models.stations_piscicole import (
    StationPiscicole,
    CycleProduction,
    StatutStationEnum,
    StatutCycleEnum,
)

router = APIRouter(
    prefix="/api/stations-piscicoles/rapport", tags=["Stations piscicoles - Analyse IA"]
)

MODELE_IA = os.environ.get("SIGDP_IA_MODEL", "claude-opus-4-8")

MOIS_FR = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
]


# ---------------------------------------------------------------------------
# Projections statistiques (calculées en Python, commentées par l'IA)
# ---------------------------------------------------------------------------


def calculer_projection_mensuelle(
    valeurs_mensuelles: list, annee: int
) -> Optional[dict]:
    """Projette les mois restants de l'année par régression linéaire
    (moindres carrés) sur les mois déjà observés.

    valeurs_mensuelles : liste de 12 tonnages (janvier -> décembre).
    Retourne None si l'année est close ou si moins de 3 mois portent
    des données (projection non significative).
    """
    maintenant = datetime.utcnow()
    if annee < maintenant.year:
        return None  # année close : rien à projeter
    mois_courant = maintenant.month if annee == maintenant.year else 0
    if mois_courant >= 12:
        return None

    observes = [
        (m, float(valeurs_mensuelles[m - 1])) for m in range(1, mois_courant + 1)
    ]
    if sum(1 for _, v in observes if v > 0) < 3:
        return None

    # Moindres carrés : y = a.x + b
    n = len(observes)
    sx = sum(m for m, _ in observes)
    sy = sum(v for _, v in observes)
    sxx = sum(m * m for m, _ in observes)
    sxy = sum(m * v for m, v in observes)
    denominateur = n * sxx - sx * sx
    if denominateur == 0:
        return None
    a = (n * sxy - sx * sy) / denominateur
    b = (sy - a * sx) / n

    projections = {
        m: max(0.0, round(a * m + b, 2)) for m in range(mois_courant + 1, 13)
    }
    total_observe = round(sum(v for _, v in observes), 2)
    total_projete = round(total_observe + sum(projections.values()), 2)

    return {
        "methode": "Régression linéaire (moindres carrés) sur les mois observés",
        "dernier_mois_observe": MOIS_FR[mois_courant - 1],
        "pente_mensuelle_t": round(a, 3),
        "mois_projetes": {MOIS_FR[m - 1]: v for m, v in projections.items()},
        "mois_projetes_index": projections,  # {n° mois: tonnage} pour le graphique
        "tonnage_observe_annee_t": total_observe,
        "tonnage_annuel_projete_t": total_projete,
    }


# ---------------------------------------------------------------------------
# Collecte des indicateurs (partagée avec le rapport PDF)
# ---------------------------------------------------------------------------


def collecter_donnees_analytiques(
    db: Session, province: Optional[str] = None, annee: Optional[int] = None
) -> dict:
    """Agrège les indicateurs du parc en un dictionnaire JSON-able,
    directement injectable dans le prompt d'analyse."""
    annee = annee or datetime.utcnow().year

    def q_stations():
        q = db.query(StationPiscicole)
        if province:
            q = q.filter(StationPiscicole.province == province)
        return q

    def q_cycles():
        q = db.query(CycleProduction).join(StationPiscicole)
        if province:
            q = q.filter(StationPiscicole.province == province)
        return q

    total = q_stations().count()
    actives = (
        q_stations().filter(StationPiscicole.statut == StatutStationEnum.ACTIVE).count()
    )
    capacite = float(
        q_stations()
        .with_entities(func.coalesce(func.sum(StationPiscicole.capacite_production), 0))
        .scalar()
    )
    tonnage = float(
        q_cycles()
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE)
        .with_entities(func.coalesce(func.sum(CycleProduction.tonnage_recolte), 0))
        .scalar()
    )
    mortalite = (
        q_cycles()
        .filter(CycleProduction.taux_mortalite.isnot(None))
        .with_entities(func.avg(CycleProduction.taux_mortalite))
        .scalar()
    )

    abandons = (
        q_cycles()
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.ABANDONNE)
        .count()
    )
    total_cycles_clos = (
        abandons
        + q_cycles()
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE)
        .count()
    )

    par_province = [
        {"province": p, "stations": int(n)}
        for p, n in q_stations()
        .with_entities(StationPiscicole.province, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.province)
        .order_by(func.count(StationPiscicole.id).desc())
        .all()
    ]
    par_statut = {
        s.name: int(n)
        for s, n in q_stations()
        .with_entities(StationPiscicole.statut, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.statut)
        .all()
    }
    prod_espece = [
        {
            "espece": e,
            "tonnage": round(float(t), 2),
            "cycles": int(n),
            "mortalite_moyenne": round(float(m), 1) if m is not None else None,
        }
        for e, t, n, m in q_cycles()
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE)
        .with_entities(
            CycleProduction.espece,
            func.coalesce(func.sum(CycleProduction.tonnage_recolte), 0),
            func.count(CycleProduction.id),
            func.avg(CycleProduction.taux_mortalite),
        )
        .group_by(CycleProduction.espece)
        .order_by(func.sum(CycleProduction.tonnage_recolte).desc())
        .all()
    ]
    prod_mensuelle_brut = dict(
        q_cycles()
        .filter(
            CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE,
            extract("year", CycleProduction.date_recolte_effective) == annee,
        )
        .with_entities(
            extract("month", CycleProduction.date_recolte_effective),
            func.coalesce(func.sum(CycleProduction.tonnage_recolte), 0),
        )
        .group_by(extract("month", CycleProduction.date_recolte_effective))
        .all()
    )

    valeurs_mensuelles = [
        round(float(prod_mensuelle_brut.get(m, 0)), 2) for m in range(1, 13)
    ]
    projection = calculer_projection_mensuelle(valeurs_mensuelles, annee)

    return {
        "perimetre": province or "national",
        "annee_reference": annee,
        "parc": {
            "stations_recensees": total,
            "stations_actives": actives,
            "repartition_statuts": par_statut,
            "capacite_installee_t_an": round(capacite, 1),
            "repartition_provinces": par_province,
        },
        "production": {
            "tonnage_recolte_cumule_t": round(tonnage, 2),
            "taux_utilisation_capacite_pct": (
                round(tonnage / capacite * 100, 1) if capacite else 0
            ),
            "par_espece": prod_espece,
            "mensuelle_annee_reference": {
                MOIS_FR[m - 1]: valeurs_mensuelles[m - 1] for m in range(1, 13)
            },
            "projection": projection,
        },
        "performance": {
            "taux_mortalite_moyen_pct": (
                round(float(mortalite), 1) if mortalite is not None else None
            ),
            "cycles_abandonnes": abandons,
            "taux_abandon_pct": (
                round(abandons / total_cycles_clos * 100, 1) if total_cycles_clos else 0
            ),
        },
    }


# ---------------------------------------------------------------------------
# Appel à l'API Anthropic
# ---------------------------------------------------------------------------

PROMPT_SYSTEME = """Tu es un analyste senior en aquaculture travaillant pour le \
Ministère de la Mer, de la Pêche et de l'Économie Bleue du Gabon. Tu analyses \
les indicateurs du parc national des stations piscicoles issus du système \
SIGDP-GABON pour éclairer la décision publique.

Ton analyse doit être factuelle, chiffrée, et adaptée au contexte gabonais \
(sécurité alimentaire, réduction des importations de poisson, développement \
de l'économie bleue, emploi rural). Ne fabrique aucun chiffre : appuie-toi \
uniquement sur les données fournies.

Réponds UNIQUEMENT avec un objet JSON valide, sans préambule ni balises \
Markdown, avec exactement ces clés :
{
  "synthese": "paragraphe de synthèse exécutive (4 à 6 phrases)",
  "points_forts": ["3 à 5 constats positifs, chacun en une phrase chiffrée"],
  "points_vigilance": ["3 à 5 alertes ou risques, chacun en une phrase chiffrée"],
  "recommandations": ["3 à 5 recommandations opérationnelles concrètes"]
}"""

CLES_ATTENDUES = ("synthese", "points_forts", "points_vigilance", "recommandations")


def generer_analyse_ia(donnees: dict) -> dict:
    """Envoie les indicateurs à Claude et retourne l'analyse structurée.
    Lève RuntimeError si la clé API est absente ou l'appel échoue."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY non définie : l'analyse IA est indisponible"
        )

    import anthropic  # import local : le module reste optionnel

    client = anthropic.Anthropic()  # lit ANTHROPIC_API_KEY
    try:
        message = client.messages.create(
            model=MODELE_IA,
            max_tokens=2000,
            system=PROMPT_SYSTEME,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Voici les indicateurs du parc aquacole à analyser :\n\n"
                        + json.dumps(donnees, ensure_ascii=False, indent=2)
                    ),
                }
            ],
        )
    except anthropic.APIError as exc:
        raise RuntimeError(f"Appel API Anthropic échoué : {exc}") from exc

    texte = "".join(
        bloc.text for bloc in message.content if getattr(bloc, "type", "") == "text"
    ).strip()

    # Nettoyage défensif d'éventuelles balises Markdown malgré la consigne
    if texte.startswith("```"):
        texte = texte.strip("`")
        if texte.startswith("json"):
            texte = texte[4:]
        texte = texte.strip()

    try:
        analyse = json.loads(texte)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Réponse IA non parsable en JSON : {exc}") from exc

    for cle in CLES_ATTENDUES:
        if cle not in analyse:
            raise RuntimeError(f"Clé '{cle}' absente de la réponse IA")
    # Normalisation : listes de chaînes garanties
    for cle in ("points_forts", "points_vigilance", "recommandations"):
        if isinstance(analyse[cle], str):
            analyse[cle] = [analyse[cle]]
        analyse[cle] = [str(x) for x in analyse[cle]]

    return {
        "modele": MODELE_IA,
        "genere_le": datetime.utcnow().isoformat() + "Z",
        **{cle: analyse[cle] for cle in CLES_ATTENDUES},
    }


PROMPT_GRAPHIQUES = """Tu es un analyste senior en aquaculture au Ministère de \
la Mer, de la Pêche et de l'Économie Bleue du Gabon. On te fournit les données \
sous-jacentes des quatre graphiques d'un rapport SIGDP-GABON, ainsi qu'une \
projection statistique de la production mensuelle (régression linéaire) \
calculée en amont.

Pour CHAQUE graphique, rédige trois éléments courts et chiffrés :
- "lecture"    : ce que montre le graphique (1-2 phrases, cite les valeurs clés)
- "tendance"   : la dynamique ou le déséquilibre notable (1-2 phrases)
- "prediction" : une projection argumentée à 6-12 mois (1-2 phrases). Pour le \
graphique mensuel, appuie-toi sur la projection statistique fournie en la \
nuançant (saisonnalité, cycles en cours, capacité installée). Formule les \
prédictions au conditionnel et ne fabrique aucun chiffre non déductible des \
données.

Réponds UNIQUEMENT avec un objet JSON valide, sans préambule ni balises \
Markdown, avec exactement cette structure :
{
  "provinces": {"lecture": "...", "tendance": "...", "prediction": "..."},
  "structure": {"lecture": "...", "tendance": "...", "prediction": "..."},
  "especes":   {"lecture": "...", "tendance": "...", "prediction": "..."},
  "mensuel":   {"lecture": "...", "tendance": "...", "prediction": "..."}
}
"provinces" = stations par province ; "structure" = répartition par type \
d'installation et par statut ; "especes" = tonnage récolté par espèce ; \
"mensuel" = production mensuelle et sa projection."""

CLES_GRAPHIQUES = ("provinces", "structure", "especes", "mensuel")
SOUS_CLES_GRAPHIQUES = ("lecture", "tendance", "prediction")


def generer_analyse_graphiques(donnees: dict) -> dict:
    """Analyse IA de chaque graphique du rapport, avec prédictions.
    Un seul appel API pour les quatre graphiques."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise RuntimeError(
            "ANTHROPIC_API_KEY non définie : l'analyse IA est indisponible"
        )

    import anthropic

    contexte = {
        "graphique_provinces": donnees["parc"]["repartition_provinces"],
        "graphique_structure": {
            "par_statut": donnees["parc"]["repartition_statuts"],
            "stations_recensees": donnees["parc"]["stations_recensees"],
        },
        "graphique_especes": donnees["production"]["par_espece"],
        "graphique_mensuel": donnees["production"]["mensuelle_annee_reference"],
        "projection_statistique": donnees["production"].get("projection"),
        "contexte_general": {
            "annee_reference": donnees["annee_reference"],
            "perimetre": donnees["perimetre"],
            "capacite_installee_t_an": donnees["parc"]["capacite_installee_t_an"],
            "taux_mortalite_moyen_pct": donnees["performance"][
                "taux_mortalite_moyen_pct"
            ],
            "taux_abandon_pct": donnees["performance"]["taux_abandon_pct"],
        },
    }

    client = anthropic.Anthropic()
    try:
        message = client.messages.create(
            model=MODELE_IA,
            max_tokens=2500,
            system=PROMPT_GRAPHIQUES,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Données des graphiques à analyser :\n\n"
                        + json.dumps(contexte, ensure_ascii=False, indent=2)
                    ),
                }
            ],
        )
    except anthropic.APIError as exc:
        raise RuntimeError(f"Appel API Anthropic échoué : {exc}") from exc

    texte = "".join(
        bloc.text for bloc in message.content if getattr(bloc, "type", "") == "text"
    ).strip()
    if texte.startswith("```"):
        texte = texte.strip("`")
        if texte.startswith("json"):
            texte = texte[4:]
        texte = texte.strip()

    try:
        analyses = json.loads(texte)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Réponse IA non parsable en JSON : {exc}") from exc

    for cle in CLES_GRAPHIQUES:
        if cle not in analyses:
            raise RuntimeError(f"Graphique '{cle}' absent de la réponse IA")
        for sous_cle in SOUS_CLES_GRAPHIQUES:
            analyses[cle][sous_cle] = str(analyses[cle].get(sous_cle, "")).strip()

    return {
        "modele": MODELE_IA,
        "genere_le": datetime.utcnow().isoformat() + "Z",
        "graphiques": {cle: analyses[cle] for cle in CLES_GRAPHIQUES},
    }


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


class AnalyseRequest(BaseModel):
    province: Optional[str] = None
    annee: Optional[int] = None


@router.post("/analyse-ia")
def analyse_ia(req: AnalyseRequest, db: Session = Depends(get_db)):
    """Analyse IA des indicateurs, pour affichage dans le frontend."""
    donnees = collecter_donnees_analytiques(db, req.province, req.annee)
    if donnees["parc"]["stations_recensees"] == 0:
        raise HTTPException(
            status_code=400, detail="Aucune station dans le périmètre demandé"
        )
    try:
        analyse = generer_analyse_ia(donnees)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return {"donnees": donnees, "analyse": analyse}


@router.post("/analyse-graphiques")
def analyse_graphiques(req: AnalyseRequest, db: Session = Depends(get_db)):
    """Analyse IA de chaque graphique du rapport (lecture, tendance,
    prédiction), avec projection statistique de la production mensuelle."""
    donnees = collecter_donnees_analytiques(db, req.province, req.annee)
    if donnees["parc"]["stations_recensees"] == 0:
        raise HTTPException(
            status_code=400, detail="Aucune station dans le périmètre demandé"
        )
    try:
        analyses = generer_analyse_graphiques(donnees)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return {
        "projection": donnees["production"].get("projection"),
        "analyses": analyses,
    }
