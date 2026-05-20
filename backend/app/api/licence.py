from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from typing import List, Optional
from datetime import date, timedelta
from pathlib import Path
import shutil

from app.database import get_db
from app.models.licence import (
    LicencePeche,
    InspectionLicence,
    ViolationLicence,
    RenouvellementLicence,
)
from app.schemas.licence import (
    LicencePecheCreate,
    LicencePecheUpdate,
    LicencePecheResponse,
    InspectionLicenceCreate,
    InspectionLicenceResponse,
    ViolationLicenceCreate,
    ViolationLicenceUpdate,
    ViolationLicenceResponse,
    RenouvellementLicenceCreate,
    RenouvellementLicenceTraitement,
    RenouvellementLicenceResponse,
    StatistiquesLicences,
    RapportLicence,
)
from app.models.pecheur import Pecheur

router = APIRouter(prefix="/api/licences", tags=["Licences de Pêche"])

UPLOAD_DIR = Path("uploads/licences")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ==========================================
# CRUD Licences
# ==========================================


@router.post(
    "", response_model=LicencePecheResponse, status_code=status.HTTP_201_CREATED
)
def create_licence(licence_data: LicencePecheCreate, db: Session = Depends(get_db)):
    """Créer une nouvelle licence de pêche"""

    # Vérifier unicité numéro
    existing = (
        db.query(LicencePeche)
        .filter(LicencePeche.numero_licence == licence_data.numero_licence)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Une licence avec le numéro {licence_data.numero_licence} existe déjà",
        )

    # Créer la licence
    licence = LicencePeche(**licence_data.model_dump())
    licence.statut = "active"

    db.add(licence)
    db.commit()
    db.refresh(licence)

    # Préparer la réponse
    response = LicencePecheResponse.from_orm(licence)
    response.est_active = licence.est_active()
    response.jours_avant_expiration = licence.jours_avant_expiration()
    response.necessite_renouvellement = licence.necessite_renouvellement()
    response.duree_mois = licence.calculer_duree_mois()

    # Récupérer le nom du titulaire
    if licence.pecheur_id:
        pecheur = db.query(Pecheur).get(licence.pecheur_id)
        if pecheur:
            response.nom_titulaire = f"{pecheur.nom} {pecheur.prenom}"
            response.type_titulaire = "pecheur"

    return response


@router.get("", response_model=List[LicencePecheResponse])
def get_licences(
    skip: int = 0,
    limit: int = 100,
    statut: Optional[str] = None,
    type_licence: Optional[str] = None,
    pecheur_id: Optional[int] = None,
    expiration_avant: Optional[date] = None,
    a_renouveler: bool = False,
    db: Session = Depends(get_db),
):
    """Récupérer la liste des licences avec filtres"""

    query = db.query(LicencePeche)

    # Filtres
    if statut:
        query = query.filter(LicencePeche.statut == statut)

    if type_licence:
        query = query.filter(LicencePeche.type_licence == type_licence)

    if pecheur_id:
        query = query.filter(LicencePeche.pecheur_id == pecheur_id)

    if expiration_avant:
        query = query.filter(LicencePeche.date_expiration <= expiration_avant)

    if a_renouveler:
        # Licences expirant dans 30 jours
        date_limite = date.today() + timedelta(days=30)
        query = query.filter(
            and_(
                LicencePeche.date_expiration <= date_limite,
                LicencePeche.date_expiration >= date.today(),
                LicencePeche.statut == "active",
            )
        )

    licences = query.offset(skip).limit(limit).all()

    # Enrichir les réponses
    results = []
    for licence in licences:
        response = LicencePecheResponse.from_orm(licence)
        response.est_active = licence.est_active()
        response.jours_avant_expiration = licence.jours_avant_expiration()
        response.necessite_renouvellement = licence.necessite_renouvellement()
        response.duree_mois = licence.calculer_duree_mois()

        if licence.pecheur_id:
            pecheur = db.query(Pecheur).get(licence.pecheur_id)
            if pecheur:
                response.nom_titulaire = f"{pecheur.nom} {pecheur.prenom}"
                response.type_titulaire = "pecheur"

        results.append(response)

    return results


