# app/routers/mareyeur.py
# Module Mareyeurs - SIGDP-GABON
# Router FastAPI POST-only — version SYNCHRONE (sqlalchemy.orm.Session)
#
# Dépendance attendue dans app/database.py :
#
#   from sqlalchemy import create_engine
#   from sqlalchemy.orm import sessionmaker
#
#   engine = create_engine(DATABASE_URL)   # ex. postgresql+psycopg2://...
#   SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
#
#   def get_db():
#       db = SessionLocal()
#       try:
#           yield db
#       finally:
#           db.close()

from datetime import date, datetime, timedelta
from typing import Type

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from app.database import get_db  # <-- adapter selon votre projet
from app.models.mareyeur import (
    Mareyeur,
    AgrementMareyage,
    InstallationMareyage,
    TransactionAchat,
)
from app.schemas.mareyeur import (
    IdRequest,
    MareyeurCreate,
    MareyeurUpdate,
    MareyeurListFilter,
    MareyeurResponse,
    MareyeurListResponse,
    AgrementCreate,
    AgrementUpdate,
    AgrementListFilter,
    AgrementStatutRequest,
    AgrementRenouvelerRequest,
    AgrementExpirantRequest,
    AgrementResponse,
    AgrementListResponse,
    InstallationCreate,
    InstallationUpdate,
    InstallationListFilter,
    InstallationResponse,
    TransactionCreate,
    TransactionUpdate,
    TransactionListFilter,
    TransactionResponse,
    TransactionListResponse,
    StatistiquesMareyeursResponse,
)

router = APIRouter(prefix="/api/mareyeurs", tags=["Mareyeurs"])


# ---------------------------------------------------------------------------
# Utilitaires
# ---------------------------------------------------------------------------


def generer_code(db: Session, model: Type, prefixe: str) -> str:
    """Code de référence auto-généré, ex. MAR-2026-0001 (pattern module MCS)."""
    annee = datetime.now().year
    motif = f"{prefixe}-{annee}-%"
    compteur = (
        db.execute(
            select(func.count()).select_from(model).where(model.code.like(motif))
        ).scalar()
        or 0
    ) + 1
    return f"{prefixe}-{annee}-{str(compteur).zfill(4)}"


def ajouter_mois(d: date, mois: int) -> date:
    """Ajoute des mois à une date sans dépendance externe."""
    m = d.month - 1 + mois
    annee = d.year + m // 12
    mois_final = m % 12 + 1
    jour = min(
        d.day,
        [
            31,
            29 if annee % 4 == 0 and (annee % 100 != 0 or annee % 400 == 0) else 28,
            31,
            30,
            31,
            30,
            31,
            31,
            30,
            31,
            30,
            31,
        ][mois_final - 1],
    )
    return date(annee, mois_final, jour)


def verifier_expiration(db: Session, agrement: AgrementMareyage) -> None:
    """Transition automatique delivre -> expire (pattern transitions MCS)."""
    if (
        agrement.statut == "delivre"
        and agrement.date_expiration
        and agrement.date_expiration < date.today()
    ):
        agrement.statut = "expire"
        db.commit()
        db.refresh(agrement)


# ---------------------------------------------------------------------------
# MAREYEURS
# ---------------------------------------------------------------------------


@router.post("/liste", response_model=MareyeurListResponse)
def lister_mareyeurs(filtre: MareyeurListFilter, db: Session = Depends(get_db)):
    query = select(Mareyeur)

    if filtre.statut:
        query = query.where(Mareyeur.statut == filtre.statut)
    if filtre.recherche:
        terme = f"%{filtre.recherche}%"
        query = query.where(
            or_(
                Mareyeur.nom.ilike(terme),
                Mareyeur.prenom.ilike(terme),
                Mareyeur.raison_sociale.ilike(terme),
                Mareyeur.code.ilike(terme),
                Mareyeur.nif.ilike(terme),
                Mareyeur.telephone.ilike(terme),
            )
        )

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0

    query = (
        query.order_by(Mareyeur.created_at.desc())
        .offset((filtre.page - 1) * filtre.taille_page)
        .limit(filtre.taille_page)
    )
    resultats = db.execute(query).scalars().all()

    return MareyeurListResponse(
        total=total,
        page=filtre.page,
        taille_page=filtre.taille_page,
        resultats=resultats,
    )


