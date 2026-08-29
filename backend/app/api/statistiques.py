from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, asc, desc
from typing import Dict, List, Optional
from datetime import date, datetime, timedelta

from app.database import get_db
from app.models.debarquement import Debarquement, DetailDebarquement
from app.models.debarcadere import Debarcadere
from app.models.pecheur import Pecheur
from app.models.bateau import Bateau
from app.models.espece import Espece
from app.models.licence import LicenceAutorisationPeche
from app.models.armement_coorperative import ArmementCooperative
from app.models.mareyeur import TransactionAchat

router = APIRouter(prefix="/api/statistiques", tags=["Statistiques"])


LIST_MONTHS = [
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
    "Decembre",
]


@router.get("/dashboard")
def get_dashboard_stats(
    annee_selected: Optional[int] = None, db: Session = Depends(get_db)
):
    """
    Statistiques pour le tableau de bord principal
    """
    # Statistiques globales
    total_debarcaderes = (
        db.query(Debarcadere).filter(Debarcadere.statut_operationnel == "Actif").count()
    )
    total_pecheurs = db.query(Pecheur).filter(Pecheur.statut == "Actif").count()
    total_bateaux = db.query(Bateau).filter(Bateau.statut == "Actif").count()

    # Débarquements du mois en cours
    debut_mois = date.today().replace(day=1)
    debarquements_mois = (
        db.query(Debarquement)
        .filter(Debarquement.date_debarquement >= debut_mois)
        .count()
    )

    # Captures du mois
    details_mois = (
        db.query(
            func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
            func.sum(DetailDebarquement.valeur_totale).label("total_valeur"),
        )
        .join(Debarquement)
        .filter(Debarquement.date_debarquement >= debut_mois)
        .first()
    )

    # Captures annuelles
    debut_annee = date(2024, 1, 1)
    details_annee = (
        db.query(
            func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
            func.sum(DetailDebarquement.valeur_totale).label("total_valeur"),
        )
        .join(Debarquement)
        .filter(Debarquement.date_debarquement >= debut_annee)
        .first()
    )

    total_kg_mois = details_mois.total_kg or 0
    total_valeur_mois = details_mois.total_valeur or 0
    total_kg_annee = details_annee.total_kg or 0
    total_valeur_annee = details_annee.total_valeur or 0

    # Alertes actives
    alertes_actives = (
        db.query(Debarquement)
        .filter(
            (Debarquement.alerte_espece_protegee == True)
            | (Debarquement.alerte_quota_depasse == True)
            | (Debarquement.alerte_taille_illegale == True)
            | (Debarquement.alerte_bateau_non_conforme == True)
        )
        .filter(Debarquement.date_debarquement >= debut_mois)
        .count()
    )

    # Filtrer les quantites groupé par annee
    details_annee_group = (
        db.query(
            extract("year", Debarquement.date_debarquement).label("annee"),
            func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
            func.sum(DetailDebarquement.valeur_totale).label("total_valeur"),
        )
        .join(Debarquement, Debarquement.id == DetailDebarquement.debarquement_id)
        .group_by("annee")
        .order_by("annee")
        .all()
    )

    capture_groupe_par_annee = []

    for item in details_annee_group:
        capture_groupe_par_annee.append(
            {
                "annee": item.annee,
                "quantite_kg": round(item.total_kg, 2),
                "quantite_tonnes": round(item.total_kg / 1000, 3),
            }
        )

    # Licences expirées ou à renouveler (dans les 30 jours)
    date_limite = date.today() + timedelta(days=30)
    # licences_a_renouveler = db.query(Pecheur).filter(
    #     Pecheur.licence_date_expiration <= date_limite,
    #     Pecheur.statut == "Actif"
    # ).count()

    # ✅ Extraire
    annee = debut_mois.year
    mois = debut_mois.month

    return {
        "periode": {
            "full": f"{LIST_MONTHS[int(mois) - 1]} {int(annee)}",
            "periode": f"{int(annee)}-{int(mois):02d}",
        },
        "globaux": {
            "debarcaderes_actifs": total_debarcaderes,
            "pecheurs_actifs": total_pecheurs,
            "bateaux_actifs": total_bateaux,
            "debarquements_mois": debarquements_mois,
        },
        "captures_mois": {
            "quantite_kg": round(total_kg_mois, 2),
            "quantite_tonnes": round(total_kg_mois / 1000, 3),
            "valeur_fcfa": round(total_valeur_mois, 2),
        },
        "captures_annee": {
            "quantite_kg": round(total_kg_annee, 2),
            "quantite_tonnes": round(total_kg_annee / 1000, 3),
            "valeur_fcfa": round(total_valeur_annee, 2),
        },
        "captures_annee_group": capture_groupe_par_annee,
        "alertes": {
            "actives_mois": alertes_actives,
            "licences_a_renouveler": 0,
        },
    }


