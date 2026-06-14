from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, cast, Integer

from typing import List, Optional
from datetime import date, timedelta
from pathlib import Path
import shutil
import io
import pandas as pd

from app.database import get_db
from app.models.licence import (
    LicenceAutorisationPeche,
)
from app.schemas.licence import (
    LicencePecheCreate,
    LicencePecheUpdate,
    LicencePecheResponse,
    LicencePecheSimpleResponse,
    LicencePecheInDB,
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
from app.models.bateau import Bateau
from app.api.bateaux import get_bateau

router = APIRouter(prefix="/api/licences", tags=["Licences de Pêche"])

UPLOAD_DIR = Path("uploads/licences")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ==========================================
# CRUD Licences
# ==========================================


def get_next_reference(db: Session = Depends(get_db)) -> str:

    # Récupérer la dernière commande de l'année courante
    last_data = (
        db.query(LicenceAutorisationPeche)
        .order_by(cast(LicenceAutorisationPeche.numero_licence, Integer).desc())
        .first()
    )

    if not last_data:
        # Première commande de l'année
        next_ref = 1
    else:
        next_ref = int(last_data.numero_licence) + 1

    return str(next_ref)


@router.post("/upload-excel")
async def upload_licence_autorisation_excel(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """
    Télécharge un fichier Excel contenant les données des licences et autorisations de pêche et les insère dans la base de données.

    Format attendu du fichier Excel:
    - denomination: Dénomination de l'armement ou de la coopérative
    - sigle: Sigle de l'armement ou de la coopérative
    - localite: Localité de l'armement ou de la coopérative
    - province: Province de l'armement ou de la coopérative
    - date_creation: Date de création de l'armement ou de la coopérative
    - siege: Siège de l'armement ou de la coopérative
    - adresse: Adresse de l'armement ou de la coopérative
    - telephone: Numéro de téléphone de l'armement ou de la coopérative
    - email: Adresse email de l'armement ou de la coopérative
    - type: Type de l'armement ou de la coopérative
    """

    # Vérifier l'extension du fichier
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Le fichier doit être au format Excel (.xlsx ou .xls)",
        )

    try:
        # Lire le fichier Excel avec pandas
        contents = await file.read()
        excel_file = io.BytesIO(contents)
        engine = "openpyxl" if file.filename.endswith(".xlsx") else "xlrd"
        df = pd.read_excel(excel_file, engine=engine)

        # Valider les colonnes requises
        required_columns = {
            "nom_proprietaire",
            "prenom_proprietaire",
            "immatriculation",
            # "localite",
            # "province",
            # "date_creation",
            # "siege",
            # "adresse",
            # "telephone",
            # "email",
            # "type",
        }
        if not required_columns.issubset(df.columns):
            raise HTTPException(
                status_code=400,
                detail=f"Le fichier Excel doit contenir les colonnes suivantes: {', '.join(required_columns)}",
            )

        # Nettoyer les données
        df = df.fillna("")  # Remplacer NaN par chaîne vide

        # Statistiques d'import
        total_rows = len(df)
        inserted_count = 0
        updated_count = 0
        errors = []

        # Insérer les données dans la base de données
        for _, row in df.iterrows():

            proprietaire = (
                db.query(Pecheur)
                .filter(
                    Pecheur.nom.ilike(f"%{row['nom_proprietaire'].strip().lower()}%"),
                    Pecheur.prenom.ilike(
                        f"%{row['prenom_proprietaire'].strip().lower()}%"
                    ),
                )
                .first()
            )
            bateau = (
                db.query(Bateau)
                .filter(
                    Bateau.numero_immatriculation.ilike(
                        f"%{row['immatriculation'].strip()}%"
                    )
                )
                .first()
            )

            try:
                # Créer une nouvelle entrée
                new_entry = LicenceAutorisationPeche(
                    numero_licence=row["numero_autorisation"],
                    type_licence=row["type_licence"],
                    # categorie=row["categorie"],
                    pecheur_id=proprietaire.id if proprietaire else None,
                    annee_validite=row["annee_validite"],
                    # date_emission=row["date_emission"],
                    date_debut=row["date_debut"],
                    date_expiration=row["date_fin"],
                    # zone_peche=row["zone_peche"],
                    # coordonnees_zone=row["coordonnees_zone"],
                    # types_peche_autorises=row["types_peche_autorises"],
                    # especes_autorisees=row["especes_autorisees"],
                    # quota_annuel_kg=row["quota_annuel_kg"],
                    # taille_minimale_maille=row["taille_minimale_maille"],
                    # profondeur_max_metres=row["profondeur_max_metres"],
                    bateau_id=bateau.id if bateau else None,
                    # nombre_embarcations_max=row["nombre_embarcations_max"],
                    # nombre_pecheurs_max=row["nombre_pecheurs_max"],
                    # montant_paye=row["montant_paye"],
                    # mode_paiement=row["mode_paiement"],
                    # reference_paiement=row["reference_paiement"],
                    # statut=row["statut"],
                    # raison_suspension=row["raison_suspension"],
                    # date_suspension=row["date_suspension"],
                )
                db.add(new_entry)
                db.commit()
            except Exception as e:
                errors.append(
                    f"Erreur pour {row['type_licence']} ({row['nom_proprietaire']}): {str(e)}"
                )

        return {"message": "Fichier Excel traité avec succès", "errors": errors}

    except pd.errors.EmptyDataError:
        raise HTTPException(
            status_code=400, detail="Le fichier Excel est vide ou mal formaté"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Erreur lors du traitement du fichier: {str(e)}"
        )


def build_licence_response(
    licence: LicenceAutorisationPeche, db: Session
) -> LicencePecheResponse:
    nom_titulaire = None
    type_titulaire = None
    bateau_info = {}
    proprietaire_info = {}
    if licence.pecheur_id:
        pecheur = db.query(Pecheur).filter(Pecheur.id == licence.pecheur_id).first()
        if pecheur:
            nom_titulaire = f"{pecheur.prenom} {pecheur.nom}"
            type_titulaire = "pecheur"
            proprietaire_info = {
                "nom": pecheur.nom,
                "prenom": pecheur.prenom,
                "date_naissance": pecheur.date_naissance,
                "lieu_naissance": pecheur.lieu_naissance,
                "nationalite": pecheur.nationalite,
                "adresse": pecheur.adresse,
                "telephone": pecheur.telephone,
                "email": pecheur.email,
                "type_piece_identite": pecheur.type_carte,
                "numero_piece_identite": pecheur.numero_piece_identite,
            }

    if licence.bateau_id:
        bateau = get_bateau(licence.bateau_id, db)
        if bateau:
            bateau_info = {
                "nom": bateau.nom_bateau,
                "immatriculation": bateau.numero_immatriculation,
                "type_bateau": bateau.materiau_coque,
                "moteur_marque": bateau.moteur_marque,
                "moteur_puissance_cv": bateau.moteur_puissance_cv,
                "site_port_attache": bateau.site_port_attache_info,
                "site_obligatoire": bateau.site_obligatoire_info,
                "cooperative": bateau.cooperative_armement_info,
            }

    # Calculer AVANT model_validate
    licence_dict = {
        col.name: getattr(licence, col.name) for col in licence.__table__.columns
    }
    licence_dict["est_active"] = licence.est_active()
    licence_dict["jours_restants"] = licence.jours_avant_expiration()
    licence_dict["a_renouveler"] = licence.necessite_renouvellement()
    licence_dict["duree_mois"] = licence.calculer_duree_mois()
    licence_dict["nom_titulaire"] = nom_titulaire
    licence_dict["type_titulaire"] = type_titulaire
    licence_dict["bateau_info"] = bateau_info
    licence_dict["proprietaire_info"] = proprietaire_info
    return LicencePecheResponse(**licence_dict)


@router.get("")
def get_licences(
    skip: int = 0,
    limit: int = 500,
    statut: Optional[str] = None,
    type_licence: Optional[str] = None,
    pecheur_id: Optional[int] = None,
    expiration_avant: Optional[date] = None,
    a_renouveler: bool = False,
    db: Session = Depends(get_db),
):
    """Récupérer la liste des licences avec filtres"""

    query = db.query(LicenceAutorisationPeche).order_by(
        cast(LicenceAutorisationPeche.numero_licence, Integer).desc()
    )

    # Filtres
    if statut:
        query = query.filter(LicenceAutorisationPeche.statut == statut)

    if type_licence:
        query = query.filter(LicenceAutorisationPeche.type_licence == type_licence)

    if pecheur_id:
        query = query.filter(LicenceAutorisationPeche.pecheur_id == pecheur_id)

    if expiration_avant:
        query = query.filter(
            LicenceAutorisationPeche.date_expiration <= expiration_avant
        )

    if a_renouveler:
        # Licences expirant dans 30 jours
        date_limite = date.today() + timedelta(days=30)
        query = query.filter(
            and_(
                LicenceAutorisationPeche.date_expiration <= date_limite,
                LicenceAutorisationPeche.date_expiration >= date.today(),
                LicenceAutorisationPeche.statut == "active",
            )
        )

    licences = query.offset(skip).limit(limit).all()

    # ✅ COMPTER LE TOTAL (AVANT PAGINATION)
    total = query.count()

    # Enrichir les réponses
    results = [build_licence_response(l, db) for l in licences]

    return {"result": results, "total": total}


@router.get("/{licence_id}", response_model=LicencePecheResponse)
def get_licence(licence_id: int, db: Session = Depends(get_db)):
    """Récupérer une licence par ID"""
    licence = (
        db.query(LicenceAutorisationPeche)
        .filter(LicenceAutorisationPeche.id == licence_id)
        .first()
    )
    if not licence:
        raise HTTPException(status_code=404, detail="Licence non trouvée")
    return build_licence_response(licence, db)


@router.get(
    "/bateau/{bateau_id}",
)
def get_licence_by_boat(bateau_id: int, db: Session = Depends(get_db)):
    """Récupérer une licence par ID du bateau"""
    licences = (
        db.query(LicenceAutorisationPeche)
        .filter(LicenceAutorisationPeche.bateau_id == bateau_id)
        .all()
    )

    result = []
    for licence in licences:
        result.append(
            {
                "id": licence.id,
                "numero_licence": licence.numero_licence,
                "annee": licence.annee_validite,
                "date_emission": licence.date_emission,
                "montant": licence.montant_paye,
                "est_active": licence.est_active(),
                "jours_restants": licence.jours_avant_expiration(),
            }
        )
    return result


@router.post(
    "", response_model=LicencePecheResponse, status_code=status.HTTP_201_CREATED
)
def create_licence(licence_data: LicencePecheCreate, db: Session = Depends(get_db)):
    """Créer une nouvelle licence de pêche"""

    # Vérifier unicité numéro
    # existing = (
    #     db.query(LicenceAutorisationPeche)
    #     .filter(LicenceAutorisationPeche.numero_licence == licence_data.numero_licence)
    #     .first()
    # )

    # if existing:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail=f"Une licence avec le numéro {licence_data.numero_licence} existe déjà",
    #     )

    licence_data.numero_licence = str(get_next_reference(db))

    # Créer la licence
    licence = LicenceAutorisationPeche(**licence_data.model_dump())
    licence.statut = "active"

    db.add(licence)
    db.commit()
    db.refresh(licence)

    # Préparer la réponse
    return build_licence_response(licence, db)
