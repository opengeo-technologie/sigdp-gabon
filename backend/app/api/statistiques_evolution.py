# app/api/statistics_evolution.py - ÉVOLUTION CAPTURES MULTIDIMENSIONNELLE

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import extract, func, and_
from datetime import datetime, timedelta
from typing import Optional, List

from app.database import get_db
from app.models.debarquement import Debarquement, DetailDebarquement
from app.models.debarcadere import Debarcadere
from app.models.pecheur import Pecheur

# from app.models.zone_peche import ZonePeche

router = APIRouter(prefix="/api/stats/evolution", tags=["Evolution Captures"])


# ==================== HELPERS ====================


def format_periode(annee, mois=None, semaine=None, jour=None):
    """Formater la période selon le type"""
    if mois:
        return f"{int(annee)}-{int(mois):02d}"
    elif semaine:
        return f"{int(annee)}-W{int(semaine):02d}"
    elif jour:
        return f"{int(annee)}-{int(mois):02d}-{int(jour):02d}"
    else:
        return f"{int(annee)}"


def get_date_range(periode: str, limite: int):
    """Récupérer la plage de dates selon la période"""
    today = datetime.now().date()

    if periode == "jour":
        start_date = today - timedelta(days=limite)
    elif periode == "semaine":
        start_date = today - timedelta(weeks=limite)
    elif periode == "mois":
        start_date = today - timedelta(days=30 * limite)
    elif periode == "annee":
        start_date = today - timedelta(days=365 * limite)
    else:
        start_date = today - timedelta(days=30)

    return start_date, today


# ==================== ÉVOLUTION PAR DÉBARCADÈRE ====================


