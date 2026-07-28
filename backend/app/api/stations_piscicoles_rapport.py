# -*- coding: utf-8 -*-
"""
Rapport analytique — Module Stations Piscicoles (SIGDP-GABON)

POST /stations-piscicoles/rapport/analytique -> PDF A4 portrait :
  1. Chiffres clés du parc aquacole
  2. Analyse territoriale (tableau par province + graphique en barres)
  3. Répartitions par type et statut (camemberts)
  4. Production : tonnage par espèce, production mensuelle, top stations
  5. Performance : mortalité par espèce, durée moyenne des cycles

Filtres optionnels : province, annee (production mensuelle et cycles).
Dépendances : pip install matplotlib reportlab
"""

import io
from datetime import datetime
from typing import Optional

import matplotlib

matplotlib.use("Agg")  # backend sans affichage — indispensable côté serveur
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    Image,
    PageBreak,
)

from app.database import get_db  # à ajuster selon l'arborescence
from app.models.stations_piscicole import (
    StationPiscicole,
    CycleProduction,
    StatutStationEnum,
    StatutCycleEnum,
)

router = APIRouter(
    prefix="/api/stations-piscicoles/rapport", tags=["Stations piscicoles - Rapports"]
)

# ---------------------------------------------------------------------------
# Charte graphique (verte, cohérente avec les registres)
# ---------------------------------------------------------------------------