@router.post("/details", response_model=MareyeurResponse)
def details_mareyeur(payload: IdRequest, db: Session = Depends(get_db)):
    mareyeur = db.get(Mareyeur, payload.id)
    if not mareyeur:
        raise HTTPException(status_code=404, detail="Mareyeur introuvable")
    return mareyeur


@router.post("/creer", response_model=MareyeurResponse)
def creer_mareyeur(payload: MareyeurCreate, db: Session = Depends(get_db)):
    mareyeur = Mareyeur(**payload.model_dump())
    mareyeur.code = generer_code(db, Mareyeur, "MAR")
    db.add(mareyeur)
    db.commit()
    db.refresh(mareyeur)
    return mareyeur


@router.post("/modifier", response_model=MareyeurResponse)
def modifier_mareyeur(payload: MareyeurUpdate, db: Session = Depends(get_db)):
    mareyeur = db.get(Mareyeur, payload.id)
    if not mareyeur:
        raise HTTPException(status_code=404, detail="Mareyeur introuvable")
    for champ, valeur in payload.model_dump(exclude={"id"}).items():
        setattr(mareyeur, champ, valeur)
    db.commit()
    db.refresh(mareyeur)
    return mareyeur


@router.post("/supprimer")
def supprimer_mareyeur(payload: IdRequest, db: Session = Depends(get_db)):
    mareyeur = db.get(Mareyeur, payload.id)
    if not mareyeur:
        raise HTTPException(status_code=404, detail="Mareyeur introuvable")
    db.delete(mareyeur)
    db.commit()
    return {"message": "Mareyeur supprimé avec succès"}


@router.post("/statistiques", response_model=StatistiquesMareyeursResponse)
def statistiques_mareyeurs(db: Session = Depends(get_db)):
    total = db.execute(select(func.count()).select_from(Mareyeur)).scalar() or 0

    par_statut = dict(
        db.execute(
            select(Mareyeur.statut, func.count()).group_by(Mareyeur.statut)
        ).all()
    )

    par_type = dict(
        db.execute(
            select(Mareyeur.type_personne, func.count()).group_by(
                Mareyeur.type_personne
            )
        ).all()
    )

    agrements_par_statut = dict(
        db.execute(
            select(AgrementMareyage.statut, func.count()).group_by(
                AgrementMareyage.statut
            )
        ).all()
    )

    aujourd_hui = date.today()
    expirant = (
        db.execute(
            select(func.count())
            .select_from(AgrementMareyage)
            .where(
                AgrementMareyage.statut == "delivre",
                AgrementMareyage.date_expiration.isnot(None),
                AgrementMareyage.date_expiration >= aujourd_hui,
                AgrementMareyage.date_expiration <= aujourd_hui + timedelta(days=30),
            )
        ).scalar()
        or 0
    )

    volume_total = (
        db.execute(
            select(func.coalesce(func.sum(TransactionAchat.quantite_kg), 0))
        ).scalar()
        or 0
    )

    volumes_espece = dict(
        db.execute(
            select(
                TransactionAchat.espece,
                func.coalesce(func.sum(TransactionAchat.quantite_kg), 0),
            ).group_by(TransactionAchat.espece)
        ).all()
    )

    volumes_site = dict(
        db.execute(
            select(
                func.coalesce(TransactionAchat.site_debarquement, "Non renseigné"),
                func.coalesce(func.sum(TransactionAchat.quantite_kg), 0),
            ).group_by(TransactionAchat.site_debarquement)
        ).all()
    )

    return StatistiquesMareyeursResponse(
        total_mareyeurs=total,
        par_statut=par_statut,
        par_type_personne=par_type,
        agrements_par_statut=agrements_par_statut,
        agrements_expirant_30j=expirant,
        volume_total_kg=float(volume_total),
        volumes_par_espece={k: float(v) for k, v in volumes_espece.items()},
        volumes_par_site={k: float(v) for k, v in volumes_site.items()},
    )


