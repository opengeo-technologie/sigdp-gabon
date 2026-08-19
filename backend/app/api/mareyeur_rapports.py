# app/routers/mareyeur_statistiques.py
# =============================================================================
# Module Mareyeurs — Rapport statistique (SIGDP-GABON / SIGPA)
# -----------------------------------------------------------------------------
# Conventions SIGDP :
#   - Endpoints FastAPI POST-only
#   - SQLAlchemy ORM synchrone (Session)
#   - Schémas Pydantic v2
#   - Sorties « prêtes Chart.js » : { labels: [...], data: [...] }
#   - Champs multiples stockés en chaîne séparée par des virgules (split côté app)
#   - Export PDF via reportlab + matplotlib (backend Agg)
#
# Points d'API :
#   POST /api/mareyeurs/statistiques            -> JSON complet (dashboards Chart.js)
#   POST /api/mareyeurs/statistiques/export/pdf -> Rapport PDF (téléchargement)
# =============================================================================

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date, datetime
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.mareyeur import (
    Mareyeur,
    AgrementMareyage,
    InstallationMareyage,
    TransactionAchat,
)

router = APIRouter(prefix="/api/mareyeurs/rapport", tags=["Mareyeurs - Statistiques"])


# =============================================================================
# 1. Schémas Pydantic v2
# =============================================================================


class SerieChart(BaseModel):
    """Structure directement exploitable par Chart.js."""

    labels: list[str] = Field(default_factory=list)
    data: list[float] = Field(default_factory=list)


class BlocMareyeurs(BaseModel):
    total: int = 0
    actifs: int = 0
    par_type_personne: SerieChart = Field(default_factory=SerieChart)
    par_statut: SerieChart = Field(default_factory=SerieChart)
    par_sexe: SerieChart = Field(default_factory=SerieChart)
    par_nationalite: SerieChart = Field(default_factory=SerieChart)
    par_zone_activite: SerieChart = Field(default_factory=SerieChart)
    par_site_debarquement: SerieChart = Field(default_factory=SerieChart)


class BlocAgrements(BaseModel):
    total: int = 0
    par_statut: SerieChart = Field(default_factory=SerieChart)
    par_categorie: SerieChart = Field(default_factory=SerieChart)
    montant_total_redevances_fcfa: float = 0.0
    nombre_delivres: int = 0
    nombre_expires: int = 0
    nombre_expirant_30j: int = 0
    nombre_renouvellements: int = 0


class BlocInstallations(BaseModel):
    total: int = 0
    par_type: SerieChart = Field(default_factory=SerieChart)
    par_statut: SerieChart = Field(default_factory=SerieChart)
    capacite_totale_tonnes: float = 0.0


class BlocTransactions(BaseModel):
    total: int = 0
    quantite_totale_kg: float = 0.0
    montant_total_fcfa: float = 0.0
    prix_moyen_fcfa_par_kg: float = 0.0
    par_etat_poisson: SerieChart = Field(default_factory=SerieChart)
    top_especes_quantite: SerieChart = Field(default_factory=SerieChart)
    par_site_debarquement: SerieChart = Field(default_factory=SerieChart)
    evolution_mensuelle_kg: SerieChart = Field(default_factory=SerieChart)
    evolution_mensuelle_fcfa: SerieChart = Field(default_factory=SerieChart)


class StatistiquesMareyeurs(BaseModel):
    genere_le: datetime
    periode_debut: Optional[date] = None
    periode_fin: Optional[date] = None
    mareyeurs: BlocMareyeurs
    agrements: BlocAgrements
    installations: BlocInstallations
    transactions: BlocTransactions


class FiltreStatistiques(BaseModel):
    """La période s'applique au registre des transactions d'achat.
    Les blocs mareyeurs / agréments / installations sont fournis en
    photographie (snapshot) à la date de génération."""

    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    top_n: int = Field(default=10, ge=1, le=50)


# =============================================================================
# 2. Helpers d'agrégation
# =============================================================================


def _serie_from_counter(
    counter: dict, top_n: Optional[int] = None, tri_desc: bool = True
) -> SerieChart:
    """Transforme un dict {label: valeur} en SerieChart (triée)."""
    items = list(counter.items())
    if tri_desc:
        items.sort(key=lambda kv: kv[1], reverse=True)
    if top_n:
        items = items[:top_n]
    return SerieChart(
        labels=[str(k) for k, _ in items],
        data=[round(float(v), 2) for _, v in items],
    )