@router.get("/debarquements/evolution")
def get_evolution_debarquements(
    periode: str = Query("mois", regex="^(jour|semaine|mois|annee)$"),
    limite: int = Query(12, ge=1, le=365),
    db: Session = Depends(get_db),
):
    """
    Évolution des débarquements dans le temps
    """
    if periode == "mois":
        # Grouper par mois
        resultats = (
            db.query(
                extract("year", Debarquement.date_debarquement).label("annee"),
                extract("month", Debarquement.date_debarquement).label("mois"),
                func.count(Debarquement.id).label("nombre"),
                func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
            )
            .select_from(Debarquement)
            .join(
                DetailDebarquement,
                DetailDebarquement.debarquement_id == Debarquement.id,
            )
            .group_by("annee", "mois")
            .order_by("annee", "mois")
            .limit(limite)
            .all()
        )

        evolution = []
        for r in resultats:
            evolution.append(
                {
                    "periode": f"{int(r.annee)}-{int(r.mois):02d}",
                    "nombre_debarquements": r.nombre,
                    "quantite_kg": float(r.quantite_kg or 0),
                    "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 3),
                }
            )

        return evolution

    if periode == "annee":
        # Grouper par année
        resultats = (
            db.query(
                extract("year", Debarquement.date_debarquement).label("annee"),
                func.count(Debarquement.id).label("nombre"),
                func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
            )
            .select_from(Debarquement)
            .join(
                DetailDebarquement,
                DetailDebarquement.debarquement_id == Debarquement.id,
            )
            .group_by("annee")
            .order_by("annee")
            .limit(5)
            .all()
        )

        evolution = []
        for r in resultats:
            evolution.append(
                {
                    "periode": f"{int(r.annee)}",
                    "nombre_debarquements": r.nombre,
                    "quantite_kg": float(r.quantite_kg or 0),
                    "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 3),
                }
            )

        return evolution

    return []