# ---------------------------------------------------------------------------
# AGRÉMENTS DE MAREYAGE
# ---------------------------------------------------------------------------


@router.post("/agrements/liste", response_model=AgrementListResponse)
def lister_agrements(filtre: AgrementListFilter, db: Session = Depends(get_db)):
    query = select(AgrementMareyage)
    if filtre.mareyeur_id:
        query = query.where(AgrementMareyage.mareyeur_id == filtre.mareyeur_id)
    if filtre.statut:
        query = query.where(AgrementMareyage.statut == filtre.statut)
    if filtre.categorie:
        query = query.where(AgrementMareyage.categorie == filtre.categorie)

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0

    query = (
        query.order_by(AgrementMareyage.created_at.desc())
        .offset((filtre.page - 1) * filtre.taille_page)
        .limit(filtre.taille_page)
    )
    agrements = db.execute(query).scalars().all()

    # Expiration automatique à la lecture
    for ag in agrements:
        verifier_expiration(db, ag)

    return AgrementListResponse(
        total=total,
        page=filtre.page,
        taille_page=filtre.taille_page,
        resultats=agrements,
    )


@router.post("/agrements/expirant", response_model=AgrementListResponse)
def agrements_expirant(payload: AgrementExpirantRequest, db: Session = Depends(get_db)):
    """Agréments délivrés expirant dans N jours (relances/renouvellements)."""
    limite = date.today() + timedelta(days=payload.jours)
    query = (
        select(AgrementMareyage)
        .where(
            AgrementMareyage.statut == "delivre",
            AgrementMareyage.date_expiration.isnot(None),
            AgrementMareyage.date_expiration >= date.today(),
            AgrementMareyage.date_expiration <= limite,
        )
        .order_by(AgrementMareyage.date_expiration.asc())
    )

    agrements = db.execute(query).scalars().all()
    return AgrementListResponse(
        total=len(agrements),
        page=1,
        taille_page=len(agrements) or 1,
        resultats=agrements,
    )


@router.post("/agrements/details", response_model=AgrementResponse)
def details_agrement(payload: IdRequest, db: Session = Depends(get_db)):
    agrement = db.get(AgrementMareyage, payload.id)
    if not agrement:
        raise HTTPException(status_code=404, detail="Agrément introuvable")
    verifier_expiration(db, agrement)
    return agrement


@router.post("/agrements/creer", response_model=AgrementResponse)
def creer_agrement(payload: AgrementCreate, db: Session = Depends(get_db)):
    mareyeur = db.get(Mareyeur, payload.mareyeur_id)
    if not mareyeur:
        raise HTTPException(status_code=404, detail="Mareyeur introuvable")

    agrement = AgrementMareyage(**payload.model_dump())
    agrement.code = generer_code(db, AgrementMareyage, "AGR-MAR")
    agrement.statut = "en_instruction"
    if not agrement.date_demande:
        agrement.date_demande = date.today()
    db.add(agrement)
    db.commit()
    db.refresh(agrement)
    return agrement


@router.post("/agrements/modifier", response_model=AgrementResponse)
def modifier_agrement(payload: AgrementUpdate, db: Session = Depends(get_db)):
    agrement = db.get(AgrementMareyage, payload.id)
    if not agrement:
        raise HTTPException(status_code=404, detail="Agrément introuvable")
    if agrement.statut != "en_instruction":
        raise HTTPException(
            status_code=400,
            detail="Seul un agrément en instruction peut être modifié",
        )
    for champ, valeur in payload.model_dump(exclude={"id"}, exclude_none=True).items():
        setattr(agrement, champ, valeur)
    db.commit()
    db.refresh(agrement)
    return agrement