@router.get("/{licence_id}", response_model=LicencePecheResponse)
def get_licence(licence_id: int, db: Session = Depends(get_db)):
    """Récupérer une licence par ID"""

    licence = db.query(LicencePeche).filter(LicencePeche.id == licence_id).first()

    if not licence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Licence introuvable"
        )

    response = LicencePecheResponse.from_orm(licence)
    response.est_active = licence.est_active()
    response.jours_avant_expiration = licence.jours_avant_expiration()
    response.necessite_renouvellement = licence.necessite_renouvellement()
    response.duree_mois = licence.calculer_duree_mois()

    return response


@router.put("/{licence_id}", response_model=LicencePecheResponse)
def update_licence(
    licence_id: int, licence_data: LicencePecheUpdate, db: Session = Depends(get_db)
):
    """Mettre à jour une licence"""

    licence = db.query(LicencePeche).filter(LicencePeche.id == licence_id).first()

    if not licence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Licence introuvable"
        )

    update_data = licence_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(licence, field, value)

    db.commit()
    db.refresh(licence)

    response = LicencePecheResponse.from_orm(licence)
    response.est_active = licence.est_active()
    response.jours_avant_expiration = licence.jours_avant_expiration()
    response.necessite_renouvellement = licence.necessite_renouvellement()

    return response


@router.delete("/{licence_id}")
def delete_licence(licence_id: int, db: Session = Depends(get_db)):
    """Supprimer une licence"""

    licence = db.query(LicencePeche).filter(LicencePeche.id == licence_id).first()

    if not licence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Licence introuvable"
        )

    db.delete(licence)
    db.commit()

    return {"message": f"Licence {licence.numero_licence} supprimée"}


# ==========================================
# Actions sur les licences
# ==========================================


@router.post("/{licence_id}/suspendre")
def suspendre_licence(licence_id: int, raison: str, db: Session = Depends(get_db)):
    """Suspendre une licence"""

    licence = db.query(LicencePeche).filter(LicencePeche.id == licence_id).first()

    if not licence:
        raise HTTPException(status_code=404, detail="Licence introuvable")

    licence.statut = "suspendue"
    licence.raison_suspension = raison
    licence.date_suspension = date.today()

    db.commit()

    return {"message": "Licence suspendue", "raison": raison}


@router.post("/{licence_id}/reactiver")
def reactiver_licence(licence_id: int, db: Session = Depends(get_db)):
    """Réactiver une licence suspendue"""

    licence = db.query(LicencePeche).filter(LicencePeche.id == licence_id).first()

    if not licence:
        raise HTTPException(status_code=404, detail="Licence introuvable")

    if licence.statut != "suspendue":
        raise HTTPException(status_code=400, detail="Cette licence n'est pas suspendue")

    licence.statut = "active"
    licence.raison_suspension = None
    licence.date_suspension = None

    db.commit()

    return {"message": "Licence réactivée"}


@router.post("/{licence_id}/revoquer")
def revoquer_licence(licence_id: int, raison: str, db: Session = Depends(get_db)):
    """Révoquer définitivement une licence"""

    licence = db.query(LicencePeche).filter(LicencePeche.id == licence_id).first()

    if not licence:
        raise HTTPException(status_code=404, detail="Licence introuvable")

    licence.statut = "revoquee"
    licence.raison_suspension = raison
    licence.date_suspension = date.today()
    licence.actif = False

    db.commit()

    return {"message": "Licence révoquée", "raison": raison}


# ==========================================
# Inspections
# ==========================================


@router.post("/inspections", response_model=InspectionLicenceResponse)
def create_inspection(
    inspection_data: InspectionLicenceCreate, db: Session = Depends(get_db)
):
    """Créer une inspection"""

    # Vérifier que la licence existe
    licence = db.query(LicencePeche).get(inspection_data.licence_id)
    if not licence:
        raise HTTPException(status_code=404, detail="Licence introuvable")

    inspection = InspectionLicence(**inspection_data.model_dump())

    db.add(inspection)
    db.commit()
    db.refresh(inspection)

    return inspection


@router.get("/inspections/{licence_id}", response_model=List[InspectionLicenceResponse])
def get_inspections_licence(licence_id: int, db: Session = Depends(get_db)):
    """Récupérer les inspections d'une licence"""

    inspections = (
        db.query(InspectionLicence)
        .filter(InspectionLicence.licence_id == licence_id)
        .all()
    )

    return inspections