@router.get("/especes/top")
def get_top_especes(
    limite: int = Query(10, ge=1, le=50),
    date_debut: Optional[date] = None,
    date_fin: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    Top des espèces les plus capturées
    """
    query = (
        db.query(
            Espece.nom_commun_francais,
            Espece.code_espece,
            func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
            func.sum(DetailDebarquement.valeur_totale).label("total_valeur"),
            func.count(DetailDebarquement.id).label("nb_captures"),
        )
        .select_from(Espece)
        .join(DetailDebarquement, DetailDebarquement.espece_id == Espece.id)
        .join(Debarquement, Debarquement.id == DetailDebarquement.debarquement_id)
    )

    if date_debut:
        query = query.filter(Debarquement.date_debarquement >= date_debut)
    if date_fin:
        query = query.filter(Debarquement.date_debarquement <= date_fin)

    resultats = (
        query.group_by(Espece.id, Espece.nom_commun_francais, Espece.code_espece)
        .order_by(func.sum(DetailDebarquement.quantite_kg).desc())
        .limit(limite)
        .all()
    )

    top_especes = []
    for r in resultats:
        top_especes.append(
            {
                "nom": r.nom_commun_francais,
                "code": r.code_espece,
                "quantite_kg": round(float(r.total_kg or 0), 3),
                "quantite_tonnes": round(float(r.total_kg or 0) / 1000, 3),
                "valeur_fcfa": round(float(r.total_valeur or 0), 2),
                "nb_captures": r.nb_captures,
            }
        )

    return top_especes


# @router.get("/debarcaderes/activite")
# def get_activite_debarcaderes(
#     limite: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)
# ):
#     """
#     Classement des débarcadères par activité
#     """
#     resultats = (
#         db.query(
#             Debarcadere.denomination,
#             # Debarcadere.code,
#             # Debarcadere.province,
#             func.count(Debarquement.id).label("nb_debarquements"),
#             func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
#         )
#         .select_from(Debarcadere)
#         .join(Debarquement, Debarquement.debarcadere_id == Debarcadere.id)
#         .join(DetailDebarquement, DetailDebarquement.debarquement_id == Debarquement.id)
#         .group_by(
#             # Debarcadere.id,
#             Debarcadere.denomination,
#             # Debarcadere.code,
#             # Debarcadere.province,
#         )
#         .order_by(func.count(Debarquement.id).desc())
#         .limit(limite)
#         .all()
#     )

#     classement = []
#     for r in resultats:
#         classement.append(
#             {
#                 "debarcadere": r.denomination,
#                 # "code": r.code,
#                 "nb_debarquements": r.nb_debarquements,
#                 "quantite_kg": round(float(r.total_kg or 0), 2),
#                 "quantite_tonnes": round(float(r.total_kg or 0) / 1000, 3),
#             }
#         )

#     return classement


@router.get("/debarcaderes/activite")
def get_activite_debarcaderes(
    limite: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)
):
    """
    Classement des débarcadères par activité
    """
    embarcations = (
        db.query(
            Debarcadere.denomination.label("nom_site"),
            Debarcadere.id.label("id_site"),
            func.count(Bateau.id).label("nb_debarquements"),
        )
        .select_from(Debarcadere)
        .join(Bateau, Bateau.site_port_attache == Debarcadere.id)
        .group_by(
            Debarcadere.id,
            Debarcadere.denomination,
        )
        .order_by(func.count(Bateau.id).desc())
        .limit(10)
    )

    classement = []

    for embarcation in embarcations:
        resultat = (
            db.query(
                Debarcadere.denomination,
                func.count(Debarquement.id).label("nb_debarquements"),
            )
            .select_from(Debarcadere)
            .join(Debarquement, Debarquement.debarcadere_id == Debarcadere.id)
            .filter(embarcation.id_site == Debarcadere.id)
            .group_by(
                Debarcadere.denomination,
            )
            .first()
        )

        resultat_quantite = (
            db.query(
                Debarcadere.denomination,
                func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
            )
            .select_from(Debarcadere)
            .join(Debarquement, Debarquement.debarcadere_id == Debarcadere.id)
            .join(
                DetailDebarquement,
                DetailDebarquement.debarquement_id == Debarquement.id,
            )
            .filter(embarcation.id_site == Debarcadere.id)
            .group_by(
                Debarcadere.denomination,
            )
            .first()
        )

        if resultat and resultat_quantite:
            classement.append(
                {
                    "debarcadere": embarcation.nom_site,
                    "nb_embarcations": embarcation.nb_debarquements,
                    "nb_debarquements": resultat.nb_debarquements,
                    "quantite_kg": round(float(resultat_quantite.total_kg or 0), 2),
                    "quantite_tonnes": round(
                        float(resultat_quantite.total_kg or 0) / 1000, 3
                    ),
                }
            )
    return classement