VERT_FONCE = "#1b5e20"
PALETTE = [
    "#1b5e20",
    "#43a047",
    "#7cb342",
    "#c0ca33",
    "#fdd835",
    "#fb8c00",
    "#6d4c41",
    "#00897b",
    "#546e7a",
]
COULEURS_STATUT = {
    "EN_CONSTRUCTION": "#fb8c00",
    "ACTIVE": "#43a047",
    "SUSPENDUE": "#f9a825",
    "FERMEE": "#e53935",
}
LABELS_STATUT = {
    "EN_CONSTRUCTION": "En construction",
    "ACTIVE": "Active",
    "SUSPENDUE": "Suspendue",
    "FERMEE": "Fermée",
}
LABELS_TYPE = {
    "ETANGS": "Étangs",
    "BACS_HORS_SOL": "Bacs hors-sol",
    "CAGES_FLOTTANTES": "Cages flottantes",
    "ECLOSERIE": "Écloserie",
    "MIXTE": "Mixte",
}
MOIS_FR = [
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

plt.rcParams.update(
    {
        "font.size": 8,
        "axes.titlesize": 9,
        "axes.titleweight": "bold",
        "axes.edgecolor": "#bdbdbd",
        "axes.linewidth": 0.6,
        "axes.grid": True,
        "grid.color": "#eeeeee",
        "grid.linewidth": 0.5,
        "figure.facecolor": "white",
    }
)


class RapportRequest(BaseModel):
    province: Optional[str] = None
    annee: Optional[int] = None  # défaut : année en cours
    avec_analyse_ia: bool = False  # section 6 rédigée par l'IA (clé API requise)


# ---------------------------------------------------------------------------
# Graphiques matplotlib -> Image reportlab
# ---------------------------------------------------------------------------


def _figure_vers_image(fig, largeur_mm: float) -> Image:
    """Rend une figure matplotlib en PNG haute résolution pour reportlab."""
    tampon = io.BytesIO()
    fig.savefig(tampon, format="png", dpi=150, bbox_inches="tight")
    plt.close(fig)  # IMPORTANT : libérer la mémoire à chaque figure
    tampon.seek(0)
    # Conserver le ratio d'aspect
    from reportlab.lib.utils import ImageReader

    lecteur = ImageReader(tampon)
    l_px, h_px = lecteur.getSize()
    tampon.seek(0)
    largeur = largeur_mm * mm
    return Image(tampon, width=largeur, height=largeur * h_px / l_px)


def _graphique_barres(
    labels,
    valeurs,
    titre,
    ylabel,
    largeur_mm=170,
    couleur=VERT_FONCE,
    rotation=30,
    taille=(7.2, 2.8),
):
    fig, ax = plt.subplots(figsize=taille)
    barres = ax.bar(labels, valeurs, color=couleur, width=0.65)
    ax.set_title(titre)
    ax.set_ylabel(ylabel)
    ax.yaxis.set_major_locator(MaxNLocator(integer=True, nbins=6))
    ax.set_axisbelow(True)
    plt.xticks(rotation=rotation, ha="right" if rotation else "center")
    for barre, valeur in zip(barres, valeurs):
        if valeur:
            ax.annotate(
                f"{valeur:g}",
                (barre.get_x() + barre.get_width() / 2, barre.get_height()),
                ha="center",
                va="bottom",
                fontsize=7,
            )
    return _figure_vers_image(fig, largeur_mm)


def _graphique_camembert(labels, valeurs, titre, couleurs=None, largeur_mm=80):
    fig, ax = plt.subplots(figsize=(3.4, 3.0))
    donnees = [(l, v) for l, v in zip(labels, valeurs) if v > 0]
    if not donnees:
        ax.text(0.5, 0.5, "Aucune donnée", ha="center", va="center")
        ax.axis("off")
        ax.set_title(titre)
        return _figure_vers_image(fig, largeur_mm)
    labels_nz, valeurs_nz = zip(*donnees)
    couleurs_nz = (
        [couleurs[labels.index(l)] for l in labels_nz]
        if couleurs
        else PALETTE[: len(labels_nz)]
    )
    ax.pie(
        valeurs_nz,
        labels=labels_nz,
        colors=couleurs_nz,
        autopct="%1.0f%%",
        startangle=90,
        textprops={"fontsize": 7},
        wedgeprops={"edgecolor": "white", "linewidth": 1},
    )
    ax.set_title(titre)
    return _figure_vers_image(fig, largeur_mm)


def _graphique_mensuel_avec_projection(valeurs, projection, annee, largeur_mm=170):
    """Histogramme mensuel : barres pleines pour l'observé, hachurées pour
    les mois projetés (régression linéaire)."""
    fig, ax = plt.subplots(figsize=(7.2, 2.8))
    mois = list(range(1, 13))
    reels = list(valeurs)
    projetes = [0.0] * 12
    if projection:
        for m, v in projection["mois_projetes_index"].items():
            projetes[int(m) - 1] = v
            reels[int(m) - 1] = 0.0

    barres_reelles = ax.bar(mois, reels, color="#7cb342", width=0.65, label="Observé")
    if projection and any(projetes):
        ax.bar(
            mois,
            projetes,
            color="#c5e1a5",
            width=0.65,
            hatch="///",
            edgecolor="#7cb342",
            linewidth=0.8,
            label="Projeté (régression linéaire)",
        )
        ax.legend(fontsize=7, frameon=False, loc="upper left")

    ax.set_title(
        f"Production mensuelle {annee}" + (" — avec projection" if projection else "")
    )
    ax.set_ylabel("Tonnes")
    ax.set_xticks(mois)
    ax.set_xticklabels(MOIS_FR)
    ax.yaxis.set_major_locator(MaxNLocator(nbins=6))
    ax.set_axisbelow(True)
    for x, (r, p) in enumerate(zip(reels, projetes), start=1):
        valeur = r or p
        if valeur:
            ax.annotate(
                f"{valeur:g}", (x, valeur), ha="center", va="bottom", fontsize=6.5
            )
    return _figure_vers_image(fig, largeur_mm)


STYLE_BLOC_IA = ParagraphStyle(
    "bloc_ia",
    fontName="Helvetica",
    fontSize=7.5,
    leading=10.5,
    textColor=colors.HexColor("#33691e"),
)


def _bloc_analyse_ia(analyse: dict):
    """Encadré vert pâle inséré sous un graphique : lecture / tendance /
    prédiction rédigées par l'IA."""
    texte = (
        f"<b>Lecture :</b> {analyse.get('lecture', '')}<br/>"
        f"<b>Tendance :</b> {analyse.get('tendance', '')}<br/>"
        f"<b>Prédiction :</b> {analyse.get('prediction', '')}"
    )
    bloc = Table([[Paragraph(texte, STYLE_BLOC_IA)]], colWidths=[174 * mm])
    bloc.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f8e9")),
                ("LINEBEFORE", (0, 0), (0, -1), 2, colors.HexColor(VERT_FONCE)),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return bloc


# ---------------------------------------------------------------------------
# Tableaux reportlab
# ---------------------------------------------------------------------------

STYLE_CELLULE = ParagraphStyle(
    "cellule", fontName="Helvetica", fontSize=7.5, leading=9.5
)
STYLE_ENTETE_TABLE = ParagraphStyle(
    "entete_t",
    fontName="Helvetica-Bold",
    fontSize=8,
    leading=10,
    textColor=colors.white,
)


def _tableau(entetes, lignes, largeurs=None, alignements_droite=()):
    donnees = [[Paragraph(str(e), STYLE_ENTETE_TABLE) for e in entetes]]
    for ligne in lignes:
        donnees.append([Paragraph(str(v), STYLE_CELLULE) for v in ligne])
    table = Table(donnees, colWidths=largeurs, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(VERT_FONCE)),
        (
            "ROWBACKGROUNDS",
            (0, 1),
            (-1, -1),
            [colors.white, colors.HexColor("#f1f8e9")],
        ),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bdbdbd")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]
    for col in alignements_droite:
        style.append(("ALIGN", (col, 1), (col, -1), "RIGHT"))
    table.setStyle(TableStyle(style))
    return table


# ---------------------------------------------------------------------------
# En-tête / pied de page
# ---------------------------------------------------------------------------


def _entete_pied(canvas, doc):
    canvas.saveState()
    largeur, hauteur = A4
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(18 * mm, hauteur - 12 * mm, "RÉPUBLIQUE GABONAISE")
    canvas.setFont("Helvetica-Oblique", 7)
    canvas.drawString(18 * mm, hauteur - 16 * mm, "Union — Travail — Justice")
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawCentredString(
        largeur / 2, hauteur - 10 * mm, "MINISTÈRE DE LA MER, DE LA PÊCHE"
    )
    canvas.drawCentredString(largeur / 2, hauteur - 14 * mm, "ET DE L'ÉCONOMIE BLEUE")
    canvas.setFont("Helvetica", 7)
    canvas.drawCentredString(largeur / 2, hauteur - 18 * mm, "SIGDP-GABON")
    canvas.drawRightString(
        largeur - 18 * mm,
        hauteur - 12 * mm,
        f"Édité le {datetime.utcnow().strftime('%d/%m/%Y')}",
    )
    canvas.setFillColor(colors.HexColor("#777777"))
    canvas.drawCentredString(
        largeur / 2,
        10 * mm,
        f"Rapport analytique — Stations piscicoles " f"— Page {doc.page}",
    )
    canvas.restoreState()


# ---------------------------------------------------------------------------
# Rapport
# ---------------------------------------------------------------------------


@router.post("/analytique")
def rapport_analytique(req: RapportRequest, db: Session = Depends(get_db)):
    annee = req.annee or datetime.utcnow().year

    from app.api.stations_piscicoles_analyses_ia import calculer_projection_mensuelle

    # Filtre province optionnel appliqué à toutes les requêtes
    def q_stations():
        q = db.query(StationPiscicole)
        if req.province:
            q = q.filter(StationPiscicole.province == req.province)
        return q

    def q_cycles():
        q = db.query(CycleProduction).join(StationPiscicole)
        if req.province:
            q = q.filter(StationPiscicole.province == req.province)
        return q

    # ------------------------- 1. Chiffres clés -------------------------
    total_stations = q_stations().count()
    actives = (
        q_stations().filter(StationPiscicole.statut == StatutStationEnum.ACTIVE).count()
    )
    superficie = (
        q_stations()
        .with_entities(func.coalesce(func.sum(StationPiscicole.superficie_totale), 0))
        .scalar()
    )
    capacite = (
        q_stations()
        .with_entities(func.coalesce(func.sum(StationPiscicole.capacite_production), 0))
        .scalar()
    )
    cycles_en_cours = (
        q_cycles()
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.EN_COURS)
        .count()
    )
    tonnage_total = (
        q_cycles()
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE)
        .with_entities(func.coalesce(func.sum(CycleProduction.tonnage_recolte), 0))
        .scalar()
    )
    mortalite_moyenne = (
        q_cycles()
        .filter(CycleProduction.taux_mortalite.isnot(None))
        .with_entities(func.avg(CycleProduction.taux_mortalite))
        .scalar()
    )

    taux_utilisation = float(tonnage_total) / float(capacite) * 100 if capacite else 0

    # ------------------------- 2. Par province -------------------------
    provinces_brut = (
        q_stations()
        .with_entities(
            StationPiscicole.province,
            func.count(StationPiscicole.id),
            func.coalesce(func.sum(StationPiscicole.superficie_totale), 0),
            func.coalesce(func.sum(StationPiscicole.capacite_production), 0),
        )
        .group_by(StationPiscicole.province)
        .order_by(func.count(StationPiscicole.id).desc())
        .all()
    )
    actives_par_province = dict(
        q_stations()
        .filter(StationPiscicole.statut == StatutStationEnum.ACTIVE)
        .with_entities(StationPiscicole.province, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.province)
        .all()
    )

    # ------------------------- 3. Répartitions -------------------------
    par_type = dict(
        q_stations()
        .with_entities(StationPiscicole.type_station, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.type_station)
        .all()
    )
    par_statut = dict(
        q_stations()
        .with_entities(StationPiscicole.statut, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.statut)
        .all()
    )

    # ------------------------- 4. Production -------------------------
    prod_espece = (
        q_cycles()
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
    )

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
    prod_mensuelle = [float(prod_mensuelle_brut.get(m, 0)) for m in range(1, 13)]

    top_stations = (
        q_cycles()
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE)
        .with_entities(
            StationPiscicole.code_station,
            StationPiscicole.nom,
            StationPiscicole.province,
            func.coalesce(func.sum(CycleProduction.tonnage_recolte), 0),
            func.count(CycleProduction.id),
        )
        .group_by(StationPiscicole.id)
        .order_by(func.sum(CycleProduction.tonnage_recolte).desc())
        .limit(10)
        .all()
    )

    # Durée moyenne des cycles récoltés (jours)
    cycles_recoltes = (
        q_cycles()
        .filter(
            CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE,
            CycleProduction.date_recolte_effective.isnot(None),
        )
        .all()
    )
    durees = [
        (c.date_recolte_effective - c.date_empoissonnement).days
        for c in cycles_recoltes
        if c.date_recolte_effective >= c.date_empoissonnement
    ]
    duree_moyenne = sum(durees) / len(durees) if durees else 0

    indicateurs = {
        "total_stations": total_stations,
        "stations_actives": actives,
        "cycles_en_cours": cycles_en_cours,
        "tonnage_total_recolte": tonnage_total,
        "superficie_totale_m2": round(superficie, 0),
        "capacite_installee_t_an": round(capacite, 1),
        "taux_utilisation_pct": (
            round(tonnage_total / capacite * 100, 1) if capacite else 0
        ),
        "taux_mortalite_moyen_pct": (
            round(float(mortalite_moyenne), 1)
            if mortalite_moyenne is not None
            else None
        ),
        "duree_moyenne_cycle_jours": (
            round(sum(durees) / len(durees)) if durees else None
        ),
    }

    par_province = {
        "labels": [p for p, *_ in provinces_brut],
        "data": [int(n) for _, n, *_ in provinces_brut],
    }

    analyse_par_statut = {
        # "labels": [LABELS_STATUT.get(s.name, s.name) for s in par_statut],
        "labels": [s.name for s in par_statut],
        "data": list(par_statut.values()),
    }

    analyse_par_type = {
        "labels": [LABELS_TYPE.get(t.name, t.name) for t in par_type],
        "data": list(par_type.values()),
    }

    production_par_espece = {
        "labels": [e for e, *_ in prod_espece],
        "data": [round(float(t), 2) for _, t, *_ in prod_espece],
    }

    analyse_production_mensuelle = {
        "labels": MOIS_FR,
        "data": prod_mensuelle,
    }

    # print(analyse_par_statut)

    return {
        "perimetre": req.province or "national",
        "annee": annee,
        "indicateurs": indicateurs,
        "par_province": par_province,
        "par_statut": analyse_par_statut,
        "par_type": analyse_par_type,
        "production_par_espece": production_par_espece,
        "production_mensuelle": analyse_production_mensuelle,
        "projection": calculer_projection_mensuelle(prod_mensuelle, annee),
    }