# ==========================================
# Violations
# ==========================================


@router.post("/violations", response_model=ViolationLicenceResponse)
def create_violation(
    violation_data: ViolationLicenceCreate, db: Session = Depends(get_db)
):
    """Enregistrer une violation"""

    # Vérifier que la licence existe
    licence = db.query(LicencePeche).get(violation_data.licence_id)
    if not licence:
        raise HTTPException(status_code=404, detail="Licence introuvable")

    violation = ViolationLicence(**violation_data.model_dump())
    violation.statut = "en_cours"

    db.add(violation)

    # Si suspension, mettre à jour la licence
    if violation.type_sanction == "suspension" and violation.duree_suspension_jours:
        licence.statut = "suspendue"
        licence.raison_suspension = f"Violation: {violation.type_violation}"
        licence.date_suspension = date.today()

    db.commit()
    db.refresh(violation)

    return violation


@router.put("/violations/{violation_id}", response_model=ViolationLicenceResponse)
def update_violation(
    violation_id: int,
    violation_data: ViolationLicenceUpdate,
    db: Session = Depends(get_db),
):
    """Mettre à jour une violation"""

    violation = db.query(ViolationLicence).get(violation_id)

    if not violation:
        raise HTTPException(status_code=404, detail="Violation introuvable")

    update_data = violation_data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(violation, field, value)

    db.commit()
    db.refresh(violation)

    return violation


@router.get("/violations/{licence_id}", response_model=List[ViolationLicenceResponse])
def get_violations_licence(licence_id: int, db: Session = Depends(get_db)):
    """Récupérer les violations d'une licence"""

    violations = (
        db.query(ViolationLicence)
        .filter(ViolationLicence.licence_id == licence_id)
        .all()
    )

    return violations


# ==========================================
# Renouvellements
# ==========================================


@router.post("/renouvellements", response_model=RenouvellementLicenceResponse)
def demander_renouvellement(
    renouvellement_data: RenouvellementLicenceCreate, db: Session = Depends(get_db)
):
    """Créer une demande de renouvellement"""

    licence = db.query(LicencePeche).get(renouvellement_data.licence_actuelle_id)

    if not licence:
        raise HTTPException(status_code=404, detail="Licence introuvable")

    renouvellement = RenouvellementLicence(**renouvellement_data.model_dump())
    renouvellement.statut = "en_attente"

    db.add(renouvellement)
    db.commit()
    db.refresh(renouvellement)

    return renouvellement


@router.put("/renouvellements/{renouvellement_id}/traiter")
def traiter_renouvellement(
    renouvellement_id: int,
    traitement: RenouvellementLicenceTraitement,
    db: Session = Depends(get_db),
):
    """Traiter une demande de renouvellement"""

    renouvellement = db.query(RenouvellementLicence).get(renouvellement_id)

    if not renouvellement:
        raise HTTPException(status_code=404, detail="Demande introuvable")

    renouvellement.statut = traitement.statut
    renouvellement.date_traitement = date.today()
    renouvellement.agent_traitement = traitement.agent_traitement

    if traitement.statut == "rejete":
        renouvellement.motif_rejet = traitement.motif_rejet
        db.commit()
        return {"message": "Demande rejetée", "motif": traitement.motif_rejet}

    # Si approuvé, créer nouvelle licence
    if traitement.statut == "approuve":
        licence_actuelle = db.query(LicencePeche).get(
            renouvellement.licence_actuelle_id
        )

        # Copier les données de l'ancienne licence
        nouvelle_licence_data = {
            "numero_licence": f"{licence_actuelle.numero_licence}-R{date.today().year}",
            "type_licence": licence_actuelle.type_licence,
            "categorie": licence_actuelle.categorie,
            "pecheur_id": licence_actuelle.pecheur_id,
            "entreprise_id": licence_actuelle.entreprise_id,
            "date_emission": date.today(),
            "date_debut": traitement.nouvelle_date_debut or date.today(),
            "date_expiration": traitement.nouvelle_date_expiration
            or (date.today() + timedelta(days=365)),
            "zone_peche": licence_actuelle.zone_peche,
            "montant_paye": traitement.nouveau_montant,
            "autorite_emission": licence_actuelle.autorite_emission,
            "est_renouvellement": True,
            "licence_precedente_id": licence_actuelle.id,
        }

        nouvelle_licence = LicencePeche(**nouvelle_licence_data)
        nouvelle_licence.statut = "active"

        db.add(nouvelle_licence)
        db.flush()

        renouvellement.nouvelle_licence_id = nouvelle_licence.id

        # Marquer ancienne licence comme expirée
        licence_actuelle.statut = "expiree"

        db.commit()

        return {
            "message": "Renouvellement approuvé",
            "nouvelle_licence_id": nouvelle_licence.id,
            "numero_licence": nouvelle_licence.numero_licence,
        }


