# -*- coding: utf-8 -*-
"""
Rapport statistique PDF des débarquements — SIGDP / SIGPA
=========================================================

Endpoint FastAPI (POST) qui calcule les statistiques de débarquement sur une
période et renvoie un PDF (graphiques matplotlib + mise en page reportlab).

Architecture volontairement séparée en deux couches :
    * collect_stats(db, req)  -> agrégations SQLAlchemy (dépend de la BD)
    * build_pdf(stats)        -> rendu PDF pur (testable sans BD)

⚠️  À ADAPTER À VOTRE PROJET :
    - imports `database` / `models` (chemins réels)
    - noms de colonnes des modèles liés :
        Debarcadere.nom        -> libellé du débarcadère
        Espece.nom_commun      -> libellé de l'espèce
      (modifiez les .label ci-dessous si votre schéma diffère)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, time
from io import BytesIO
from typing import Optional

import matplotlib

matplotlib.use("Agg")  # backend sans affichage (serveur)
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate,
    PageTemplate,
    Frame,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
)

# --- imports projet (À ADAPTER) --------------------------------------------
from app.database import get_db  # noqa: E402  (votre session)
from app.models import (  # noqa: E402
    Debarquement,
    DetailDebarquement,
    Debarcadere,
    Espece,
)

router = APIRouter(
    prefix="/api/debarquements/rapports", tags=["Débarquements · Rapports"]
)


# ===========================================================================
# 1. Schéma de requête (Pydantic v2)
# ===========================================================================
class RapportStatsRequest(BaseModel):
    date_debut: date
    date_fin: date
    debarcadere_id: Optional[int] = None
    top_n: int = Field(
        default=10, ge=3, le=30, description="Nombre d'espèces / débarcadères affichés"
    )

    @field_validator("date_fin")
    @classmethod
    def _coherence_periode(cls, v: date, info):
        debut = info.data.get("date_debut")
        if debut and v < debut:
            raise ValueError(
                "La date de fin doit être postérieure ou égale à la date de début."
            )
        return v


# ===========================================================================
# 2. Structures de données (couche de rendu, sans BD)
# ===========================================================================
@dataclass
class StatsData:
    date_debut: date
    date_fin: date
    debarcadere_nom: Optional[str] = None

    nb_debarquements: int = 0
    quantite_totale_kg: float = 0.0
    valeur_totale_fcfa: float = 0.0
    nb_pecheurs: int = 0
    duree_moyenne_h: float = 0.0
    nb_especes: int = 0

    par_debarcadere: list[tuple[str, int]] = field(default_factory=list)  # (nom, nb)
    top_especes: list[tuple[str, float, float]] = field(
        default_factory=list
    )  # (nom, kg, fcfa)
    evolution: list[tuple[date, float]] = field(default_factory=list)  # (jour, kg)
    par_destination: list[tuple[str, float]] = field(default_factory=list)  # (dest, kg)

    alertes: dict[str, int] = field(default_factory=dict)


# ===========================================================================
# 3. Couche BD : agrégations SQLAlchemy (ORM synchrone)
# ===========================================================================
def collect_stats(db: Session, req: RapportStatsRequest) -> StatsData:
    # période sur des DateTime : bornes jour début 00:00 -> fin 23:59:59
    debut = datetime.combine(req.date_debut, time.min)
    fin = datetime.combine(req.date_fin, time.max)

    base = db.query(Debarquement).filter(
        Debarquement.date_debarquement >= debut,
        Debarquement.date_debarquement <= fin,
    )
    if req.debarcadere_id:
        base = base.filter(Debarquement.debarcadere_id == req.debarcadere_id)

    ids = [row[0] for row in base.with_entities(Debarquement.id).all()]

    stats = StatsData(date_debut=req.date_debut, date_fin=req.date_fin)

    if req.debarcadere_id:
        d = db.query(Debarcadere).get(req.debarcadere_id)
        stats.debarcadere_nom = getattr(d, "nom_local", None) if d else None

    stats.nb_debarquements = len(ids)
    if not ids:
        return stats

    # --- KPIs -------------------------------------------------------------
    q_kg, q_val = (
        db.query(
            func.coalesce(func.sum(DetailDebarquement.quantite_kg), 0.0),
            func.coalesce(func.sum(DetailDebarquement.valeur_totale), 0.0),
        )
        .filter(DetailDebarquement.debarquement_id.in_(ids))
        .one()
    )
    stats.quantite_totale_kg = float(q_kg or 0)
    stats.valeur_totale_fcfa = float(q_val or 0)

    stats.duree_moyenne_h = float(
        db.query(func.coalesce(func.avg(Debarquement.duree_sortie_heures), 0.0))
        .filter(Debarquement.id.in_(ids))
        .scalar()
        or 0
    )
    stats.nb_pecheurs = int(
        db.query(func.count(func.distinct(Debarquement.pecheur_principal_id)))
        .filter(Debarquement.id.in_(ids))
        .scalar()
        or 0
    )
    stats.nb_especes = int(
        db.query(func.count(func.distinct(DetailDebarquement.espece_id)))
        .filter(DetailDebarquement.debarquement_id.in_(ids))
        .scalar()
        or 0
    )

    # --- Débarquements par débarcadère -----------------------------------
    stats.par_debarcadere = [
        (nom or "—", int(nb))
        for nom, nb in (
            db.query(
                Debarcadere.nom_local, func.count(Debarquement.id)
            )  # <-- .nom à adapter
            .join(Debarquement, Debarquement.debarcadere_id == Debarcadere.id)
            .filter(Debarquement.id.in_(ids))
            .group_by(Debarcadere.nom_local)
            .order_by(func.count(Debarquement.id).desc())
            .limit(req.top_n)
            .all()
        )
    ]

    # --- Top espèces (quantité + valeur) ---------------------------------
    stats.top_especes = [
        (nom or "—", float(kg or 0), float(val or 0))
        for nom, kg, val in (
            db.query(
                Espece.nom_commun_francais,  # <-- .nom_commun à adapter
                func.coalesce(func.sum(DetailDebarquement.quantite_kg), 0.0),
                func.coalesce(func.sum(DetailDebarquement.valeur_totale), 0.0),
            )
            .join(DetailDebarquement, DetailDebarquement.espece_id == Espece.id)
            .filter(DetailDebarquement.debarquement_id.in_(ids))
            .group_by(Espece.nom_commun_francais)
            .order_by(func.sum(DetailDebarquement.quantite_kg).desc())
            .limit(req.top_n)
            .all()
        )
    ]

    # --- Évolution temporelle (quantité / jour) --------------------------
    stats.evolution = [
        (
            j if isinstance(j, date) else datetime.fromisoformat(str(j)).date(),
            float(kg or 0),
        )
        for j, kg in (
            db.query(
                func.date(Debarquement.date_debarquement),
                func.coalesce(func.sum(DetailDebarquement.quantite_kg), 0.0),
            )
            .join(
                DetailDebarquement,
                DetailDebarquement.debarquement_id == Debarquement.id,
            )
            .filter(Debarquement.id.in_(ids))
            .group_by(func.date(Debarquement.date_debarquement))
            .order_by(func.date(Debarquement.date_debarquement))
            .all()
        )
    ]

    # --- Répartition par zone de pêche -------------------------------------
    stats.par_destination = [
        (dest or "Non précisé", float(kg or 0))
        for dest, kg in (
            db.query(
                Debarquement.zone_peche_nom,
                func.coalesce(func.sum(DetailDebarquement.quantite_kg), 0.0),
            )
            .join(
                DetailDebarquement,
                DetailDebarquement.debarquement_id == Debarquement.id,
            )
            .filter(DetailDebarquement.debarquement_id.in_(ids))
            .group_by(Debarquement.zone_peche_nom)
            .order_by(func.sum(DetailDebarquement.quantite_kg).desc())
            .all()
        )
    ]

    # --- Alertes ----------------------------------------------------------
    def _count(col) -> int:
        return int(
            db.query(func.count(Debarquement.id))
            .filter(Debarquement.id.in_(ids), col.is_(True))
            .scalar()
            or 0
        )

    stats.alertes = {
        "Espèces protégées": _count(Debarquement.alerte_espece_protegee),
        "Quotas dépassés": _count(Debarquement.alerte_quota_depasse),
        "Tailles illégales": _count(Debarquement.alerte_taille_illegale),
        "Bateaux non conformes": _count(Debarquement.alerte_bateau_non_conforme),
    }
    return stats


# ===========================================================================
# 4. Graphiques matplotlib -> images reportlab
# ===========================================================================
OCEAN = "#0B4F6C"
TEAL = "#0F7C8A"
PALETTE = ["#0B4F6C", "#0F7C8A", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51", "#8AB17D"]
plt.rcParams.update(
    {
        "font.size": 9,
        "axes.edgecolor": "#CBD9DD",
        "axes.grid": True,
        "grid.color": "#EAF0F2",
        "figure.dpi": 150,
    }
)


def _fig_to_flowable(fig, width_mm: float) -> RLImage:
    buf = BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", facecolor="white")
    plt.close(fig)
    buf.seek(0)
    w = width_mm * mm
    ratio = fig.get_figheight() / fig.get_figwidth()
    return RLImage(buf, width=w, height=w * ratio)


def _chart_debarcadere(stats: StatsData, width_mm: float):
    if not stats.par_debarcadere:
        return None
    noms = [n for n, _ in stats.par_debarcadere][::-1]
    vals = [v for _, v in stats.par_debarcadere][::-1]
    fig, ax = plt.subplots(figsize=(6.6, 0.42 * len(noms) + 1.1))
    ax.barh(noms, vals, color=TEAL)
    ax.set_xlabel("Nombre de débarquements")
    for i, v in enumerate(vals):
        ax.text(v, i, f" {v}", va="center", fontsize=8, color=OCEAN)
    ax.grid(axis="y", visible=False)
    return _fig_to_flowable(fig, width_mm)


def _chart_especes(stats: StatsData, width_mm: float):
    if not stats.top_especes:
        return None
    noms = [n for n, _, _ in stats.top_especes][::-1]
    kg = [k for _, k, _ in stats.top_especes][::-1]
    fig, ax = plt.subplots(figsize=(6.6, 0.42 * len(noms) + 1.1))
    ax.barh(noms, kg, color=OCEAN)
    ax.set_xlabel("Quantité débarquée (kg)")
    ax.grid(axis="y", visible=False)
    return _fig_to_flowable(fig, width_mm)


def _chart_evolution(stats: StatsData, width_mm: float):
    if not stats.evolution:
        return None
    xs = [j for j, _ in stats.evolution]
    ys = [k for _, k in stats.evolution]
    fig, ax = plt.subplots(figsize=(6.6, 2.6))
    ax.plot(xs, ys, color=TEAL, marker="o", markersize=3, linewidth=1.6)
    ax.fill_between(xs, ys, color=TEAL, alpha=0.12)
    ax.set_ylabel("Quantité (kg)")
    fig.autofmt_xdate(rotation=30, ha="right")
    return _fig_to_flowable(fig, width_mm)


def _chart_destination(stats: StatsData, width_mm: float):
    data = [(d, v) for d, v in stats.par_destination if v > 0]
    if not data:
        return None
    labels = [d for d, _ in data]
    vals = [v for _, v in data]
    fig, ax = plt.subplots(figsize=(4.2, 3.0))
    wedges, *_ = ax.pie(
        vals,
        colors=PALETTE[: len(vals)],
        startangle=90,
        wedgeprops=dict(width=0.42, edgecolor="white"),
    )
    total = sum(vals)
    ax.legend(
        wedges,
        [f"{l} — {v/total*100:.0f}%" for l, v in zip(labels, vals)],
        loc="center left",
        bbox_to_anchor=(0.98, 0.5),
        frameon=False,
        fontsize=8,
    )
    ax.set_aspect("equal")
    return _fig_to_flowable(fig, width_mm)


# ===========================================================================
# 5. Construction du PDF (reportlab)
# ===========================================================================
def _fmt(n: float, suffix: str = "") -> str:
    return f"{n:,.0f}".replace(",", " ") + suffix


def build_pdf(stats: StatsData) -> bytes:
    PAGE_W, PAGE_H = A4
    MARGIN = 16 * mm
    CONTENT_W = (PAGE_W - 2 * MARGIN) / mm  # largeur utile en mm

    OCEAN_C = colors.HexColor(OCEAN)
    TEAL_C = colors.HexColor(TEAL)
    GREY = colors.HexColor("#5A6B72")
    LINE = colors.HexColor("#CBD9DD")
    DARK = colors.HexColor("#20323A")

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle(
        "h1",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        textColor=OCEAN_C,
        spaceBefore=8,
        spaceAfter=6,
    )

    body = ParagraphStyle(
        "b",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=DARK,
        alignment=TA_JUSTIFY,
    )

    titre = ParagraphStyle(
        "titre",
        parent=h1,
        fontSize=16,
        alignment=TA_CENTER,
        spaceBefore=0,
        spaceAfter=15,
    )
    sous_titre = ParagraphStyle(
        "sous_titre", parent=body, alignment=TA_CENTER, textColor=GREY, spaceAfter=8
    )

    def page_furniture(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(TEAL_C)
        canvas.setLineWidth(2)
        canvas.line(MARGIN, PAGE_H - 12 * mm, PAGE_W - MARGIN, PAGE_H - 12 * mm)
        canvas.setFont("Helvetica-Bold", 7.5)
        canvas.setFillColor(OCEAN_C)
        canvas.drawString(
            MARGIN,
            PAGE_H - 11 * mm,
            "SIGPA - Système d'Information de Gestion de la Pêche et de l'Aquaculture",
        )
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawRightString(
            PAGE_W - MARGIN, PAGE_H - 11 * mm, "Rapport statistique des débarquements"
        )
        canvas.setStrokeColor(LINE)
        canvas.setLineWidth(0.6)
        canvas.line(MARGIN, 13 * mm, PAGE_W - MARGIN, 13 * mm)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(
            MARGIN, 9 * mm, "Généré le " + datetime.now().strftime("%d/%m/%Y à %H:%M")
        )
        canvas.drawRightString(PAGE_W - MARGIN, 9 * mm, "Page %d" % doc.page)
        canvas.restoreState()

    buf = BytesIO()
    doc = BaseDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=18 * mm,
        bottomMargin=16 * mm,
        title="Rapport statistique des débarquements",
    )
    frame = Frame(MARGIN, 14 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 32 * mm, id="f")
    doc.addPageTemplates([PageTemplate(id="P", frames=[frame], onPage=page_furniture)])

    story = []

    # Titre + période
    # story.append(Paragraph("Rapport statistique des débarquements", h1))
    # periode = f"Période : du {stats.date_debut.strftime('%d/%m/%Y')} au {stats.date_fin.strftime('%d/%m/%Y')}"
    # if stats.debarcadere_nom:
    #     periode += f" · Débarcadère : {stats.debarcadere_nom}"
    # story.append(Paragraph(periode, body))
    # story.append(Spacer(1, 8))
    story.append(Paragraph("Rapport statistique des débarquements", titre))
    periode = f"Période : du {stats.date_debut.strftime('%d/%m/%Y')} au {stats.date_fin.strftime('%d/%m/%Y')}"
    if stats.debarcadere_nom:
        periode += f" · Débarcadère : {stats.debarcadere_nom}"
    story.append(Paragraph(periode, sous_titre))
    story.append(Spacer(1, 8))

    # KPI cards
    kpis = [
        ("Débarquements", _fmt(stats.nb_debarquements)),
        ("Quantité totale", _fmt(stats.quantite_totale_kg, " kg")),
        ("Valeur totale", _fmt(stats.valeur_totale_fcfa, " FCFA")),
        ("Espèces", _fmt(stats.nb_especes)),
        ("Pêcheurs", _fmt(stats.nb_pecheurs)),
        ("Durée moy.", f"{stats.duree_moyenne_h:.1f} h"),
    ]
    cells, row = [], []
    for i, (lab, val) in enumerate(kpis):
        card = Table(
            [
                [Paragraph(f'<font size=13 color="#0B4F6C"><b>{val}</b></font>', body)],
                [Paragraph(f'<font size=8 color="#5A6B72">{lab}</font>', body)],
            ],
            colWidths=[(CONTENT_W / 3) * mm],
        )
        card.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#E8F2F4")),
                    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        row.append(card)
        if len(row) == 3:
            cells.append(row)
            row = []
    if row:
        while len(row) < 3:
            row.append("")
        cells.append(row)
    kpi_tbl = Table(cells, colWidths=[(CONTENT_W / 3) * mm] * 3)
    kpi_tbl.setStyle(
        TableStyle(
            [
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(kpi_tbl)
    story.append(Spacer(1, 10))

    if stats.nb_debarquements == 0:
        story.append(
            Paragraph(
                "Aucun débarquement enregistré sur la période sélectionnée.", body
            )
        )
        doc.build(story)
        return buf.getvalue()

    # Graphiques
    half = CONTENT_W / 2 - 3
    c1 = _chart_debarcadere(stats, half)
    c2 = _chart_especes(stats, half)
    if c1 or c2:
        story.append(
            Paragraph("Débarquements par débarcadère &amp; espèces principales", h1)
        )
        story.append(
            Table(
                [[c1 or "", c2 or ""]],
                colWidths=[half * mm, half * mm],
                style=[("VALIGN", (0, 0), (-1, -1), "TOP")],
            )
        )
        story.append(Spacer(1, 8))

    c3 = _chart_evolution(stats, CONTENT_W)
    if c3:
        story.append(
            KeepTogether([Paragraph("Évolution des quantités débarquées", h1), c3])
        )
        story.append(Spacer(1, 8))

    c4 = _chart_destination(stats, CONTENT_W * 0.62)
    if c4:
        story.append(KeepTogether([Paragraph("Répartition par destination", h1), c4]))
        story.append(Spacer(1, 8))

    # Tableau top espèces
    if stats.top_especes:
        head = [
            Paragraph(f'<font color="white"><b>{c}</b></font>', body)
            for c in ("Espèce", "Quantité (kg)", "Valeur (FCFA)")
        ]
        rows = [head]
        for nom, kg, val in stats.top_especes:
            rows.append(
                [
                    Paragraph(nom, body),
                    Paragraph(_fmt(kg), body),
                    Paragraph(_fmt(val), body),
                ]
            )
        t = Table(
            rows,
            colWidths=[
                (CONTENT_W * 0.5) * mm,
                (CONTENT_W * 0.25) * mm,
                (CONTENT_W * 0.25) * mm,
            ],
            repeatRows=1,
        )
        ts = [
            ("BACKGROUND", (0, 0), (-1, 0), OCEAN_C),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
        ]
        for r in range(1, len(rows)):
            if r % 2 == 0:
                ts.append(("BACKGROUND", (0, r), (-1, r), colors.HexColor("#F3F8F9")))
        t.setStyle(TableStyle(ts))
        story.append(KeepTogether([Paragraph("Détail des espèces débarquées", h1), t]))
        story.append(Spacer(1, 8))

    # Alertes
    total_alertes = sum(stats.alertes.values())
    if total_alertes:
        head = [
            Paragraph(f'<font color="white"><b>{c}</b></font>', body)
            for c in ("Type d'alerte", "Occurrences")
        ]
        rows = [head] + [
            [Paragraph(k, body), Paragraph(str(v), body)]
            for k, v in stats.alertes.items()
            if v
        ]
        t = Table(
            rows,
            colWidths=[(CONTENT_W * 0.7) * mm, (CONTENT_W * 0.3) * mm],
            repeatRows=1,
        )
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#B23A1E")),
                    ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("LINEBELOW", (0, 1), (-1, -1), 0.4, LINE),
                ]
            )
        )
        story.append(KeepTogether([Paragraph("Alertes réglementaires", h1), t]))

    doc.build(story)
    return buf.getvalue()


# ===========================================================================
# 6. Schéma de réponse JSON (pour l'aperçu HTML avant téléchargement)
# ===========================================================================
class LabelValeur(BaseModel):
    label: str
    valeur: float


class EspeceStat(BaseModel):
    nom: str
    quantite_kg: float
    valeur_fcfa: float


class PointTemporel(BaseModel):
    jour: date
    quantite_kg: float


class StatsResponse(BaseModel):
    date_debut: date
    date_fin: date
    debarcadere_nom: Optional[str] = None
    nb_debarquements: int
    quantite_totale_kg: float
    valeur_totale_fcfa: float
    nb_pecheurs: int
    duree_moyenne_h: float
    nb_especes: int
    par_debarcadere: list[LabelValeur]
    top_especes: list[EspeceStat]
    evolution: list[PointTemporel]
    par_destination: list[LabelValeur]
    alertes: dict[str, int]


def _to_response(stats: StatsData) -> StatsResponse:
    return StatsResponse(
        date_debut=stats.date_debut,
        date_fin=stats.date_fin,
        debarcadere_nom=stats.debarcadere_nom,
        nb_debarquements=stats.nb_debarquements,
        quantite_totale_kg=round(stats.quantite_totale_kg, 2),
        valeur_totale_fcfa=round(stats.valeur_totale_fcfa, 0),
        nb_pecheurs=stats.nb_pecheurs,
        duree_moyenne_h=round(stats.duree_moyenne_h, 2),
        nb_especes=stats.nb_especes,
        par_debarcadere=[
            LabelValeur(label=n, valeur=v) for n, v in stats.par_debarcadere
        ],
        top_especes=[
            EspeceStat(nom=n, quantite_kg=round(kg, 2), valeur_fcfa=round(val, 0))
            for n, kg, val in stats.top_especes
        ],
        evolution=[
            PointTemporel(jour=j, quantite_kg=round(kg, 2)) for j, kg in stats.evolution
        ],
        par_destination=[
            LabelValeur(label=d, valeur=round(v, 2)) for d, v in stats.par_destination
        ],
        alertes=stats.alertes,
    )


# ===========================================================================
# 7. Endpoints
# ===========================================================================
@router.post("/statistiques/donnees", response_model=StatsResponse)
def donnees_statistiques_debarquements(
    req: RapportStatsRequest,
    db: Session = Depends(get_db),
):
    """Renvoie les statistiques en JSON pour l'aperçu HTML (avant téléchargement PDF)."""
    try:
        return _to_response(collect_stats(db, req))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"Échec du calcul des statistiques : {exc}"
        )


@router.post("/statistiques")
def rapport_statistiques_debarquements(
    req: RapportStatsRequest,
    db: Session = Depends(get_db),
):
    """Génère et renvoie le rapport statistique PDF des débarquements."""
    try:
        stats = collect_stats(db, req)
        pdf_bytes = build_pdf(stats)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500, detail=f"Échec de génération du rapport : {exc}"
        )

    nom_fichier = f"rapport_debarquements_{req.date_debut}_{req.date_fin}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nom_fichier}"'},
    )