@router.get("/pecheurs/top")
def get_top_pecheurs(
    limite: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)
):
    """
    Top des pêcheurs par quantité capturée
    """
    resultats = (
        db.query(
            Pecheur.nom,
            Pecheur.prenom,
            Pecheur.numero_carte,
            func.count(Debarquement.id).label("nb_sorties"),
            func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
        )
        .select_from(Pecheur)
        .join(Debarquement, Debarquement.pecheur_principal_id == Pecheur.id)
        .join(DetailDebarquement, DetailDebarquement.debarquement_id == Debarquement.id)
        .group_by(Pecheur.id, Pecheur.nom, Pecheur.prenom, Pecheur.numero_carte)
        .order_by(func.sum(DetailDebarquement.quantite_kg).desc())
        .limit(limite)
        .all()
    )

    top_pecheurs = []
    for r in resultats:
        top_pecheurs.append(
            {
                "nom": f"{r.nom} {r.prenom}",
                "numero_carte": r.numero_carte,
                "nb_sorties": r.nb_sorties,
                "quantite_kg": round(float(r.total_kg or 0), 2),
                "quantite_tonnes": round(float(r.total_kg or 0) / 1000, 2),
            }
        )

    return top_pecheurs


@router.get("/valeur/mensuelle")
def get_valeur_mensuelle(db: Session = Depends(get_db)):
    """
    Valeur des captures par mois
    """
    resultats = (
        db.query(
            extract("year", Debarquement.date_debarquement).label("annee"),
            extract("month", Debarquement.date_debarquement).label("mois"),
            func.sum(DetailDebarquement.valeur_totale).label("valeur"),
        )
        .select_from(Debarquement)
        .join(DetailDebarquement, DetailDebarquement.debarquement_id == Debarquement.id)
        .group_by("annee", "mois")
        .order_by("annee", "mois")
        .limit(12)
        .all()
    )

    valeurs = []
    for r in resultats:
        valeurs.append(
            {
                "periode": f"{int(r.annee)}-{int(r.mois):02d}",
                "valeur_fcfa": round(float(r.valeur or 0), 2),
            }
        )

    return valeurs


@router.get("/quotas/utilisation")
def get_utilisation_quotas(db: Session = Depends(get_db)):
    """
    Taux d'utilisation des quotas par espèce
    """
    debut_mois = date.today().replace(day=1)

    # Espèces sous quota
    especes_quota = (
        db.query(Espece)
        .filter(
            Espece.statut_reglementaire == "Sous quota",
            Espece.quota_mensuel_tonnes.isnot(None),
        )
        .all()
    )

    utilisation = []
    for espece in especes_quota:
        # Captures du mois
        total_mois = (
            db.query(func.sum(DetailDebarquement.quantite_kg))
            .select_from(DetailDebarquement)
            .join(Debarquement, Debarquement.id == DetailDebarquement.debarquement_id)
            .filter(
                DetailDebarquement.espece_id == espece.id,
                Debarquement.date_debarquement >= debut_mois,
            )
            .scalar()
            or 0
        )

        total_mois_tonnes = total_mois / 1000
        quota_restant = espece.quota_mensuel_tonnes - total_mois_tonnes
        taux_utilisation = (
            (total_mois_tonnes / espece.quota_mensuel_tonnes * 100)
            if espece.quota_mensuel_tonnes > 0
            else 0
        )

        utilisation.append(
            {
                "espece": espece.nom_commun_francais,
                "code": espece.code_espece,
                "quota_mensuel_tonnes": espece.quota_mensuel_tonnes,
                "captures_tonnes": round(total_mois_tonnes, 2),
                "quota_restant_tonnes": round(max(0, quota_restant), 2),
                "taux_utilisation_pct": round(taux_utilisation, 1),
                "statut": "alerte" if taux_utilisation >= 80 else "normal",
            }
        )

    return sorted(utilisation, key=lambda x: x["taux_utilisation_pct"], reverse=True)