def _group_count(db: Session, colonne) -> dict:
    """COUNT groupé sur une colonne ; NULL -> 'non_precise'."""
    rows = db.query(colonne, func.count()).group_by(colonne).all()
    return {(k if k not in (None, "") else "non_precise"): v for k, v in rows}


def _count_csv(valeurs) -> Counter:
    """Comptage des champs multi-valeurs stockés en 'a, b, c'."""
    compteur: Counter = Counter()
    for (val,) in valeurs:
        if not val:
            continue
        for item in str(val).split(","):
            item = item.strip()
            if item:
                compteur[item] += 1
    return compteur


# =============================================================================
# 3. Calcul des statistiques
# =============================================================================


def calculer_statistiques(
    db: Session,
    date_debut: Optional[date] = None,
    date_fin: Optional[date] = None,
    top_n: int = 10,
) -> StatistiquesMareyeurs:

    aujourdhui = date.today()

    # ------------------------------------------------------------------ #
    # Bloc MAREYEURS (snapshot)
    # ------------------------------------------------------------------ #
    total_mareyeurs = db.query(func.count(Mareyeur.id)).scalar() or 0
    actifs = (
        db.query(func.count(Mareyeur.id)).filter(Mareyeur.statut == "actif").scalar()
        or 0
    )

    zones = _count_csv(db.query(Mareyeur.zones_activite).all())
    sites_m = _count_csv(db.query(Mareyeur.sites_debarquement).all())

    bloc_mareyeurs = BlocMareyeurs(
        total=total_mareyeurs,
        actifs=actifs,
        par_type_personne=_serie_from_counter(_group_count(db, Mareyeur.type_personne)),
        par_statut=_serie_from_counter(_group_count(db, Mareyeur.statut)),
        par_sexe=_serie_from_counter(_group_count(db, Mareyeur.sexe)),
        par_nationalite=_serie_from_counter(
            _group_count(db, Mareyeur.nationalite), top_n=top_n
        ),
        par_zone_activite=_serie_from_counter(zones, top_n=top_n),
        par_site_debarquement=_serie_from_counter(sites_m, top_n=top_n),
    )

    # ------------------------------------------------------------------ #
    # Bloc AGRÉMENTS (snapshot)
    # ------------------------------------------------------------------ #
    total_agr = db.query(func.count(AgrementMareyage.id)).scalar() or 0
    montant_redevances = (
        db.query(
            func.coalesce(func.sum(AgrementMareyage.montant_redevance), 0.0)
        ).scalar()
        or 0.0
    )

    nb_delivres = (
        db.query(func.count(AgrementMareyage.id))
        .filter(AgrementMareyage.statut == "delivre")
        .scalar()
        or 0
    )

    nb_expires = (
        db.query(func.count(AgrementMareyage.id))
        .filter(
            AgrementMareyage.date_expiration.isnot(None),
            AgrementMareyage.date_expiration < aujourdhui,
        )
        .scalar()
        or 0
    )

    from datetime import timedelta

    limite_30j = aujourdhui + timedelta(days=30)
    nb_expirant_30j = (
        db.query(func.count(AgrementMareyage.id))
        .filter(
            AgrementMareyage.date_expiration.isnot(None),
            AgrementMareyage.date_expiration >= aujourdhui,
            AgrementMareyage.date_expiration <= limite_30j,
        )
        .scalar()
        or 0
    )

    nb_renouvellements = (
        db.query(func.count(AgrementMareyage.id))
        .filter(AgrementMareyage.renouvele_de_id.isnot(None))
        .scalar()
        or 0
    )

    bloc_agrements = BlocAgrements(
        total=total_agr,
        par_statut=_serie_from_counter(_group_count(db, AgrementMareyage.statut)),
        par_categorie=_serie_from_counter(_group_count(db, AgrementMareyage.categorie)),
        montant_total_redevances_fcfa=round(float(montant_redevances), 2),
        nombre_delivres=nb_delivres,
        nombre_expires=nb_expires,
        nombre_expirant_30j=nb_expirant_30j,
        nombre_renouvellements=nb_renouvellements,
    )

    # ------------------------------------------------------------------ #
    # Bloc INSTALLATIONS (snapshot)
    # ------------------------------------------------------------------ #
    total_inst = db.query(func.count(InstallationMareyage.id)).scalar() or 0
    capacite_totale = (
        db.query(
            func.coalesce(func.sum(InstallationMareyage.capacite_tonnes), 0.0)
        ).scalar()
        or 0.0
    )

    bloc_installations = BlocInstallations(
        total=total_inst,
        par_type=_serie_from_counter(
            _group_count(db, InstallationMareyage.type_installation)
        ),
        par_statut=_serie_from_counter(_group_count(db, InstallationMareyage.statut)),
        capacite_totale_tonnes=round(float(capacite_totale), 2),
    )

    # ------------------------------------------------------------------ #
    # Bloc TRANSACTIONS (filtré par période)
    # ------------------------------------------------------------------ #
    q_base = db.query(TransactionAchat)
    if date_debut:
        q_base = q_base.filter(TransactionAchat.date_transaction >= date_debut)
    if date_fin:
        q_base = q_base.filter(TransactionAchat.date_transaction <= date_fin)

    total_trx = q_base.count()

    # Agrégats globaux (avec les mêmes filtres)
    q_sum = db.query(
        func.coalesce(func.sum(TransactionAchat.quantite_kg), 0.0),
        func.coalesce(func.sum(TransactionAchat.montant_total_fcfa), 0.0),
    )
    if date_debut:
        q_sum = q_sum.filter(TransactionAchat.date_transaction >= date_debut)
    if date_fin:
        q_sum = q_sum.filter(TransactionAchat.date_transaction <= date_fin)
    qte_totale, montant_total = q_sum.one()
    qte_totale = float(qte_totale or 0.0)
    montant_total = float(montant_total or 0.0)
    prix_moyen = round(montant_total / qte_totale, 2) if qte_totale else 0.0

    # Répartition par état du poisson
    q_etat = db.query(
        TransactionAchat.etat_poisson,
        func.coalesce(func.sum(TransactionAchat.quantite_kg), 0.0),
    )
    if date_debut:
        q_etat = q_etat.filter(TransactionAchat.date_transaction >= date_debut)
    if date_fin:
        q_etat = q_etat.filter(TransactionAchat.date_transaction <= date_fin)
    etat = {
        (k or "non_precise"): float(v)
        for k, v in q_etat.group_by(TransactionAchat.etat_poisson).all()
    }

    # Top espèces (par quantité)
    q_esp = db.query(
        TransactionAchat.espece,
        func.coalesce(func.sum(TransactionAchat.quantite_kg), 0.0),
    )
    if date_debut:
        q_esp = q_esp.filter(TransactionAchat.date_transaction >= date_debut)
    if date_fin:
        q_esp = q_esp.filter(TransactionAchat.date_transaction <= date_fin)
    especes = {
        (k or "non_precise"): float(v)
        for k, v in q_esp.group_by(TransactionAchat.espece).all()
    }

    # Par site de débarquement (quantité)
    q_site = db.query(
        TransactionAchat.site_debarquement,
        func.coalesce(func.sum(TransactionAchat.quantite_kg), 0.0),
    )
    if date_debut:
        q_site = q_site.filter(TransactionAchat.date_transaction >= date_debut)
    if date_fin:
        q_site = q_site.filter(TransactionAchat.date_transaction <= date_fin)
    sites_trx = {
        (k or "non_precise"): float(v)
        for k, v in q_site.group_by(TransactionAchat.site_debarquement).all()
    }

    # Évolution mensuelle (bucketing Python -> portable tous SGBD)
    q_evo = db.query(
        TransactionAchat.date_transaction,
        TransactionAchat.quantite_kg,
        TransactionAchat.montant_total_fcfa,
    )
    if date_debut:
        q_evo = q_evo.filter(TransactionAchat.date_transaction >= date_debut)
    if date_fin:
        q_evo = q_evo.filter(TransactionAchat.date_transaction <= date_fin)

    evo_kg: dict[str, float] = defaultdict(float)
    evo_fcfa: dict[str, float] = defaultdict(float)
    for dt, kg, mt in q_evo.all():
        if not dt:
            continue
        cle = f"{dt.year:04d}-{dt.month:02d}"
        evo_kg[cle] += float(kg or 0.0)
        evo_fcfa[cle] += float(mt or 0.0)

    mois_tries = sorted(evo_kg.keys())
    serie_evo_kg = SerieChart(
        labels=mois_tries,
        data=[round(evo_kg[m], 2) for m in mois_tries],
    )
    serie_evo_fcfa = SerieChart(
        labels=mois_tries,
        data=[round(evo_fcfa[m], 2) for m in mois_tries],
    )

    bloc_transactions = BlocTransactions(
        total=total_trx,
        quantite_totale_kg=round(qte_totale, 2),
        montant_total_fcfa=round(montant_total, 2),
        prix_moyen_fcfa_par_kg=prix_moyen,
        par_etat_poisson=_serie_from_counter(etat),
        top_especes_quantite=_serie_from_counter(especes, top_n=top_n),
        par_site_debarquement=_serie_from_counter(sites_trx, top_n=top_n),
        evolution_mensuelle_kg=serie_evo_kg,
        evolution_mensuelle_fcfa=serie_evo_fcfa,
    )

    return StatistiquesMareyeurs(
        genere_le=datetime.now(),
        periode_debut=date_debut,
        periode_fin=date_fin,
        mareyeurs=bloc_mareyeurs,
        agrements=bloc_agrements,
        installations=bloc_installations,
        transactions=bloc_transactions,
    )