# ==========================================
# Statistiques
# ==========================================


@router.get("/statistiques", response_model=StatistiquesLicences)
def get_statistiques(db: Session = Depends(get_db)):
    """Statistiques globales sur les licences"""

    total = db.query(LicencePeche).count()
    actives = db.query(LicencePeche).filter(LicencePeche.statut == "active").count()
    expirees = db.query(LicencePeche).filter(LicencePeche.statut == "expiree").count()
    suspendues = (
        db.query(LicencePeche).filter(LicencePeche.statut == "suspendue").count()
    )
    revoquees = db.query(LicencePeche).filter(LicencePeche.statut == "revoquee").count()

    # À renouveler dans 30 jours
    date_limite = date.today() + timedelta(days=30)
    a_renouveler = (
        db.query(LicencePeche)
        .filter(
            and_(
                LicencePeche.date_expiration <= date_limite,
                LicencePeche.date_expiration >= date.today(),
                LicencePeche.statut == "active",
            )
        )
        .count()
    )

    # Par type
    par_type = {}
    types = (
        db.query(LicencePeche.type_licence, func.count(LicencePeche.id))
        .group_by(LicencePeche.type_licence)
        .all()
    )

    for type_l, count in types:
        par_type[type_l] = count

    # Par zone
    par_zone = {}
    zones = (
        db.query(LicencePeche.zone_peche, func.count(LicencePeche.id))
        .group_by(LicencePeche.zone_peche)
        .all()
    )

    for zone, count in zones:
        if zone:
            par_zone[zone] = count

    # Totaux
    total_quotas = db.query(func.sum(LicencePeche.quota_annuel_kg)).scalar() or 0

    montant_total = db.query(func.sum(LicencePeche.montant_paye)).scalar() or 0

    return StatistiquesLicences(
        total_licences=total,
        licences_actives=actives,
        licences_expirees=expirees,
        licences_suspendues=suspendues,
        licences_revoquees=revoquees,
        a_renouveler_30_jours=a_renouveler,
        par_type=par_type,
        par_zone=par_zone,
        total_quotas_kg=total_quotas,
        montant_total_percu=montant_total,
    )


@router.get("/{licence_id}/rapport", response_model=RapportLicence)
def get_rapport_licence(licence_id: int, db: Session = Depends(get_db)):
    """Rapport complet d'une licence"""

    licence = db.query(LicencePeche).get(licence_id)

    if not licence:
        raise HTTPException(status_code=404, detail="Licence introuvable")

    # Inspections
    inspections = (
        db.query(InspectionLicence)
        .filter(InspectionLicence.licence_id == licence_id)
        .all()
    )

    # Violations
    violations = (
        db.query(ViolationLicence)
        .filter(ViolationLicence.licence_id == licence_id)
        .all()
    )

    # Renouvellements
    renouvellements = (
        db.query(RenouvellementLicence)
        .filter(
            or_(
                RenouvellementLicence.licence_actuelle_id == licence_id,
                RenouvellementLicence.nouvelle_licence_id == licence_id,
            )
        )
        .all()
    )

    licence_response = LicencePecheResponse.from_orm(licence)
    licence_response.est_active = licence.est_active()
    licence_response.jours_avant_expiration = licence.jours_avant_expiration()

    return RapportLicence(
        licence=licence_response,
        inspections=inspections,
        violations=violations,
        historique_renouvellements=renouvellements,
    )