@router.post("/agrements/delivrer", response_model=AgrementResponse)
def delivrer_agrement(payload: IdRequest, db: Session = Depends(get_db)):
    agrement = db.get(AgrementMareyage, payload.id)
    if not agrement:
        raise HTTPException(status_code=404, detail="Agrément introuvable")
    if agrement.statut != "en_instruction":
        raise HTTPException(
            status_code=400,
            detail=f"Transition impossible depuis le statut '{agrement.statut}'",
        )
    agrement.statut = "delivre"
    agrement.date_delivrance = date.today()
    agrement.date_expiration = ajouter_mois(date.today(), agrement.duree_validite_mois)
    db.commit()
    db.refresh(agrement)
    return agrement


@router.post("/agrements/suspendre", response_model=AgrementResponse)
def suspendre_agrement(payload: AgrementStatutRequest, db: Session = Depends(get_db)):
    agrement = db.get(AgrementMareyage, payload.id)
    if not agrement:
        raise HTTPException(status_code=404, detail="Agrément introuvable")
    if agrement.statut != "delivre":
        raise HTTPException(
            status_code=400, detail="Seul un agrément délivré peut être suspendu"
        )
    agrement.statut = "suspendu"
    agrement.motif_statut = payload.motif
    db.commit()
    db.refresh(agrement)
    return agrement


@router.post("/agrements/retirer", response_model=AgrementResponse)
def retirer_agrement(payload: AgrementStatutRequest, db: Session = Depends(get_db)):
    agrement = db.get(AgrementMareyage, payload.id)
    if not agrement:
        raise HTTPException(status_code=404, detail="Agrément introuvable")
    if agrement.statut not in ("delivre", "suspendu"):
        raise HTTPException(
            status_code=400,
            detail="Seul un agrément délivré ou suspendu peut être retiré",
        )
    agrement.statut = "retire"
    agrement.motif_statut = payload.motif
    db.commit()
    db.refresh(agrement)
    return agrement


@router.post("/agrements/renouveler", response_model=AgrementResponse)
def renouveler_agrement(
    payload: AgrementRenouvelerRequest, db: Session = Depends(get_db)
):
    """Crée un nouvel agrément délivré immédiatement, chaîné à l'ancien."""
    ancien = db.get(AgrementMareyage, payload.id)
    if not ancien:
        raise HTTPException(status_code=404, detail="Agrément introuvable")
    if ancien.statut not in ("delivre", "expire"):
        raise HTTPException(
            status_code=400,
            detail="Seul un agrément délivré ou expiré peut être renouvelé",
        )

    if ancien.statut == "delivre":
        ancien.statut = "expire"
        ancien.motif_statut = "Renouvellement anticipé"

    nouveau = AgrementMareyage(
        code=generer_code(db, AgrementMareyage, "AGR-MAR"),
        mareyeur_id=ancien.mareyeur_id,
        categorie=ancien.categorie,
        date_demande=date.today(),
        date_delivrance=date.today(),
        duree_validite_mois=payload.duree_validite_mois,
        date_expiration=ajouter_mois(date.today(), payload.duree_validite_mois),
        montant_redevance=payload.montant_redevance,
        statut="delivre",
        renouvele_de_id=ancien.id,
    )
    db.add(nouveau)
    db.commit()
    db.refresh(nouveau)
    return nouveau


@router.post("/agrements/supprimer")
def supprimer_agrement(payload: IdRequest, db: Session = Depends(get_db)):
    agrement = db.get(AgrementMareyage, payload.id)
    if not agrement:
        raise HTTPException(status_code=404, detail="Agrément introuvable")
    if agrement.statut != "en_instruction":
        raise HTTPException(
            status_code=400,
            detail="Seul un agrément en instruction peut être supprimé",
        )
    db.delete(agrement)
    db.commit()
    return {"message": "Agrément supprimé avec succès"}


# ---------------------------------------------------------------------------
# INSTALLATIONS
# ---------------------------------------------------------------------------


@router.post("/installations/liste", response_model=list[InstallationResponse])
def lister_installations(filtre: InstallationListFilter, db: Session = Depends(get_db)):
    query = select(InstallationMareyage)
    if filtre.mareyeur_id:
        query = query.where(InstallationMareyage.mareyeur_id == filtre.mareyeur_id)
    if filtre.type_installation:
        query = query.where(
            InstallationMareyage.type_installation == filtre.type_installation
        )
    return db.execute(query.order_by(InstallationMareyage.id)).scalars().all()