@router.get("/captures/yearly")
def get_evolution_captures(
    filtre: str = Query(
        "province", regex="^(province|localite|site|cooperative|metier|nationalite)$"
    ),
    annee: int = Query(2020, ge=1),
    db: Session = Depends(get_db),
):
    """
    Liste des captures par mois
    """

    # if filtre == "province":
    evolution_data = []

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
                extract("year", Debarquement.date_debarquement) == annee,
            )
        )
        .group_by("annee", "mois")
        .order_by("annee", "mois")
        .all()
    )

    periodes = [
        {
            "mois": LIST_MONTHS[int(r.mois) - 1],
            "periode": f"{int(r.annee)}-{int(r.mois):02d}",
            "nombre_debarquements": r.nombre or 0,
            "quantite_kg": float(r.quantite_kg or 0),
            "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 3),
        }
        for r in resultats
    ]

    evolution_data.append({"evolution": periodes})

    return {"evolution": periodes}


@router.get("/autorisations/province")
def get_autorisation_par_province(
    annee: int = Query(2020, ge=1), db: Session = Depends(get_db)
):
    """
    Liste des autorisations par année
    """

    # Récupérer toutes les provinces
    provinces_query = (
        db.query(Debarcadere.province)
        .filter(Debarcadere.province.isnot(None))
        .distinct()
    )

    provinces = [row[0] for row in provinces_query.all()]

    autorisation_data = []

    for prov in provinces:
        resultat = (
            db.query(
                Debarcadere.province.label("province"),
                func.count(LicenceAutorisationPeche.id).label("nombre"),
            )
            .join(
                Bateau,
                LicenceAutorisationPeche.bateau_id == Bateau.id,
            )
            .join(Debarcadere, Debarcadere.id == Bateau.site_port_attache)
            .filter(
                and_(
                    Debarcadere.province == prov,
                    LicenceAutorisationPeche.annee_validite == annee,
                )
            )
            .group_by("province")
            .order_by(desc("nombre"))
            .first()
        )

        if resultat:
            periodes = {
                "province": prov,
                "nombre_autorisations": resultat.nombre,
            }

        else:
            periodes = {
                "province": prov,
                "nombre_autorisations": 0,
            }

        autorisation_data.append(periodes)

    return {"data": autorisation_data}


@router.get("/captures/zone")
def get_captures_par_zone(
    annee: int = Query(2020, ge=1), db: Session = Depends(get_db)
):
    """
    Pourcentage des captures par zone
    """
    # evolution_data = []

    resultats = (
        db.query(
            func.lower(Debarquement.zone_peche_nom).label("zone_peche"),
            func.count(Debarquement.id).label("nombre"),
            func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
        )
        .join(
            DetailDebarquement,
            DetailDebarquement.debarquement_id == Debarquement.id,
        )
        .filter(
            and_(
                extract("year", Debarquement.date_debarquement) == annee,
            )
        )
        .group_by("zone_peche")
        .order_by(asc("zone_peche"), desc("quantite_kg"))
        .all()
    )

    periodes = [
        {
            "zone_peche": r.zone_peche,
            "nombre_debarquements": r.nombre or 0,
            "quantite_kg": float(r.quantite_kg or 0),
            "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 3),
        }
        for r in resultats
    ]

    # evolution_data.append({"evolution": periodes})

    return {"evolution": periodes}