# =============================================================================
# 4. Endpoint JSON (dashboards Chart.js)
# =============================================================================


@router.post("/statistiques", response_model=StatistiquesMareyeurs)
def statistiques_mareyeurs(
    filtre: FiltreStatistiques = FiltreStatistiques(),
    db: Session = Depends(get_db),
):
    """Statistiques complètes du module mareyeurs, prêtes pour Chart.js."""
    return calculer_statistiques(
        db,
        date_debut=filtre.date_debut,
        date_fin=filtre.date_fin,
        top_n=filtre.top_n,
    )


# =============================================================================
# 5. Export PDF (reportlab + matplotlib)
# =============================================================================


def _fmt_fcfa(v: float) -> str:
    return f"{v:,.0f} FCFA".replace(",", " ")


def _fig_barres(serie: SerieChart, titre: str, couleur: str = "#1565c0") -> BytesIO:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6.4, 3.4), dpi=130)
    labels = serie.labels or ["—"]
    data = serie.data or [0]
    ax.bar(labels, data, color=couleur)
    ax.set_title(titre, fontsize=11, fontweight="bold")
    ax.tick_params(axis="x", labelrotation=30, labelsize=8)
    ax.tick_params(axis="y", labelsize=8)
    for lbl in ax.get_xticklabels():
        lbl.set_ha("right")
    ax.grid(axis="y", linestyle=":", alpha=0.4)
    fig.tight_layout()
    buf = BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return buf