@router.post("/installations/creer", response_model=InstallationResponse)
def creer_installation(payload: InstallationCreate, db: Session = Depends(get_db)):
    if not db.get(Mareyeur, payload.mareyeur_id):
        raise HTTPException(status_code=404, detail="Mareyeur introuvable")
    installation = InstallationMareyage(**payload.model_dump())
    db.add(installation)
    db.commit()
    db.refresh(installation)
    return installation


@router.post("/installations/modifier", response_model=InstallationResponse)
def modifier_installation(payload: InstallationUpdate, db: Session = Depends(get_db)):
    installation = db.get(InstallationMareyage, payload.id)
    if not installation:
        raise HTTPException(status_code=404, detail="Installation introuvable")
    for champ, valeur in payload.model_dump(exclude={"id"}).items():
        setattr(installation, champ, valeur)
    db.commit()
    db.refresh(installation)
    return installation


@router.post("/installations/supprimer")
def supprimer_installation(payload: IdRequest, db: Session = Depends(get_db)):
    installation = db.get(InstallationMareyage, payload.id)
    if not installation:
        raise HTTPException(status_code=404, detail="Installation introuvable")
    db.delete(installation)
    db.commit()
    return {"message": "Installation supprimée avec succès"}


# ---------------------------------------------------------------------------
# TRANSACTIONS D'ACHAT (traçabilité)
# ---------------------------------------------------------------------------


@router.post("/transactions/liste", response_model=TransactionListResponse)
def lister_transactions(filtre: TransactionListFilter, db: Session = Depends(get_db)):
    query = select(TransactionAchat)
    if filtre.mareyeur_id:
        query = query.where(TransactionAchat.mareyeur_id == filtre.mareyeur_id)
    if filtre.espece:
        query = query.where(TransactionAchat.espece.ilike(f"%{filtre.espece}%"))
    if filtre.date_debut:
        query = query.where(TransactionAchat.date_transaction >= filtre.date_debut)
    if filtre.date_fin:
        query = query.where(TransactionAchat.date_transaction <= filtre.date_fin)

    total = db.execute(select(func.count()).select_from(query.subquery())).scalar() or 0

    query = (
        query.order_by(TransactionAchat.date_transaction.desc())
        .offset((filtre.page - 1) * filtre.taille_page)
        .limit(filtre.taille_page)
    )
    transactions = db.execute(query).scalars().all()

    return TransactionListResponse(
        total=total,
        page=filtre.page,
        taille_page=filtre.taille_page,
        resultats=transactions,
    )


@router.post("/transactions/creer", response_model=TransactionResponse)
def creer_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    if not db.get(Mareyeur, payload.mareyeur_id):
        raise HTTPException(status_code=404, detail="Mareyeur introuvable")

    transaction = TransactionAchat(**payload.model_dump())
    transaction.code = generer_code(db, TransactionAchat, "TRX-MAR")
    if transaction.prix_unitaire_fcfa is not None:
        transaction.montant_total_fcfa = round(
            transaction.quantite_kg * transaction.prix_unitaire_fcfa, 2
        )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


@router.post("/transactions/modifier", response_model=TransactionResponse)
def modifier_transaction(payload: TransactionUpdate, db: Session = Depends(get_db)):
    transaction = db.get(TransactionAchat, payload.id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    for champ, valeur in payload.model_dump(exclude={"id"}).items():
        setattr(transaction, champ, valeur)
    if transaction.prix_unitaire_fcfa is not None:
        transaction.montant_total_fcfa = round(
            transaction.quantite_kg * transaction.prix_unitaire_fcfa, 2
        )
    db.commit()
    db.refresh(transaction)
    return transaction


@router.post("/transactions/supprimer")
def supprimer_transaction(payload: IdRequest, db: Session = Depends(get_db)):
    transaction = db.get(TransactionAchat, payload.id)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    db.delete(transaction)
    db.commit()
    return {"message": "Transaction supprimée avec succès"}