@router.get("/productions/especes/goupes")
def get_production_par_espece_par_groupe(
    annee: int = Query(2020, ge=1), db: Session = Depends(get_db)
):
    """
    Quantité de production par groupe d'espèce
    """
    evolution_data = []

    resultats = (
        db.query(
            Espece.categorie.label("groupe"),
            func.count(Debarquement.id).label("nombre"),
            func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
        )
        .join(
            DetailDebarquement,
            DetailDebarquement.debarquement_id == Debarquement.id,
        )
        .join(Espece, Espece.id == DetailDebarquement.espece_id)
        .filter(
            and_(
                extract("year", Debarquement.date_debarquement) == annee,
            )
        )
        .group_by("groupe")
        .order_by("groupe", desc("quantite_kg"))
        .all()
    )

    periodes = [
        {
            "groupe": r.groupe,
            "nombre_debarquements": r.nombre or 0,
            "quantite_kg": float(r.quantite_kg or 0),
            "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 3),
        }
        for r in resultats
    ]

    evolution_data.append({"evolution": periodes})

    return {"evolution": periodes}


class LigneMensuelle(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mois: int
    libelle: str  # "Mai 2026"
    volume_captures_kg: float
    volume_transactions_kg: float
    # Ratio transactions/captures : indicateur d'absorption par le circuit
    # mareyage (0 si pas de captures ; > 1 si mareyeurs achètent plus que
    # ce qui a été déclaré en capture — signal d'incohérence à investiguer)
    taux_absorption: float


class StatistiquesMensuellesResponse(BaseModel):
    annee: int
    total_captures_kg: float
    total_transactions_kg: float
    total_montant_fcfa: float
    taux_absorption_global: float
    series: List[LigneMensuelle]


MOIS_FR = [
    "",
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


@router.get("/captures-mareyeurs/yearly")
def get_evolution_captures(
    annee: int = Query(2020, ge=1),
    db: Session = Depends(get_db),
):
    """
    Liste des captures par mois
    """

    # if filtre == "province":
    evolution_data = []

    q_captures = (
        db.query(
            extract("month", Debarquement.date_debarquement).label("mois"),
            func.sum(DetailDebarquement.quantite_kg).label("quantite_kg"),
        )
        .join(
            DetailDebarquement,
            DetailDebarquement.debarquement_id == Debarquement.id,
        )
        .join(Debarcadere, Debarcadere.id == Debarquement.debarcadere_id)
        .filter(
            and_(
                extract("year", Debarquement.date_debarquement) == annee,
            )
        )
        .group_by("mois")
        .order_by("mois")
        .all()
    )

    captures_par_mois: Dict[int, float] = {
        int(r.mois): float(r.quantite_kg) for r in q_captures
    }

    q_transactions = (
        db.query(
            extract("month", TransactionAchat.date_transaction).label("mois"),
            func.coalesce(func.sum(TransactionAchat.quantite_kg), 0).label(
                "quantite_kg"
            ),
        )
        .filter(
            and_(
                extract("year", TransactionAchat.date_transaction) == annee,
            )
        )
        .group_by("mois")
        .order_by("mois")
        .all()
    )

    transactions_par_mois: Dict[int, float] = {
        int(r.mois): float(r.quantite_kg) for r in q_transactions
    }

    # Construction de la série (mois à zéro inclus)
    series: List[LigneMensuelle] = []
    total_captures = total_transactions = total_montant = 0.0

    for mois in range(1, 13):
        vol_capt = captures_par_mois.get(mois, 0.0)
        vol_trx = transactions_par_mois.get(mois, 0.0)
        taux = (vol_trx / vol_capt) if vol_capt > 0 else 0.0
        series.append(
            LigneMensuelle(
                mois=mois,
                libelle=MOIS_FR[mois],
                volume_captures_kg=round(vol_capt, 2),
                volume_transactions_kg=round(vol_trx, 2),
                taux_absorption=round(taux, 4),
            )
        )
        total_captures += vol_capt
        total_transactions += vol_trx
        total_montant += 0

    taux_global = (total_transactions / total_captures) if total_captures > 0 else 0.0

    return StatistiquesMensuellesResponse(
        annee=annee,
        total_captures_kg=round(total_captures, 2),
        total_transactions_kg=round(total_transactions, 2),
        total_montant_fcfa=round(total_montant, 2),
        taux_absorption_global=round(taux_global, 4),
        series=series,
    )
