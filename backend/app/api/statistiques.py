from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import Optional
from datetime import date, datetime, timedelta

from app.database import get_db
from app.models.debarquement import Debarquement, DetailDebarquement
from app.models.debarcadere import Debarcadere
from app.models.pecheur import Pecheur
from app.models.bateau import Bateau
from app.models.espece import Espece

router = APIRouter(prefix="/api/statistiques", tags=["Statistiques"])


@router.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Statistiques pour le tableau de bord principal
    """
    # Statistiques globales
    total_debarcaderes = db.query(Debarcadere).filter(Debarcadere.statut_operationnel == "Actif").count()
    total_pecheurs = db.query(Pecheur).filter(Pecheur.statut == "Actif").count()
    total_bateaux = db.query(Bateau).filter(Bateau.statut == "Actif").count()
    
    # Débarquements du mois en cours
    debut_mois = date.today().replace(day=1)
    debarquements_mois = db.query(Debarquement).filter(
        Debarquement.date_debarquement >= debut_mois
    ).count()
    
    # Captures du mois
    details_mois = db.query(
        func.sum(DetailDebarquement.quantite_kg).label('total_kg'),
        func.sum(DetailDebarquement.valeur_totale).label('total_valeur')
    ).join(Debarquement).filter(
        Debarquement.date_debarquement >= debut_mois
    ).first()
    
    total_kg_mois = details_mois.total_kg or 0
    total_valeur_mois = details_mois.total_valeur or 0
    
    # Alertes actives
    alertes_actives = db.query(Debarquement).filter(
        (Debarquement.alerte_espece_protegee == True) |
        (Debarquement.alerte_quota_depasse == True) |
        (Debarquement.alerte_taille_illegale == True) |
        (Debarquement.alerte_bateau_non_conforme == True)
    ).filter(
        Debarquement.date_debarquement >= debut_mois
    ).count()
    
    # Licences expirées ou à renouveler (dans les 30 jours)
    date_limite = date.today() + timedelta(days=30)
    licences_a_renouveler = db.query(Pecheur).filter(
        Pecheur.licence_date_expiration <= date_limite,
        Pecheur.statut == "Actif"
    ).count()
    
    return {
        "globaux": {
            "debarcaderes_actifs": total_debarcaderes,
            "pecheurs_actifs": total_pecheurs,
            "bateaux_actifs": total_bateaux,
            "debarquements_mois": debarquements_mois
        },
        "captures_mois": {
            "quantite_kg": round(total_kg_mois, 2),
            "quantite_tonnes": round(total_kg_mois / 1000, 2),
            "valeur_fcfa": round(total_valeur_mois, 2)
        },
        "alertes": {
            "actives_mois": alertes_actives,
            "licences_a_renouveler": licences_a_renouveler
        }
    }


@router.get("/debarquements/evolution")
def get_evolution_debarquements(
    periode: str = Query("mois", regex="^(jour|semaine|mois|annee)$"),
    limite: int = Query(12, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """
    Évolution des débarquements dans le temps
    """
    if periode == "mois":
        # Grouper par mois
        resultats = db.query(
            extract('year', Debarquement.date_debarquement).label('annee'),
            extract('month', Debarquement.date_debarquement).label('mois'),
            func.count(Debarquement.id).label('nombre'),
            func.sum(DetailDebarquement.quantite_kg).label('quantite_kg')
        ).select_from(Debarquement)\
        .join(DetailDebarquement, DetailDebarquement.debarquement_id == Debarquement.id)\
        .group_by(
            'annee', 'mois'
        ).order_by(
            'annee', 'mois'
        ).limit(limite).all()
        
        evolution = []
        for r in resultats:
            evolution.append({
                "periode": f"{int(r.annee)}-{int(r.mois):02d}",
                "nombre_debarquements": r.nombre,
                "quantite_kg": float(r.quantite_kg or 0),
                "quantite_tonnes": round(float(r.quantite_kg or 0) / 1000, 2)
            })
        
        return evolution
    
    return []


@router.get("/especes/top")
def get_top_especes(
    limite: int = Query(10, ge=1, le=50),
    date_debut: Optional[date] = None,
    date_fin: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    Top des espèces les plus capturées
    """
    query = db.query(
        Espece.nom_commun_francais,
        Espece.code_espece,
        func.sum(DetailDebarquement.quantite_kg).label('total_kg'),
        func.sum(DetailDebarquement.valeur_totale).label('total_valeur'),
        func.count(DetailDebarquement.id).label('nb_captures')
    ).select_from(Espece)\
    .join(DetailDebarquement, DetailDebarquement.espece_id == Espece.id)\
    .join(Debarquement, Debarquement.id == DetailDebarquement.debarquement_id)
    
    if date_debut:
        query = query.filter(Debarquement.date_debarquement >= date_debut)
    if date_fin:
        query = query.filter(Debarquement.date_debarquement <= date_fin)
    
    resultats = query.group_by(
        Espece.id, Espece.nom_commun_francais, Espece.code_espece
    ).order_by(
        func.sum(DetailDebarquement.quantite_kg).desc()
    ).limit(limite).all()
    
    top_especes = []
    for r in resultats:
        top_especes.append({
            "nom": r.nom_commun_francais,
            "code": r.code_espece,
            "quantite_kg": round(float(r.total_kg or 0), 2),
            "quantite_tonnes": round(float(r.total_kg or 0) / 1000, 2),
            "valeur_fcfa": round(float(r.total_valeur or 0), 2),
            "nb_captures": r.nb_captures
        })
    
    return top_especes


