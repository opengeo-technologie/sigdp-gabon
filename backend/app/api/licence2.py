import os

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import extract, func, and_, or_, cast, Integer

from typing import List, Optional
from datetime import date, timedelta
from pathlib import Path
import shutil
import io
import pandas as pd

from app.database import get_db
from app.models.licence import (
    LicenceAutorisationPeche,
    RoleSignataire,
    SignataireLicence,
    Signataire,
)
from app.schemas.licence import (
    LicencePecheCreate,
    LicencePecheUpdate,
    LicencePecheResponse,
    SignataireLicenceCreate,
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
from app.models.espece import Espece

from app.api.signataire import get_signataire, get_signataire_by_role
from app.models.debarquement import DetailDebarquement, Debarquement

router = APIRouter(prefix="/api/licences", tags=["Licences de Pêche"])

UPLOAD_DIR = Path("uploads/licences")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Configuration upload
ERRORS_DIR = Path("errors/licences")
ERRORS_DIR.mkdir(parents=True, exist_ok=True)

ERROR_FILE = ERRORS_DIR / "errors.xlsx"


# ==========================================
# CRUD Licences
# ==========================================


def get_next_reference(annee_validite: int, db: Session = Depends(get_db)) -> str:

    # Récupérer la dernière commande de l'année courante
    last_data = (
        db.query(LicenceAutorisationPeche)
        .filter(LicenceAutorisationPeche.annee_validite == annee_validite)
        .order_by(
            cast(
                func.split_part(LicenceAutorisationPeche.numero_licence, "/", 1),
                Integer,
            ).desc()
        )
        .first()
    )

    if not last_data:
        # Première commande de l'année
        next_ref = 1
    else:
        split_numero_licence = last_data.numero_licence.split("/")
        next_ref = int(split_numero_licence[0]) + 1

    return str(next_ref) + "/" + str(annee_validite)


def save_errors(errors: list[dict], header: list[str]):
    new_df = pd.DataFrame(errors)
    new_df = (
        new_df[header + ["error_message"]]
        if all(h in new_df.columns for h in header)
        else new_df
    )

    if os.path.exists(ERROR_FILE):
        existing_df = pd.read_excel(ERROR_FILE)
        final_df = pd.concat([existing_df, new_df], ignore_index=True)
    else:
        final_df = new_df

    final_df.to_excel(ERROR_FILE, index=False, header=True)


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
                    and_(
                        func.lower(func.trim(Pecheur.nom))
                        == str(row["nom_proprietaire"]).strip().lower(),
                        func.lower(func.trim(Pecheur.prenom))
                        == str(row["prenom_proprietaire"]).strip().lower(),
                    ),
                )
                .first()
            )
            bateau = (
                db.query(Bateau)
                .filter(Bateau.numero_immatriculation == row["immatriculation"].strip())
                .first()
            )

            signataire = get_signataire_by_role(
                True, str(row["signataire"].strip()), db
            )

            especes = row["espece1"].split("/")
            especes2 = row["espece2"].split("/")
            list_espece_id = []
            for item in especes:
                espece = (
                    db.query(Espece)
                    .filter(
                        func.lower(func.trim(Espece.nom_commun_francais))
                        == item.strip().lower()
                    )
                    .first()
                )
                if espece:
                    list_espece_id.append(espece.id)

            list_espece_id2 = []
            for item in especes2:
                espece = (
                    db.query(Espece)
                    .filter(
                        func.lower(func.trim(Espece.nom_commun_francais))
                        == item.strip().lower()
                    )
                    .first()
                )
                if espece:
                    list_espece_id2.append(espece.id)

            try:
                # Créer une nouvelle entrée
                new_entry = LicenceAutorisationPeche(
                    numero_licence=str(int(row["numero_autorisation"]))
                    + "/"
                    + str(row["annee_validite"]),
                    type_licence=row["type_licence"],
                    # categorie=row["categorie"],
                    pecheur_id=proprietaire.id if proprietaire else None,
                    annee_validite=row["annee_validite"],
                    date_debut=row["date_debut"],
                    date_expiration=row["date_fin"],
                    date_emission=row["date_debut"],
                    autorite_emission="MMPEB - DGPA",
                    # coordonnees_zone=row["coordonnees_zone"],
                    # types_peche_autorises=row["types_peche_autorises"],
                    especes_autorisees=",".join(str(s) for s in list_espece_id),
                    autres_especes=",".join(str(s) for s in list_espece_id2),
                    # quota_annuel_kg=row["quota_annuel_kg"],
                    # taille_minimale_maille=row["taille_minimale_maille"],
                    # profondeur_max_metres=row["profondeur_max_metres"],
                    bateau_id=bateau.id if bateau else None,
                    # nombre_embarcations_max=row["nombre_embarcations_max"],
                    # nombre_pecheurs_max=row["nombre_pecheurs_max"],
                    montant_paye=row["montant_paye"],
                    mode_paiement=row["mode_paiement"],
                    reference_paiement=row["reference_paiement"],
                    signataire_id=signataire.id if signataire else None,
                    pour_ordre=row["pour_ordre"],
                    # statut=row["statut"],
                    # raison_suspension=row["raison_suspension"],
                    # date_suspension=row["date_suspension"],
                )
                db.add(new_entry)
                db.commit()
                inserted_count += 1
            except Exception as e:
                db.rollback()
                error_row = row.to_dict()
                error_row["error_message"] = str(e)
                errors.append(error_row)

        header = df.columns.tolist()
        if errors:
            save_errors(errors, header)

        return {
            "Total treated without errors": len(df) - len(errors),
            "inserted": inserted_count,
            "failed": len(errors),
            "error_file": ERROR_FILE if errors else None,
        }

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
                "engin_peche_principal": bateau.engin_peche1,
                "engin_peche_secondaire": bateau.engin_peche2,
            }

    if licence.signataire_id:
        signataire = (
            db.query(Signataire).filter(Signataire.id == licence.signataire_id).first()
        )
        role = (
            db.query(RoleSignataire)
            .filter(RoleSignataire.id == signataire.role_id)
            .first()
        )
        signataire_info = {
            "id": signataire.id,
            "nom_complet": signataire.nom_complet,
            "organisme": signataire.organisme,
            "contact_email": signataire.contact_email,
            "contact_telephone": signataire.contact_telephone,
            "is_actif": signataire.is_actif,
            "role": {
                "id": role.id,
                "nom_role": role.nom_role,
                "abbreviation": role.abbreviation,
                "description": role.description,
            },
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
    licence_dict["signataire_info"] = signataire_info

    if licence.especes_autorisees:
        especes_autorisees = licence.especes_autorisees.split(",")
        list_espece = []
        for espece in especes_autorisees:
            data_espece = db.query(Espece).filter(Espece.id == espece).first()
            result = {
                "nom_commun": data_espece.nom_commun_francais,
                "nom_scientifique": data_espece.nom_scientifique,
                "categorie": data_espece.categorie,
                "famille": data_espece.famille,
            }
            list_espece.append(result)
        licence_dict["espece1"] = list_espece

    if licence.autres_especes:
        autres_especes = licence.autres_especes.split(",")
        list_espece = []
        for espece in autres_especes:
            data_espece = db.query(Espece).filter(Espece.id == espece).first()
            result = {
                "nom_commun": data_espece.nom_commun_francais,
                "nom_scientifique": data_espece.nom_scientifique,
                "categorie": data_espece.categorie,
                "famille": data_espece.famille,
            }
            list_espece.append(result)
        licence_dict["espece2"] = list_espece

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
        LicenceAutorisationPeche.annee_validite.desc()
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

    licence_data.numero_licence = get_next_reference(licence_data.annee_validite, db)

    # Créer la licence
    licence = LicenceAutorisationPeche(**licence_data.model_dump())
    licence.statut = "active"

    db.add(licence)
    db.commit()
    db.refresh(licence)

    # Préparer la réponse
    return build_licence_response(licence, db)


@router.put("/{licence_id}", response_model=LicencePecheResponse)
def update_licence(
    licence_id: int, licence_data: LicencePecheUpdate, db: Session = Depends(get_db)
):
    """Mettre à jour une licence de pêche existante"""
    licence = (
        db.query(LicenceAutorisationPeche)
        .filter(LicenceAutorisationPeche.id == licence_id)
        .first()
    )
    if not licence:
        raise HTTPException(status_code=404, detail="Licence non trouvée")

    for key, value in licence_data.model_dump(exclude_unset=True).items():
        setattr(licence, key, value)

    db.commit()
    db.refresh(licence)

    return build_licence_response(licence, db)


@router.post("/signataire-licence")
def set_signataire_licence(
    data: SignataireLicenceCreate,
    db: Session = Depends(get_db),
):
    new_signataire = SignataireLicence(**data.model_dump())

    db.add(new_signataire)
    db.commit()
    db.refresh(new_signataire)

    return new_signataire


@router.get("/signataire-licence/{licence_id}")
def get_signataire_licence(licence_id: int, db: Session = Depends(get_db)):
    signataire_licence = (
        db.query(SignataireLicence)
        .filter(SignataireLicence.licence_id == licence_id)
        .first()
    )
    if not signataire_licence:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Signataire pour cette licence non trouvé",
        )
    return signataire_licence