def _fig_camembert(serie: SerieChart, titre: str) -> BytesIO:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(4.2, 3.4), dpi=130)
    labels = serie.labels or ["Aucune donnée"]
    data = serie.data or [1]
    ax.pie(
        data, labels=labels, autopct="%1.0f%%", startangle=90, textprops={"fontsize": 8}
    )
    ax.set_title(titre, fontsize=11, fontweight="bold")
    fig.tight_layout()
    buf = BytesIO()
    fig.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    return buf


def generer_pdf(stats: StatistiquesMareyeurs) -> BytesIO:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
        Image,
    )

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        leftMargin=1.6 * cm,
        rightMargin=1.6 * cm,
        title="Rapport statistique - Mareyeurs",
    )
    styles = getSampleStyleSheet()
    style_titre = ParagraphStyle(
        "TitrePrincipal",
        parent=styles["Title"],
        fontSize=16,
        textColor=colors.HexColor("#0d47a1"),
        spaceAfter=4,
    )
    style_sous = ParagraphStyle(
        "SousTitre",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#555555"),
        alignment=1,
    )
    style_section = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#0d47a1"),
        spaceBefore=14,
        spaceAfter=6,
    )

    elements = []

    # En-tête
    elements.append(Paragraph("République Gabonaise", style_sous))
    elements.append(
        Paragraph("Ministère en charge de la Pêche et de l'Aquaculture", style_sous)
    )
    elements.append(Spacer(1, 8))
    elements.append(Paragraph("RAPPORT STATISTIQUE — MAREYEURS", style_titre))
    periode = "Ensemble des données"
    if stats.periode_debut or stats.periode_fin:
        d = stats.periode_debut.strftime("%d/%m/%Y") if stats.periode_debut else "…"
        f = stats.periode_fin.strftime("%d/%m/%Y") if stats.periode_fin else "…"
        periode = f"Période (transactions) : {d} → {f}"
    elements.append(Paragraph(periode, style_sous))
    elements.append(
        Paragraph(
            "Généré le " + stats.genere_le.strftime("%d/%m/%Y à %H:%M"), style_sous
        )
    )
    elements.append(Spacer(1, 12))

    # Synthèse (KPI)
    elements.append(Paragraph("Synthèse", style_section))
    kpi_data = [
        ["Indicateur", "Valeur"],
        ["Mareyeurs enregistrés", str(stats.mareyeurs.total)],
        ["Mareyeurs actifs", str(stats.mareyeurs.actifs)],
        ["Agréments (total)", str(stats.agrements.total)],
        ["Agréments délivrés", str(stats.agrements.nombre_delivres)],
        ["Agréments expirés", str(stats.agrements.nombre_expires)],
        ["Agréments expirant sous 30 j", str(stats.agrements.nombre_expirant_30j)],
        [
            "Redevances cumulées",
            _fmt_fcfa(stats.agrements.montant_total_redevances_fcfa),
        ],
        ["Installations déclarées", str(stats.installations.total)],
        ["Capacité froid totale", f"{stats.installations.capacite_totale_tonnes:g} t"],
        ["Transactions d'achat", str(stats.transactions.total)],
        ["Volume acheté", f"{stats.transactions.quantite_totale_kg:g} kg"],
        ["Valeur des achats", _fmt_fcfa(stats.transactions.montant_total_fcfa)],
        ["Prix moyen", f"{stats.transactions.prix_moyen_fcfa_par_kg:g} FCFA/kg"],
    ]
    t = Table(kpi_data, colWidths=[9 * cm, 7 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0d47a1")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#eef3fb")],
                ),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#b0bec5")),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(t)

    # Graphiques
    def _img(buf: BytesIO, w=15.5, h=7.5):
        return Image(buf, width=w * cm, height=h * cm)

    elements.append(Paragraph("Répartition des mareyeurs", style_section))
    elements.append(
        _img(
            _fig_camembert(stats.mareyeurs.par_statut, "Mareyeurs par statut"),
            w=10,
            h=6.5,
        )
    )

    elements.append(Paragraph("Agréments", style_section))
    elements.append(
        _img(_fig_barres(stats.agrements.par_statut, "Agréments par statut", "#00897b"))
    )

    elements.append(Paragraph("Installations & équipements", style_section))
    elements.append(
        _img(
            _fig_barres(
                stats.installations.par_type, "Installations par type", "#5e35b1"
            )
        )
    )

    elements.append(Paragraph("Transactions d'achat", style_section))
    elements.append(
        _img(
            _fig_barres(
                stats.transactions.top_especes_quantite,
                "Top espèces achetées (kg)",
                "#ef6c00",
            )
        )
    )
    if stats.transactions.evolution_mensuelle_kg.labels:
        elements.append(
            _img(
                _fig_barres(
                    stats.transactions.evolution_mensuelle_kg,
                    "Évolution mensuelle des volumes (kg)",
                    "#1565c0",
                )
            )
        )

    doc.build(elements)
    buffer.seek(0)
    return buffer


@router.post("/statistiques/export/pdf")
def export_pdf_statistiques(
    filtre: FiltreStatistiques = FiltreStatistiques(),
    db: Session = Depends(get_db),
):
    """Génère et renvoie le rapport statistique au format PDF."""
    stats = calculer_statistiques(
        db,
        date_debut=filtre.date_debut,
        date_fin=filtre.date_fin,
        top_n=filtre.top_n,
    )
    pdf = generer_pdf(stats)
    horodatage = datetime.now().strftime("%Y%m%d_%H%M")
    nom = f"rapport_statistique_mareyeurs_{horodatage}.pdf"
    return StreamingResponse(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nom}"'},
    )