@router.get("/debarcaderes/activite")
def get_activite_debarcaderes(
    limite: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Classement des débarcadères par activité
    """
    resultats = db.query(
        Debarcadere.denomination,
        Debarcadere.code,
        Debarcadere.province,
        func.count(Debarquement.id).label('nb_debarquements'),
        func.sum(DetailDebarquement.quantite_kg).label('total_kg')
    ).select_from(Debarcadere)\
    .join(Debarquement, Debarquement.debarcadere_id == Debarcadere.id)\
    .join(DetailDebarquement, DetailDebarquement.debarquement_id == Debarquement.id)\
    .group_by(
        Debarcadere.id, Debarcadere.denomination, Debarcadere.code, Debarcadere.province
    ).order_by(
        func.count(Debarquement.id).desc()
    ).limit(limite).all()
    
    classement = []
    for r in resultats:
        classement.append({
            "debarcadere": r.denomination,
            "code": r.code,
            "province": r.province,
            "nb_debarquements": r.nb_debarquements,
            "quantite_kg": round(float(r.total_kg or 0), 2),
            "quantite_tonnes": round(float(r.total_kg or 0) / 1000, 2)
        })
    
    return classement


@router.get("/pecheurs/top")
def get_top_pecheurs(
    limite: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """
    Top des pêcheurs par quantité capturée
    """
    resultats = db.query(
        Pecheur.nom,
        Pecheur.prenom,
        Pecheur.numero_carte,
        func.count(Debarquement.id).label('nb_sorties'),
        func.sum(DetailDebarquement.quantite_kg).label('total_kg')
    ).select_from(Pecheur)\
    .join(Debarquement, Debarquement.pecheur_principal_id == Pecheur.id)\
    .join(DetailDebarquement, DetailDebarquement.debarquement_id == Debarquement.id)\
    .group_by(
        Pecheur.id, Pecheur.nom, Pecheur.prenom, Pecheur.numero_carte
    ).order_by(
        func.sum(DetailDebarquement.quantite_kg).desc()
    ).limit(limite).all()
    
    top_pecheurs = []
    for r in resultats:
        top_pecheurs.append({
            "nom": f"{r.nom} {r.prenom}",
            "numero_carte": r.numero_carte,
            "nb_sorties": r.nb_sorties,
            "quantite_kg": round(float(r.total_kg or 0), 2),
            "quantite_tonnes": round(float(r.total_kg or 0) / 1000, 2)
        })
    
    return top_pecheurs


@router.get("/valeur/mensuelle")
def get_valeur_mensuelle(db: Session = Depends(get_db)):
    """
    Valeur des captures par mois
    """
    resultats = db.query(
        extract('year', Debarquement.date_debarquement).label('annee'),
        extract('month', Debarquement.date_debarquement).label('mois'),
        func.sum(DetailDebarquement.valeur_totale).label('valeur')
    ).select_from(Debarquement)\
    .join(DetailDebarquement, DetailDebarquement.debarquement_id == Debarquement.id)\
    .group_by(
        'annee', 'mois'
    ).order_by(
        'annee', 'mois'
    ).limit(12).all()
    
    valeurs = []
    for r in resultats:
        valeurs.append({
            "periode": f"{int(r.annee)}-{int(r.mois):02d}",
            "valeur_fcfa": round(float(r.valeur or 0), 2)
        })
    
    return valeurs


@router.get("/quotas/utilisation")
def get_utilisation_quotas(db: Session = Depends(get_db)):
    """
    Taux d'utilisation des quotas par espèce
    """
    debut_mois = date.today().replace(day=1)
    
    # Espèces sous quota
    especes_quota = db.query(Espece).filter(
        Espece.statut_reglementaire == "Sous quota",
        Espece.quota_mensuel_tonnes.isnot(None)
    ).all()
    
    utilisation = []
    for espece in especes_quota:
        # Captures du mois
        total_mois = db.query(func.sum(DetailDebarquement.quantite_kg))\
            .select_from(DetailDebarquement)\
            .join(Debarquement, Debarquement.id == DetailDebarquement.debarquement_id)\
            .filter(
                DetailDebarquement.espece_id == espece.id,
                Debarquement.date_debarquement >= debut_mois
            ).scalar() or 0
        
        total_mois_tonnes = total_mois / 1000
        quota_restant = espece.quota_mensuel_tonnes - total_mois_tonnes
        taux_utilisation = (total_mois_tonnes / espece.quota_mensuel_tonnes * 100) if espece.quota_mensuel_tonnes > 0 else 0
        
        utilisation.append({
            "espece": espece.nom_commun_francais,
            "code": espece.code_espece,
            "quota_mensuel_tonnes": espece.quota_mensuel_tonnes,
            "captures_tonnes": round(total_mois_tonnes, 2),
            "quota_restant_tonnes": round(max(0, quota_restant), 2),
            "taux_utilisation_pct": round(taux_utilisation, 1),
            "statut": "alerte" if taux_utilisation >= 80 else "normal"
        })
    
    return sorted(utilisation, key=lambda x: x['taux_utilisation_pct'], reverse=True)
