#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SIGPA — Rendu de la fiche de mission de contrôle (AcroForm, A4, 2 pages).

`build_pdf(data)` construit la fiche et PRÉ-REMPLIT les champs fournis ; les
champs absents restent vides et modifiables. Sans argument, produit une fiche
vierge.

Schéma de `data` (toutes les clés sont optionnelles) :
{
  "num": str, "ref": str,
  "dep": str, "ret": str, "lieu": str, "moyen": str,
  "type": "terrain" | "bureau" | "aleatoire",
  "equipe":     [[matricule, nom & prénom, organisme, rôle, signature], ...],  # <=6
  "controles":  [[cible, type, "", "", observations], ...],                    # <=5
  "infractions":[[n, type, gravité, contrevenant, sexe, description], ...],    # <=5
  "saisies":    [[désignation, type, quantité, valeur], ...],                  # <=4
  "obs": str,
  "chef_nom": str, "autorite_nom": str,
}
"""

import io
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

W, H = A4
LEFT, RIGHT = 40, 40
CW = W - LEFT - RIGHT
BLUE = HexColor("#1F3B63")
GREY = HexColor("#E9EDF2")
DGREY = HexColor("#6B7785")
LINE = HexColor("#9AA6B2")
WHITE = HexColor("#FFFFFF")
BLACK = HexColor("#000000")


def build_pdf(data=None) -> bytes:
    """Construit la fiche et renvoie les octets du PDF."""
    d = data or {}
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle("Fiche de mission de controle - SIGPA")
    form = c.acroForm
    _seq = {"n": 0}

    def fid(prefix=""):
        _seq["n"] += 1
        return f"{prefix}_{_seq['n']:03d}"

    def textfield(name, x, y, w, h, size=9, multiline=False, value=""):
        form.textfield(
            name=name,
            x=x,
            y=y,
            width=w,
            height=h,
            value=value or "",
            borderColor=None,
            fillColor=None,
            forceBorder=False,
            fontName="Helvetica",
            fontSize=size,
            fieldFlags="multiline" if multiline else "",
            relative=False,
        )

    def checkbox(name, x, y, size=11, checked=False):
        form.checkbox(
            name=name,
            x=x,
            y=y,
            size=size,
            checked=checked,
            buttonStyle="check",
            borderWidth=0.8,
            borderColor=BLUE,
            fillColor=None,
            forceBorder=True,
            relative=False,
        )

    def section(y, titre):
        c.setFillColor(BLUE)
        c.rect(LEFT, y - 15, CW, 16, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("Helvetica-Bold", 9.5)
        c.drawString(LEFT + 6, y - 11.5, titre)
        return y - 26

    def label(x, y, txt, size=8, color=DGREY):
        c.setFillColor(color)
        c.setFont("Helvetica", size)
        c.drawString(x, y, txt)

    def field_line(x, y, w, name, size=9, value=""):
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.line(x, y - 1, x + w, y - 1)
        textfield(name, x, y, w, 15, size=size, value=value)

    def table_header(cols, y, h=16):
        c.setFillColor(GREY)
        c.rect(LEFT, y - h, CW, h, fill=1, stroke=0)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        c.setFillColor(BLUE)
        c.setFont("Helvetica-Bold", 7.8)
        x = LEFT
        for titre, w in cols:
            c.drawString(x + 4, y - h + 5, titre)
            x += w
        c.rect(LEFT, y - h, CW, h, fill=0, stroke=1)
        return y - h

    def table_rows(cols, y, prefix, n, rh=18, checks=None, values=None):
        checks = checks or set()
        values = values or []
        total = n * rh
        top = y
        c.setStrokeColor(LINE)
        c.setLineWidth(0.5)
        for i in range(n + 1):
            yy = top - i * rh
            c.line(LEFT, yy, LEFT + CW, yy)
        x = LEFT
        xs = [x]
        for _, w in cols:
            x += w
            xs.append(x)
        for xv in xs:
            c.line(xv, top, xv, top - total)
        for r in range(n):
            yy = top - (r + 1) * rh
            row = values[r] if r < len(values) else []
            for ci, (_, w) in enumerate(cols):
                cx = xs[ci]
                val = str(row[ci]) if ci < len(row) and row[ci] is not None else ""
                if ci in checks:
                    checkbox(f"{prefix}_{r}_{ci}", cx + w / 2 - 5, yy + rh / 2 - 5, 10)
                else:
                    textfield(
                        f"{prefix}_{r}_{ci}",
                        cx + 3,
                        yy + 3,
                        w - 6,
                        rh - 3,
                        size=7,
                        value=val,
                    )
        return top - total

    def entete():
        c.setFillColor(BLACK)
        c.setFont("Helvetica-Bold", 10)
        c.drawCentredString(LEFT + 150, H - 40, "RÉPUBLIQUE GABONAISE")
        c.setFont("Helvetica-Oblique", 7.5)
        c.setFillColor(DGREY)
        c.drawCentredString(LEFT + 150, H - 50, "Union — Travail — Justice")
        c.setFillColor(BLACK)
        c.setFont("Helvetica", 7.8)
        c.drawCentredString(
            LEFT + 150,
            H - 63,
            "Ministère de la Mer, de la Pêche et de l'Economie Bleue",
        )
        c.setFont("Helvetica-Bold", 7.6)
        c.drawCentredString(
            LEFT + 150,
            H - 73,
            "Direction Générale des Pêches et de l'Aquaculture (DGPA)",
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

    def pied(num):
        c.setFillColor(DGREY)
        c.setFont("Helvetica-Oblique", 7)
        c.drawCentredString(
            W / 2, 26, f"SIGPA — DGPA — Fiche de mission de contrôle — Page {num}/2"
        )

    # ===================== PAGE 1 =====================
    entete()
    c.setFillColor(BLUE)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(LEFT, H - 108, "FICHE DE MISSION DE CONTRÔLE")
    label(W - RIGHT - 205, H - 100, "N° de fiche")
    field_line(W - RIGHT - 145, H - 105, 65, "f_num", value=d.get("num", ""))
    label(W - RIGHT - 205, H - 116, "Réf. mission")
    field_line(W - RIGHT - 145, H - 121, 145, "f_ref", value=d.get("ref", ""))

    y = H - 138
    y = section(y, "1. IDENTIFICATION DE LA MISSION")
    label(LEFT, y - 5, "Date de départ")
    field_line(LEFT + 82, y - 10, 110, "f_dep", value=d.get("dep", ""))
    label(LEFT + 220, y - 5, "Date de retour")
    field_line(LEFT + 300, y - 10, 110, "f_ret", value=d.get("ret", ""))
    y -= 22
    label(LEFT, y - 5, "Lieu de la mission")
    field_line(LEFT + 96, y - 10, CW - 96, "f_lieu", value=d.get("lieu", ""))
    y -= 22
    label(LEFT, y - 5, "Type de mission")
    cx = LEFT + 96
    tmap = {"terrain": "t", "bureau": "b", "aleatoire": "a"}
    tsel = tmap.get((d.get("type") or "").lower())
    for lib, key in [("Terrain", "t"), ("Bureau", "b"), ("Aléatoire", "a")]:
        checkbox("f_typ_" + key, cx, y - 5, 11, checked=(key == tsel))
        c.setFillColor(BLACK)
        c.setFont("Helvetica", 8.5)
        c.drawString(cx + 15, y, lib)
        cx += 95
    y -= 22
    label(LEFT, y - 5, "Moyen de contrôle")
    field_line(LEFT + 96, y - 10, CW - 96, "f_moyen", value=d.get("moyen", ""))
    y -= 16

    y = section(y, "2. ÉQUIPE DE SURVEILLANCE")
    cols2 = [
        ("Matricule", 68),
        ("Nom & prénom", 150),
        ("Organisme", 80),
        ("Rôle", 95),
        ("Signature", CW - 68 - 150 - 80 - 95),
    ]
    y = table_header(cols2, y)
    y = table_rows(cols2, y, "eq", 6, rh=17, values=d.get("equipe"))
    y -= 12

    # y = section(y, "3. CONTRÔLES EFFECTUÉS")
    # cols3 = [
    #     ("Cible contrôlée", 150),
    #     ("Type", 95),
    #     ("Conf.", 45),
    #     ("Non conf.", 55),
    #     ("Observations", CW - 150 - 95 - 45 - 55),
    # ]
    # y = table_header(cols3, y)
    # y = table_rows(cols3, y, "ct", 5, rh=18, checks={2, 3}, values=d.get("operations"))

    y = section(y, "3. OPÉRATIONS DE SURVEILLANCE")
    cols3 = [
        ("Date", 64),
        ("Lieu / cible", 116),
        ("Type", 88),
        ("Conf.", 42),
        ("Non conf.", 52),
        ("Remarques", CW - 64 - 116 - 88 - 42 - 52),
    ]
    y = table_header(cols3, y)
    y = table_rows(cols3, y, "op", 5, rh=18, checks={3, 4}, values=d.get("operations"))

    y -= 12
    y = section(y, "4. INFRACTIONS CONSTATÉES")
    cols4 = [
        ("N°", 24),
        ("Type d'infraction", 130),
        ("Gravité", 60),
        ("Contrevenant", 110),
        ("Sexe", 34),
        ("Description", CW - 24 - 130 - 60 - 110 - 34),
    ]
    y = table_header(cols4, y)
    y = table_rows(cols4, y, "inf", 5, rh=20, values=d.get("infractions"))
    label(
        LEFT, y - 10, "Sexe : M / F    —    Gravité : Mineure / Moyenne / Grave", size=7
    )
    pied(1)
    c.showPage()

    # ===================== PAGE 2 =====================
    entete()
    y = H - 100

    # y -= 22

    y = section(y, "5. SAISIES EFFECTUÉES")
    cols5 = [
        ("Désignation", 200),
        ("Type", 90),
        ("Quantité", 80),
        ("Valeur estimée (f.CFA)", CW - 200 - 90 - 80),
    ]
    y = table_header(cols5, y)
    y = table_rows(cols5, y, "sai", 4, rh=19, values=d.get("saisies"))
    y -= 14

    y = section(y, "6. OBSERVATIONS GÉNÉRALES / RAPPORT DE MISSION")
    box_h = 96
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.rect(LEFT, y - box_h, CW, box_h, fill=0, stroke=1)
    textfield(
        "f_obs",
        LEFT + 4,
        y - box_h + 4,
        CW - 8,
        box_h - 8,
        size=9,
        multiline=True,
        value=d.get("obs", ""),
    )
    y -= box_h + 16

    y = section(y, "7. VISAS ET SIGNATURES")
    col_w = (CW - 20) / 2
    noms = [d.get("chef_nom", ""), d.get("autorite_nom", "")]
    for i, titre in enumerate(["Le Chef de mission", "L'Autorité hiérarchique"]):
        bx = LEFT + i * (col_w + 20)
        c.setStrokeColor(LINE)
        c.setLineWidth(0.6)
        c.rect(bx, y - 78, col_w, 78, fill=0, stroke=1)
        c.setFillColor(BLUE)
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(bx + 6, y - 13, titre)
        label(bx + 6, y - 30, "Nom et prénom")
        field_line(bx + 78, y - 30, col_w - 84, f"f_sig_nom_{i}", value=noms[i])
        label(bx + 6, y - 48, "Date")
        field_line(bx + 34, y - 48, 90, f"f_sig_date_{i}")
        label(bx + 6, y - 68, "Signature / cachet", size=7)
    pied(2)
    c.showPage()
    c.save()
    return buf.getvalue()


# if __name__ == "__main__":
#     import sys

#     if "--demo" in sys.argv:
#         demo = {
#             "ref": "MIS-0007",
#             "num": "042",
#             "dep": "28/06/2026",
#             "ret": "02/07/2026",
#             "lieu": "Omboué (Fernan Vaz)",
#             "type": "terrain",
#             "moyen": "Vedette VG-05",
#             "equipe": [
#                 ["DGPA-0255", "IVANGA Serge", "DGPA", "chef d'équipe", ""],
#                 ["AGEOS-0117", "MENGUE Ghislain", "AGEOS", "appui SIG", ""],
#                 ["DGPA-0221", "KOUMBA Chancelle", "DGPA", "observateur", ""],
#                 ["MNG-1058", "BOUSSOUGOU Willy", "MNG", "pilote", ""],
#             ],
#             "obs": "[03/07/2026] Mission dans la lagune Fernan Vaz. "
#             "Cartographie des sites de débarquement et contrôle des captures.",
#             "chef_nom": "IVANGA Serge",
#         }
#         open("fiche_demo.pdf", "wb").write(build_pdf(demo))
#         print("OK -> fiche_demo.pdf")
#     else:
#         open("fiche_mission_controle.pdf", "wb").write(build_pdf())
#         print("OK -> fiche_mission_controle.pdf (vierge)")
