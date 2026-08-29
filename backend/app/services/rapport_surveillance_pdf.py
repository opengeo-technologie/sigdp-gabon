#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SIGPA — Rapport de surveillance (PDF de synthèse).
build_rapport(agg) -> bytes, à partir des agrégats du tableau de bord.
reportlab pour la mise en page + matplotlib pour les graphiques.
"""

import io
from datetime import date

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

W, H = A4
LEFT, RIGHT = 40, 40
CW = W - LEFT - RIGHT
BLUE = HexColor("#1F3B63")
DGREY = HexColor("#6B7785")
LINE = HexColor("#9AA6B2")
WHITE = HexColor("#FFFFFF")
BLACK = HexColor("#000000")

PALETTE = [
    "#1565c0",
    "#ef6c00",
    "#c62828",
    "#2e7d32",
    "#6a1b9a",
    "#00838f",
    "#4e342e",
    "#455a64",
]


def _fig_to_reader(fig):
    b = io.BytesIO()
    fig.savefig(b, format="png", dpi=150, bbox_inches="tight", transparent=True)
    plt.close(fig)
    b.seek(0)
    return ImageReader(b)


def _bar(labels, data, titre, color="#1565c0", horizontal=False):
    fig, ax = plt.subplots(figsize=(3.5, 2.4))
    if not any(data):
        ax.text(0.5, 0.5, "Aucune donnée", ha="center", va="center", color="#999")
        ax.axis("off")
    else:
        if horizontal:
            ax.barh(labels, data, color=color)
            ax.invert_yaxis()
        else:
            ax.bar(labels, data, color=color)
            plt.xticks(rotation=25, ha="right", fontsize=7)
    ax.set_title(titre, fontsize=9, fontweight="bold", color="#1F3B63")
    ax.tick_params(labelsize=7)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    return _fig_to_reader(fig)


def _pie(labels, data, titre, colors=None):
    fig, ax = plt.subplots(figsize=(3.5, 2.4))
    if not any(data):
        ax.text(0.5, 0.5, "Aucune donnée", ha="center", va="center", color="#999")
        ax.axis("off")
    else:
        vals = [
            (l, v, (colors or PALETTE)[i % len(PALETTE)])
            for i, (l, v) in enumerate(zip(labels, data))
            if v
        ]
        ax.pie(
            [v for _, v, _ in vals],
            labels=[l for l, _, _ in vals],
            colors=[c for _, _, c in vals],
            autopct="%1.0f%%",
            textprops={"fontsize": 7},
            startangle=90,
        )
    ax.set_title(titre, fontsize=9, fontweight="bold", color="#1F3B63")
    return _fig_to_reader(fig)


def _line(labels, series, titre):
    fig, ax = plt.subplots(figsize=(7.4, 2.4))
    for name, data, color in series:
        ax.plot(labels, data, marker="o", ms=3, label=name, color=color, linewidth=1.6)
    ax.set_title(titre, fontsize=9, fontweight="bold", color="#1F3B63")
    ax.tick_params(labelsize=7)
    plt.xticks(rotation=30, ha="right", fontsize=6.5)
    ax.legend(fontsize=7, frameon=False)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    ax.grid(axis="y", alpha=0.3)
    return _fig_to_reader(fig)


def _fr(d):
    return d.strftime("%d/%m/%Y") if isinstance(d, date) else (d or "—")


def build_rapport(agg: dict) -> bytes:
    c = canvas.Canvas(io.BytesIO(), pagesize=A4)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle("Rapport de surveillance - SIGPA")

    # ---------- En-tête ----------
    c.setFillColor(BLACK)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(LEFT + 150, H - 40, "RÉPUBLIQUE GABONAISE")
    c.setFont("Helvetica-Oblique", 7.5)
    c.setFillColor(DGREY)
    c.drawCentredString(LEFT + 150, H - 50, "Union — Travail — Justice")
    c.setFillColor(BLACK)
    c.setFont("Helvetica", 7.8)
    c.drawCentredString(
        LEFT + 150, H - 63, "Ministère de la Mer, de la Pêche et de l'Economie Bleue"
    )
    c.setFont("Helvetica-Bold", 7.6)
    c.drawCentredString(
        LEFT + 150, H - 73, "Direction Générale des Pêches et de l'Aquaculture (DGPA)"
    )
    bx = W - RIGHT - 120
    c.setStrokeColor(BLUE)
    c.setLineWidth(1)
    c.rect(bx, H - 78, 120, 42, fill=0, stroke=1)
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(bx + 60, H - 55, "SIGPA")
    c.setFillColor(DGREY)
    c.setFont("Helvetica", 5.5)
    c.drawCentredString(bx + 60, H - 66, "Système d'Information de Gestion")
    c.drawCentredString(bx + 60, H - 73, "de la Pêche et de l'Aquaculture")
    c.setStrokeColor(BLUE)
    c.setLineWidth(1.4)
    c.line(LEFT, H - 86, W - RIGHT, H - 86)

    # ---------- Titre + période ----------
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(LEFT, H - 108, "RAPPORT DE SURVEILLANCE")
    p = agg.get("periode", {})
    per = "Toutes périodes"
    if p.get("debut") or p.get("fin"):
        per = f"Période : {p.get('debut') or '…'} au {p.get('fin') or '…'}"
    c.setFillColor(DGREY)
    c.setFont("Helvetica", 8.5)
    c.drawString(LEFT, H - 122, per)
    c.drawRightString(W - RIGHT, H - 122, f"Édité le {_fr(date.today())}")

    # ---------- KPI ----------
    kpi = agg["kpi"]
    cartes = [
        ("Missions", kpi["missions"], "#1565c0"),
        ("Opérations", kpi["operations"], "#00838f"),
        ("Infractions", kpi["infractions"], "#c62828"),
        ("Saisies", kpi["saisies"], "#6a1b9a"),
        ("Rapports", kpi["rapports"], "#2e7d32"),
        ("Conformité", f"{kpi['taux_conformite']}%", "#ef6c00"),
    ]
    y = H - 138
    cw = (CW - 5 * 8) / 6
    for i, (lib, val, col) in enumerate(cartes):
        x = LEFT + i * (cw + 8)
        c.setFillColor(HexColor(col))
        c.roundRect(x, y - 42, cw, 42, 4, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 14)
        c.drawCentredString(x + cw / 2, y - 22, str(val))
        c.setFont("Helvetica", 6.5)
        c.drawCentredString(x + cw / 2, y - 34, lib)
    y -= 58

    # ---------- Graphiques (2 colonnes) ----------
    gw, gh = (CW - 16) / 2, 150
    ot = agg["operations_par_type"]
    orr = agg["operations_par_resultat"]
    ig = agg["infractions_par_gravite"]
    it = agg["infractions_par_type"]

    def place(reader, x, y, w, h):
        c.drawImage(
            reader, x, y - h, width=w, height=h, preserveAspectRatio=True, mask="auto"
        )

    place(_bar(ot["labels"], ot["data"], "Opérations par type"), LEFT, y, gw, gh)
    place(
        _pie(
            orr["labels"],
            orr["data"],
            "Opérations par résultat",
            colors=["#2e7d32", "#c62828", "#9e9e9e"],
        ),
        LEFT + gw + 16,
        y,
        gw,
        gh,
    )
    y -= gh + 8
    place(
        _bar(ig["labels"], ig["data"], "Infractions par gravité", color="#c62828"),
        LEFT,
        y,
        gw,
        gh,
    )
    place(
        _bar(
            it["labels"],
            it["data"],
            "Infractions par type",
            color="#ef6c00",
            horizontal=True,
        ),
        LEFT + gw + 16,
        y,
        gw,
        gh,
    )
    y -= gh + 8

    am = agg["activite_par_mois"]
    place(
        _line(
            am["labels"],
            [
                ("Opérations", am["operations"], "#1565c0"),
                ("Infractions", am["infractions"], "#c62828"),
            ],
            "Activité mensuelle (12 mois)",
        ),
        LEFT,
        y,
        CW,
        gh,
    )
    y -= gh + 6

    # ---------- Pied ----------
    c.setFillColor(DGREY)
    c.setFont("Helvetica-Oblique", 7)
    c.drawCentredString(W / 2, 26, "SIGPA — DGPA — Rapport de surveillance")

    c.showPage()
    c.save()
    return buf.getvalue()


if __name__ == "__main__":
    demo = {
        "periode": {"debut": "2026-01-01", "fin": "2026-08-31"},
        "kpi": {
            "missions": 8,
            "operations": 5,
            "infractions": 5,
            "saisies": 5,
            "rapports": 6,
            "taux_conformite": 20.0,
        },
        "operations_par_type": {
            "labels": ["inspection", "contrôle", "patrouille", "opération conjointe"],
            "data": [2, 1, 1, 1],
        },
        "operations_par_resultat": {
            "labels": ["Conforme", "Non conforme", "Non renseigné"],
            "data": [1, 4, 0],
        },
        "infractions_par_gravite": {
            "labels": ["Mineure", "Majeure", "Critique"],
            "data": [1, 2, 2],
        },
        "infractions_par_type": {
            "labels": [
                "Zone interdite",
                "Engin prohibé",
                "Sans licence",
                "Taille inf.",
            ],
            "data": [2, 1, 1, 1],
        },
        "missions_par_type": {
            "labels": ["terrain", "bureau", "aleatoire"],
            "data": [4, 2, 2],
        },
        "activite_par_mois": {
            "labels": [f"M{i}" for i in range(1, 13)],
            "operations": [0, 1, 2, 0, 1, 1, 0, 0, 0, 0, 0, 0],
            "infractions": [0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0, 0],
        },
    }
    open("rapport_demo.pdf", "wb").write(build_rapport(demo))
    print("OK -> rapport_demo.pdf")