@router.get("/statistiques/captures/{licence_id}")
def get_statistiques_licences(licence_id: int, db: Session = Depends(get_db)):
    # Implémenter la logique pour récupérer les statistiques des licences
    licence = (
        db.query(LicenceAutorisationPeche)
        .filter(LicenceAutorisationPeche.id == licence_id)
        .first()
    )
    if not licence:
        raise HTTPException(status_code=404, detail="Licence non trouvée")

    # Exemple de statistiques
    captures = (
        db.query(
            func.sum(DetailDebarquement.quantite_kg).label("total_kg"),
            func.sum(DetailDebarquement.valeur_totale).label("total_valeur"),
        )
        .join(Debarquement)
        .filter(
            Debarquement.date_debarquement >= licence.date_debut,
            Debarquement.date_debarquement <= licence.date_expiration,
            Debarquement.bateau_id == licence.bateau_id,
        )
        .first()
    )

    result = {
        "licence_id": licence.id,
        "numero_licence": licence.numero_licence,
        "total_captures_kg": captures.total_kg if captures.total_kg else 0,
        "total_captures_tonnes": round(float(captures.total_kg or 0) / 1000, 3),
        "total_captures_valeur": captures.total_valeur if captures.total_valeur else 0,
    }

    resultats = (
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
        .filter(
            Debarquement.date_debarquement >= licence.date_debut,
            Debarquement.date_debarquement <= licence.date_expiration,
            Debarquement.bateau_id == licence.bateau_id,
        )
        .group_by(Espece.id, Espece.nom_commun_francais, Espece.code_espece)
        .order_by(func.sum(DetailDebarquement.quantite_kg).desc())
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

    return {"total_captures": result, "captures_par_especes": top_especes}