@router.post("/generer")
def rapport_analytique_generer(req: RapportRequest, db: Session = Depends(get_db)):
    annee = req.annee or datetime.utcnow().year

    # Filtre province optionnel appliqué à toutes les requêtes
    def q_stations():
        q = db.query(StationPiscicole)
        if req.province:
            q = q.filter(StationPiscicole.province == req.province)
        return q

    def q_cycles():
        q = db.query(CycleProduction).join(StationPiscicole)
        if req.province:
            q = q.filter(StationPiscicole.province == req.province)
        return q

    # ------------------------- 1. Chiffres clés -------------------------
    total_stations = q_stations().count()
    actives = (
        q_stations().filter(StationPiscicole.statut == StatutStationEnum.ACTIVE).count()
    )
    superficie = (
        q_stations()
        .with_entities(func.coalesce(func.sum(StationPiscicole.superficie_totale), 0))
        .scalar()
    )
    capacite = (
        q_stations()
        .with_entities(func.coalesce(func.sum(StationPiscicole.capacite_production), 0))
        .scalar()
    )
    cycles_en_cours = (
        q_cycles()
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.EN_COURS)
        .count()
    )
    tonnage_total = (
        q_cycles()
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE)
        .with_entities(func.coalesce(func.sum(CycleProduction.tonnage_recolte), 0))
        .scalar()
    )
    mortalite_moyenne = (
        q_cycles()
        .filter(CycleProduction.taux_mortalite.isnot(None))
        .with_entities(func.avg(CycleProduction.taux_mortalite))
        .scalar()
    )

    taux_utilisation = float(tonnage_total) / float(capacite) * 100 if capacite else 0

    # ------------------------- 2. Par province -------------------------
    provinces_brut = (
        q_stations()
        .with_entities(
            StationPiscicole.province,
            func.count(StationPiscicole.id),
            func.coalesce(func.sum(StationPiscicole.superficie_totale), 0),
            func.coalesce(func.sum(StationPiscicole.capacite_production), 0),
        )
        .group_by(StationPiscicole.province)
        .order_by(func.count(StationPiscicole.id).desc())
        .all()
    )
    actives_par_province = dict(
        q_stations()
        .filter(StationPiscicole.statut == StatutStationEnum.ACTIVE)
        .with_entities(StationPiscicole.province, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.province)
        .all()
    )

    # ------------------------- 3. Répartitions -------------------------
    par_type = dict(
        q_stations()
        .with_entities(StationPiscicole.type_station, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.type_station)
        .all()
    )
    par_statut = dict(
        q_stations()
        .with_entities(StationPiscicole.statut, func.count(StationPiscicole.id))
        .group_by(StationPiscicole.statut)
        .all()
    )

    # ------------------------- 4. Production -------------------------
    prod_espece = (
        q_cycles()
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
    )

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
    prod_mensuelle = [float(prod_mensuelle_brut.get(m, 0)) for m in range(1, 13)]

    top_stations = (
        q_cycles()
        .filter(CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE)
        .with_entities(
            StationPiscicole.code_station,
            StationPiscicole.nom,
            StationPiscicole.province,
            func.coalesce(func.sum(CycleProduction.tonnage_recolte), 0),
            func.count(CycleProduction.id),
        )
        .group_by(StationPiscicole.id)
        .order_by(func.sum(CycleProduction.tonnage_recolte).desc())
        .limit(10)
        .all()
    )

    # Durée moyenne des cycles récoltés (jours)
    cycles_recoltes = (
        q_cycles()
        .filter(
            CycleProduction.statut_cycle == StatutCycleEnum.RECOLTE,
            CycleProduction.date_recolte_effective.isnot(None),
        )
        .all()
    )
    durees = [
        (c.date_recolte_effective - c.date_empoissonnement).days
        for c in cycles_recoltes
        if c.date_recolte_effective >= c.date_empoissonnement
    ]
    duree_moyenne = sum(durees) / len(durees) if durees else 0

    # ==================== Construction du document ====================
    tampon = io.BytesIO()
    doc = SimpleDocTemplate(
        tampon,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=28 * mm,
        bottomMargin=18 * mm,
        title="Rapport analytique — Stations piscicoles",
    )

    style_titre = ParagraphStyle(
        "titre", fontName="Helvetica-Bold", fontSize=15, alignment=1, spaceAfter=2
    )
    style_sous_titre = ParagraphStyle(
        "sous_titre",
        fontName="Helvetica",
        fontSize=9,
        alignment=1,
        textColor=colors.HexColor("#555555"),
        spaceAfter=10,
    )
    style_section = ParagraphStyle(
        "section",
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=colors.HexColor(VERT_FONCE),
        spaceBefore=12,
        spaceAfter=6,
        borderPadding=(0, 0, 2, 0),
    )
    style_note = ParagraphStyle(
        "note",
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        textColor=colors.HexColor("#777777"),
        spaceAfter=4,
    )

    perimetre = f"Province : {req.province}" if req.province else "Périmètre national"

    # Analyses IA par graphique + projection (optionnelles, un seul appel API)
    analyses_graphiques = None
    projection = None
    if req.avec_analyse_ia:
        try:
            from app.api.stations_piscicoles_analyses_ia import (
                collecter_donnees_analytiques,
                generer_analyse_graphiques,
            )

            donnees_ia = collecter_donnees_analytiques(db, req.province, annee)
            projection = donnees_ia["production"].get("projection")
            analyses_graphiques = generer_analyse_graphiques(donnees_ia)["graphiques"]
        except Exception:
            analyses_graphiques = None  # dégradation : rapport sans commentaires

    elements = [
        Paragraph("RAPPORT ANALYTIQUE DU PARC AQUACOLE", style_titre),
        Paragraph(f"{perimetre} — Année de référence : {annee}", style_sous_titre),
    ]

    # ----- Section 1 : chiffres clés -----
    elements.append(Paragraph("1. Chiffres clés", style_section))
    elements.append(
        _tableau(
            ["Indicateur", "Valeur"],
            [
                ["Stations recensées", f"{total_stations}"],
                [
                    "Stations actives",
                    (
                        f"{actives} ({actives / total_stations * 100:.0f} %)"
                        if total_stations
                        else "0"
                    ),
                ],
                [
                    "Superficie aquacole totale",
                    f"{float(superficie):,.0f} m²".replace(",", " "),
                ],
                [
                    "Capacité de production installée",
                    f"{float(capacite):,.1f} t/an".replace(",", " "),
                ],
                ["Cycles de production en cours", f"{cycles_en_cours}"],
                [
                    "Tonnage récolté cumulé",
                    f"{float(tonnage_total):,.2f} t".replace(",", " "),
                ],
                ["Taux d'utilisation de la capacité", f"{taux_utilisation:.1f} %"],
                [
                    "Taux de mortalité moyen",
                    f"{float(mortalite_moyenne):.1f} %" if mortalite_moyenne else "—",
                ],
                [
                    "Durée moyenne d'un cycle récolté",
                    f"{duree_moyenne:.0f} jours" if durees else "—",
                ],
            ],
            largeurs=[95 * mm, 79 * mm],
            alignements_droite=(1,),
        )
    )

    # ----- Section 2 : analyse territoriale -----
    elements.append(Paragraph("2. Analyse territoriale", style_section))
    if provinces_brut:
        elements.append(
            _graphique_barres(
                [p for p, *_ in provinces_brut],
                [int(n) for _, n, *_ in provinces_brut],
                "Stations par province",
                "Stations",
            )
        )
        if analyses_graphiques:
            elements.append(Spacer(1, 2 * mm))
            elements.append(_bloc_analyse_ia(analyses_graphiques["provinces"]))
        elements.append(Spacer(1, 4 * mm))
        elements.append(
            _tableau(
                [
                    "Province",
                    "Stations",
                    "Actives",
                    "Superficie (m²)",
                    "Capacité (t/an)",
                ],
                [
                    [
                        p,
                        int(n),
                        actives_par_province.get(p, 0),
                        f"{float(s):,.0f}".replace(",", " "),
                        f"{float(c):,.1f}".replace(",", " "),
                    ]
                    for p, n, s, c in provinces_brut
                ],
                largeurs=[46 * mm, 26 * mm, 26 * mm, 38 * mm, 38 * mm],
                alignements_droite=(1, 2, 3, 4),
            )
        )
    else:
        elements.append(Paragraph("Aucune station dans le périmètre.", style_note))

    # ----- Section 3 : répartitions (2 camemberts côte à côte) -----
    elements.append(Paragraph("3. Structure du parc", style_section))
    camembert_type = _graphique_camembert(
        [LABELS_TYPE.get(t.name, t.name) for t in par_type],
        list(par_type.values()),
        "Par type d'installation",
    )
    camembert_statut = _graphique_camembert(
        [LABELS_STATUT.get(s.name, s.name) for s in par_statut],
        list(par_statut.values()),
        "Par statut",
        couleurs=[COULEURS_STATUT.get(s.name, "#999999") for s in par_statut],
    )
    table_camemberts = Table(
        [[camembert_type, camembert_statut]], colWidths=[87 * mm, 87 * mm]
    )
    table_camemberts.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    elements.append(table_camemberts)
    if analyses_graphiques:
        elements.append(Spacer(1, 2 * mm))
        elements.append(_bloc_analyse_ia(analyses_graphiques["structure"]))

    elements.append(PageBreak())

    # ----- Section 4 : production -----
    elements.append(Paragraph("4. Production aquacole", style_section))
    if prod_espece:
        elements.append(
            _graphique_barres(
                [e for e, *_ in prod_espece],
                [round(float(t), 2) for _, t, *_ in prod_espece],
                "Tonnage récolté par espèce (cumul)",
                "Tonnes",
                rotation=0,
                couleur="#00897b",
            )
        )
        if analyses_graphiques:
            elements.append(Spacer(1, 2 * mm))
            elements.append(_bloc_analyse_ia(analyses_graphiques["especes"]))
        elements.append(Spacer(1, 4 * mm))
        elements.append(
            _tableau(
                [
                    "Espèce",
                    "Tonnage récolté (t)",
                    "Cycles récoltés",
                    "Mortalité moyenne (%)",
                ],
                [
                    [
                        e,
                        f"{float(t):.2f}",
                        int(n),
                        f"{float(m):.1f}" if m is not None else "—",
                    ]
                    for e, t, n, m in prod_espece
                ],
                largeurs=[50 * mm, 45 * mm, 38 * mm, 41 * mm],
                alignements_droite=(1, 2, 3),
            )
        )
    else:
        elements.append(Paragraph("Aucun cycle récolté.", style_note))

    elements.append(Spacer(1, 5 * mm))
    elements.append(
        _graphique_mensuel_avec_projection(
            [round(v, 2) for v in prod_mensuelle], projection, annee
        )
    )
    note_mensuelle = (
        "Tonnage des cycles dont la récolte effective est "
        f"intervenue au cours de l'année {annee}."
    )
    if projection:
        note_mensuelle += (
            f" Mois hachurés : projection par {projection['methode'].lower()}"
            f" — tonnage annuel projeté :"
            f" {projection['tonnage_annuel_projete_t']:.2f} t."
        )
    elements.append(Paragraph(note_mensuelle, style_note))
    if analyses_graphiques:
        elements.append(Spacer(1, 2 * mm))
        elements.append(_bloc_analyse_ia(analyses_graphiques["mensuel"]))

    # ----- Section 5 : top stations -----
    elements.append(Paragraph("5. Stations les plus productives", style_section))
    if top_stations:
        elements.append(
            _tableau(
                ["Rang", "Code", "Station", "Province", "Tonnage (t)", "Cycles"],
                [
                    [i, code, nom, prov, f"{float(t):.2f}", int(n)]
                    for i, (code, nom, prov, t, n) in enumerate(top_stations, start=1)
                ],
                largeurs=[13 * mm, 26 * mm, 60 * mm, 30 * mm, 26 * mm, 19 * mm],
                alignements_droite=(4, 5),
            )
        )
    else:
        elements.append(Paragraph("Aucune donnée de production.", style_note))

    # ----- Section 6 : analyse et recommandations (IA, optionnelle) -----
    if req.avec_analyse_ia:
        style_ia_texte = ParagraphStyle(
            "ia_texte",
            fontName="Helvetica",
            fontSize=8.5,
            leading=12,
            alignment=4,
            spaceAfter=6,
        )  # 4 = justifié
        style_ia_puce = ParagraphStyle(
            "ia_puce",
            parent=style_ia_texte,
            leftIndent=6 * mm,
            bulletIndent=2 * mm,
            spaceAfter=2,
        )
        style_ia_sous = ParagraphStyle(
            "ia_sous",
            fontName="Helvetica-Bold",
            fontSize=9,
            spaceBefore=6,
            spaceAfter=3,
        )

        elements.append(PageBreak())
        elements.append(Paragraph("6. Analyse et recommandations", style_section))
        try:
            from app.api.stations_piscicoles_analyses_ia import (
                collecter_donnees_analytiques,
                generer_analyse_ia,
            )

            donnees_ia = collecter_donnees_analytiques(db, req.province, annee)
            analyse = generer_analyse_ia(donnees_ia)

            elements.append(Paragraph("Synthèse", style_ia_sous))
            elements.append(Paragraph(analyse["synthese"], style_ia_texte))

            for titre, cle, puce in (
                ("Points forts", "points_forts", "✔"),
                ("Points de vigilance", "points_vigilance", "⚠"),
                ("Recommandations", "recommandations", "→"),
            ):
                elements.append(Paragraph(titre, style_ia_sous))
                for item in analyse[cle]:
                    elements.append(Paragraph(item, style_ia_puce, bulletText=puce))

            elements.append(Spacer(1, 4 * mm))
            elements.append(
                Paragraph(
                    f"Analyse générée par intelligence artificielle "
                    f"(modèle {analyse['modele']}) à partir des indicateurs "
                    f"du présent rapport. Elle constitue une aide à la décision "
                    f"et ne se substitue pas à l'expertise des services du "
                    f"Ministère.",
                    style_note,
                )
            )
        except Exception as exc:
            elements.append(
                Paragraph(
                    f"L'analyse assistée par IA n'a pas pu être générée : {exc}",
                    style_note,
                )
            )

    doc.build(elements, onFirstPage=_entete_pied, onLaterPages=_entete_pied)
    tampon.seek(0)

    nom_fichier = (
        f"rapport_stations_piscicoles_" f"{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    )
    return StreamingResponse(
        tampon,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'},
    )