@router.get("/debarcadere")
def get_evolution_par_debarcadere(
    periode: str = Query("mois", regex="^(jour|semaine|mois|annee)$"),
    limite: int = Query(12, ge=1, le=365),
    debarcadere_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Évolution des captures par débarcadère

    Params:
    - periode: jour/semaine/mois/annee
    - limite: Nombre de périodes à retourner
    - debarcadere_id: Filtrer sur un débarcadère (optionnel)
    """

    print(f"\n📊 Evolution par débarcadère - Période: {periode}, Limite: {limite}")

    start_date, end_date = get_date_range(periode, limite)

    base_query = db.query(
        Debarcadere.denomination,
        Debarcadere.province,
        Debarcadere.localite,
    ).distinct(Debarcadere.id)

    if debarcadere_id:
        base_query = base_query.filter(Debarcadere.id == debarcadere_id)

    debarcaderes = base_query.all()

    evolution_data = []

    for debarcadere in debarcaderes:
        nom = debarcadere.denomination
        province = debarcadere.province
        localite = debarcadere.localite

        if periode == "jour":
            resultats = (
                db.query(
                    extract("year", Debarquement.date_debarquement).label("annee"),
                    extract("month", Debarquement.date_debarquement).label("mois"),
                    extract("day", Debarquement.date_debarquement).label("jour"),
                    func.count(Debarquement.id).label("nombre"),
                    func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
                )
                .join(
                    DetailDebarquement,
                    DetailDebarquement.debarquement_id == Debarquement.id,
                )
                .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
                .filter(
                    and_(
                        Debarquement.debarcadere_id == Debarcadere.id,
                        # Debarquement.date_debarquement >= start_date,
                        # Debarquement.date_debarquement <= end_date,
                    )
                )
                .group_by("annee", "mois", "jour")
                .order_by("annee", "mois", "jour")
                .limit(limite)
                .all()
            )

            periodes = [
                {
                    "periode": f"{int(r.annee)}-{int(r.mois):02d}-{int(r.jour):02d}",
                    "nombre_debarquements": r.nombre or 0,
                    "quantite_kg": float(r.quantite_kg or 0),
                    "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 2),
                }
                for r in resultats
            ]

        elif periode == "semaine":
            resultats = (
                db.query(
                    extract("year", Debarquement.date_debarquement).label("annee"),
                    extract("week", Debarquement.date_debarquement).label("semaine"),
                    func.count(Debarquement.id).label("nombre"),
                    func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
                )
                .join(
                    DetailDebarquement,
                    DetailDebarquement.debarquement_id == Debarquement.id,
                )
                .filter(
                    and_(
                        Debarquement.debarcadere_id == Debarcadere.id,
                        # Debarquement.date_debarquement >= start_date,
                        # Debarquement.date_debarquement <= end_date,
                    )
                )
                .group_by("annee", "semaine")
                .order_by("annee", "semaine")
                .limit(limite)
                .all()
            )

            periodes = [
                {
                    "periode": f"{int(r.annee)}-W{int(r.semaine):02d}",
                    "nombre_debarquements": r.nombre or 0,
                    "quantite_kg": float(r.quantite_kg or 0),
                    "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 2),
                }
                for r in resultats
            ]

        elif periode == "mois":
            resultats = (
                db.query(
                    extract("year", Debarquement.date_debarquement).label("annee"),
                    extract("month", Debarquement.date_debarquement).label("mois"),
                    func.count(Debarquement.id).label("nombre"),
                    func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
                )
                .join(
                    DetailDebarquement,
                    DetailDebarquement.debarquement_id == Debarquement.id,
                )
                .filter(
                    and_(
                        Debarquement.debarcadere_id == Debarcadere.id,
                        # Debarquement.date_debarquement >= start_date,
                        # Debarquement.date_debarquement <= end_date,
                    )
                )
                .group_by("annee", "mois")
                .order_by("annee", "mois")
                .limit(limite)
                .all()
            )

            periodes = [
                {
                    "periode": f"{int(r.annee)}-{int(r.mois):02d}",
                    "nombre_debarquements": r.nombre or 0,
                    "quantite_kg": float(r.quantite_kg or 0),
                    "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 2),
                }
                for r in resultats
            ]

        else:  # annee
            resultats = (
                db.query(
                    extract("year", Debarquement.date_debarquement).label("annee"),
                    func.count(Debarquement.id).label("nombre"),
                    func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
                )
                .join(
                    DetailDebarquement,
                    DetailDebarquement.debarquement_id == Debarquement.id,
                )
                .filter(
                    and_(
                        Debarquement.debarcadere_id == debarcadere.id,
                        # Debarquement.date_debarquement >= start_date,
                        # Debarquement.date_debarquement <= end_date,
                    )
                )
                .group_by("annee")
                .order_by("annee")
                .limit(limite)
                .all()
            )

            periodes = [
                {
                    "periode": f"{int(r.annee)}",
                    "nombre_debarquements": r.nombre or 0,
                    "quantite_kg": float(r.quantite_kg or 0),
                    "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 2),
                }
                for r in resultats
            ]

        evolution_data.append(
            {
                "debarcadere": nom,
                "province": province,
                "localite": localite,
                "evolution": periodes,
            }
        )

    return {"periode": periode, "limite": limite, "debarcaderes": evolution_data}


# ==================== ÉVOLUTION PAR LOCALITÉ ====================


@router.get("/localite")
def get_evolution_par_localite(
    periode: str = Query("mois", regex="^(jour|semaine|mois|annee)$"),
    limite: int = Query(12, ge=1, le=365),
    localite: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Évolution des captures par localité
    """

    print(f"\n📊 Evolution par localité - Période: {periode}")

    start_date, end_date = get_date_range(periode, limite)

    # Récupérer toutes les localités
    localites_query = (
        db.query(Debarcadere.localite)
        .filter(Debarcadere.localite.isnot(None))
        .distinct()
    )

    if localite:
        localites_query = localites_query.filter(Debarcadere.localite == localite)

    localites = [row[0] for row in localites_query.all()]

    evolution_data = []

    for loc in localites:
        if periode == "mois":
            resultats = (
                db.query(
                    extract("year", Debarquement.date_debarquement).label("annee"),
                    extract("month", Debarquement.date_debarquement).label("mois"),
                    func.count(Debarquement.id).label("nombre"),
                    func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
                )
                .join(
                    DetailDebarquement,
                    DetailDebarquement.debarquement_id == Debarquement.id,
                )
                .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
                .filter(
                    and_(
                        Debarcadere.localite == loc,
                        # Debarquement.date_debarquement >= start_date,
                        # Debarquement.date_debarquement <= end_date,
                    )
                )
                .group_by("annee", "mois")
                .order_by("annee", "mois")
                .limit(limite)
                .all()
            )

        else:  # Pour jour/semaine/année, adapter la query
            resultats = (
                db.query(
                    extract("year", Debarquement.date_debarquement).label("annee"),
                    extract("month", Debarquement.date_debarquement).label("mois"),
                    func.count(Debarquement.id).label("nombre"),
                    func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
                )
                .join(
                    DetailDebarquement,
                    DetailDebarquement.debarquement_id == Debarquement.id,
                )
                .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
                .filter(
                    and_(
                        Debarcadere.localite == loc,
                        # Debarquement.date_debarquement >= start_date,
                        # Debarquement.date_debarquement <= end_date,
                    )
                )
                .group_by("annee", "mois")
                .order_by("annee", "mois")
                .limit(limite)
                .all()
            )

        periodes = [
            {
                "periode": f"{int(r.annee)}-{int(r.mois):02d}",
                "nombre_debarquements": r.nombre or 0,
                "quantite_kg": float(r.quantite_kg or 0),
                "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 2),
            }
            for r in resultats
        ]

        evolution_data.append({"localite": loc, "evolution": periodes})

    return {"periode": periode, "limite": limite, "localites": evolution_data}


# ==================== ÉVOLUTION PAR PROVINCE ====================


@router.get("/province")
def get_evolution_par_province(
    periode: str = Query("mois", regex="^(jour|semaine|mois|annee)$"),
    limite: int = Query(12, ge=1, le=365),
    province: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Évolution des captures par province
    """

    print(f"\n📊 Evolution par province - Période: {periode}")

    start_date, end_date = get_date_range(periode, limite)

    # Récupérer toutes les provinces
    provinces_query = (
        db.query(Debarcadere.province)
        .filter(Debarcadere.province.isnot(None))
        .distinct()
    )

    if province:
        provinces_query = provinces_query.filter(Debarcadere.province == province)

    provinces = [row[0] for row in provinces_query.all()]

    evolution_data = []

    for prov in provinces:
        if periode == "mois":
            resultats = (
                db.query(
                    extract("year", Debarquement.date_debarquement).label("annee"),
                    extract("month", Debarquement.date_debarquement).label("mois"),
                    func.count(Debarquement.id).label("nombre"),
                    func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
                )
                .join(
                    DetailDebarquement,
                    DetailDebarquement.debarquement_id == Debarquement.id,
                )
                .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
                .filter(
                    and_(
                        Debarcadere.province == prov,
                        # Debarquement.date_debarquement >= start_date,
                        # Debarquement.date_debarquement <= end_date,
                    )
                )
                .group_by("annee", "mois")
                .order_by("annee", "mois")
                .limit(limite)
                .all()
            )

        else:
            resultats = (
                db.query(
                    extract("year", Debarquement.date_debarquement).label("annee"),
                    extract("month", Debarquement.date_debarquement).label("mois"),
                    func.count(Debarquement.id).label("nombre"),
                    func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
                )
                .join(
                    DetailDebarquement,
                    DetailDebarquement.debarquement_id == Debarquement.id,
                )
                .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
                .filter(
                    and_(
                        Debarcadere.province == prov,
                        Debarquement.date_debarquement >= start_date,
                        Debarquement.date_debarquement <= end_date,
                    )
                )
                .group_by("annee", "mois")
                .order_by("annee", "mois")
                .limit(limite)
                .all()
            )

        periodes = [
            {
                "periode": f"{int(r.annee)}-{int(r.mois):02d}",
                "nombre_debarquements": r.nombre or 0,
                "quantite_kg": float(r.quantite_kg or 0),
                "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 2),
            }
            for r in resultats
        ]

        evolution_data.append({"province": prov, "evolution": periodes})

    return {"periode": periode, "limite": limite, "provinces": evolution_data}


# ==================== COMPARAISON MULTIDIMENSIONNELLE ====================


@router.get("/comparaison")
def get_comparaison_captures(
    periode: str = Query("mois", regex="^(jour|semaine|mois|annee)$"),
    limite: int = Query(12, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """
    Comparaison globale: Province vs Localité vs Débarcadère
    Affiche le top 5 pour chaque dimension
    """

    print(f"\n📊 Comparaison multidimensionnelle - Période: {periode}")

    start_date, end_date = get_date_range(periode, limite)

    # Top 5 provinces
    top_provinces = (
        db.query(
            Debarcadere.province,
            func.count(Debarquement.id).label("nombre"),
            func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
        )
        .join(DetailDebarquement, DetailDebarquement.debarquement_id == Debarquement.id)
        .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
        # .filter(
        #     and_(
        #         Debarquement.date_debarquement >= start_date,
        #         Debarquement.date_debarquement <= end_date,
        #     )
        # )
        .group_by(Debarcadere.province)
        .order_by(func.sum(DetailDebarquement.quantite_kg).desc())
        .limit(5)
        .all()
    )

    # Top 5 localités
    top_localites = (
        db.query(
            Debarcadere.localite,
            func.count(Debarquement.id).label("nombre"),
            func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
        )
        .join(DetailDebarquement, DetailDebarquement.debarquement_id == Debarquement.id)
        .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
        # .filter(
        #     and_(
        #         Debarquement.date_debarquement >= start_date,
        #         Debarquement.date_debarquement <= end_date,
        #     )
        # )
        .group_by(Debarcadere.localite)
        .order_by(func.sum(DetailDebarquement.quantite_kg).desc())
        .limit(5)
        .all()
    )

    # Top 5 débarcadères
    top_debarcaderes = (
        db.query(
            Debarcadere.denomination,
            func.count(Debarquement.id).label("nombre"),
            func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
        )
        .join(DetailDebarquement, DetailDebarquement.debarquement_id == Debarquement.id)
        .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
        # .filter(
        #     and_(
        #         Debarquement.date_debarquement >= start_date,
        #         Debarquement.date_debarquement <= end_date,
        #     )
        # )
        .group_by(Debarcadere.denomination)
        .order_by(func.sum(DetailDebarquement.quantite_kg).desc())
        .limit(5)
        .all()
    )

    return {
        "periode": periode,
        "top_provinces": [
            {
                "nom": r[0],
                "nombre_debarquements": r[1],
                "quantite_tonnes": round(float(r[2] or 0) / 1000, 2),
            }
            for r in top_provinces
        ],
        "top_localites": [
            {
                "nom": r[0],
                "nombre_debarquements": r[1],
                "quantite_tonnes": round(float(r[2] or 0) / 1000, 2),
            }
            for r in top_localites
        ],
        "top_debarcaderes": [
            {
                "nom": r[0],
                "nombre_debarquements": r[1],
                "quantite_tonnes": round(float(r[2] or 0) / 1000, 2),
            }
            for r in top_debarcaderes
        ],
    }


# ==================== EVOLUTION GLOBALE MULTIDIMENSIONNELLE ====================


@router.get("/globale")
def get_evolution_globale(
    periode: str = Query("mois", regex="^(jour|semaine|mois|annee)$"),
    limite: int = Query(12, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """
    Évolution globale des captures
    ✅ FIXED: .select_from(DetailDebarquement)
    """

    print(f"\n📊 Evolution globale - Période: {periode}")

    start_date, end_date = get_date_range(periode, limite)

    # ==================== REQUÊTE 1: ÉVOLUTION GLOBALE ====================

    if periode == "mois":
        global_evolution = (
            db.query(
                extract("year", Debarquement.date_debarquement).label("annee"),
                extract("month", Debarquement.date_debarquement).label("mois"),
                func.count(Debarquement.id).label("nombre"),
                func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
            )
            .select_from(DetailDebarquement)  # ✅ IMPORTANT!
            .join(Debarquement, Debarquement.id == DetailDebarquement.debarquement_id)
            # .filter(
            #     and_(
            #         Debarquement.date_debarquement >= start_date,
            #         Debarquement.date_debarquement <= end_date,
            #     )
            # )
            .group_by("annee", "mois")
            .order_by("annee", "mois")
            .limit(limite)
            .all()
        )
    else:
        global_evolution = (
            db.query(
                extract("year", Debarquement.date_debarquement).label("annee"),
                extract("month", Debarquement.date_debarquement).label("mois"),
                func.count(Debarquement.id).label("nombre"),
                func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
            )
            .select_from(DetailDebarquement)  # ✅ IMPORTANT!
            .join(Debarquement, Debarquement.id == DetailDebarquement.debarquement_id)
            # .filter(
            #     and_(
            #         Debarquement.date_debarquement >= start_date,
            #         Debarquement.date_debarquement <= end_date,
            #     )
            # )
            .group_by("annee", "mois")
            .order_by("annee", "mois")
            .limit(limite)
            .all()
        )

    evolution_globale = [
        {
            "periode": f"{int(r.annee)}-{int(r.mois):02d}",
            "nombre_debarquements": r.nombre or 0,
            "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 2),
        }
        for r in global_evolution
    ]

    # ==================== REQUÊTE 2: TOP 3 PROVINCES (FIXED) ====================

    top_provinces = (
        db.query(
            Debarcadere.province.label("nom"),
            func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
        )
        .select_from(DetailDebarquement)  # ✅ FIXED: select_from() au début!
        .join(Debarquement, Debarquement.id == DetailDebarquement.debarquement_id)
        .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
        # .filter(
        #     and_(
        #         Debarquement.date_debarquement >= start_date,
        #         Debarquement.date_debarquement <= end_date,
        #     )
        # )
        .group_by(Debarcadere.province)
        .order_by(func.sum(DetailDebarquement.quantite_kg).desc())
        .limit(3)
        .all()
    )

    # ==================== REQUÊTE 3: TOP 3 DÉBARCADÈRES (FIXED) ====================

    top_debarcaderes = (
        db.query(
            Debarcadere.denomination.label("nom"),
            func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
        )
        .select_from(DetailDebarquement)  # ✅ FIXED: select_from() au début!
        .join(Debarquement, Debarquement.id == DetailDebarquement.debarquement_id)
        .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
        # .filter(
        #     and_(
        #         Debarquement.date_debarquement >= start_date,
        #         Debarquement.date_debarquement <= end_date,
        #     )
        # )
        .group_by(Debarcadere.denomination)
        .order_by(func.sum(DetailDebarquement.quantite_kg).desc())
        .limit(3)
        .all()
    )

    return {
        "periode": periode,
        "limite": limite,
        "evolution_globale": evolution_globale,
        "top_3_provinces": [
            {
                "province": r[0],
                "quantite_tonnes": round(float(r[1] or 0) / 1000, 2),
            }
            for r in top_provinces
        ],
        "top_3_debarcaderes": [
            {
                "debarcadere": r[0],
                "quantite_tonnes": round(float(r[1] or 0) / 1000, 2),
            }
            for r in top_debarcaderes
        ],
    }
