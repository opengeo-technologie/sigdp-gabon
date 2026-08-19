import io
import os
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status, Query
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, or_
from typing import List, Optional
from datetime import datetime, date, timedelta
import secrets

from app.database import get_db
from app.models.debarquement import Debarquement, DetailDebarquement
from app.models.debarcadere import Debarcadere
from app.models.bateau import Bateau
from app.models.pecheur import Pecheur
from app.models.espece import Espece
from app.models.armement_coorperative import ArmementCooperative
from app.schemas.debarquement import (
    DebarquementCreate,
    DebarquementUpdate,
    DebarquementResponse,
    DebarquementInDB,
    DetailDebarquementInDB,
)
from app.services.numeric_cleaner import clean_numeric_string, safe_float, safe_int

router = APIRouter(prefix="/api/debarquements", tags=["Débarquements"])

# Configuration upload
ERRORS_DIR = Path("errors/captures")
ERRORS_DIR.mkdir(parents=True, exist_ok=True)

ERROR_FILE = ERRORS_DIR / "errors.xlsx"
ERROR_FILE_BATEAUX = ERRORS_DIR / "errors_bateaux.xlsx"


FORMATS_DATE = ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d/%m/%y"]

BATCH_SIZE = 100


def parser_date(valeur, nom_champ: str) -> date | None:
    """Parse une date depuis Excel (str, datetime ou None) avec erreur explicite."""
    if valeur is None or (isinstance(valeur, str) and not valeur.strip()):
        return None

    # openpyxl renvoie souvent directement un datetime pour les cellules date
    if isinstance(valeur, datetime):
        return valeur.date()
    if isinstance(valeur, date):
        return valeur

    texte = str(valeur).strip()

    # Détection des dates malformées type '18/10/10/2024'
    if texte.count("/") > 2 or texte.count("-") > 2:
        raise ValueError(
            f"« {nom_champ} » : date invalide « {texte} » "
            f"(trop de séparateurs — format attendu : JJ/MM/AAAA)"
        )

    for fmt in FORMATS_DATE:
        try:
            return datetime.strptime(texte, fmt).date()
        except ValueError:
            continue

    raise ValueError(
        f"« {nom_champ} » : date invalide « {texte} » (format attendu : JJ/MM/AAAA)"
    )


def generate_numero_debarquement() -> str:
    """Générer un numéro unique de débarquement"""
    today = datetime.now()
    random_suffix = secrets.token_hex(4).upper()
    return f"DEB-{today.strftime('%Y%m%d')}-{random_suffix}"


def calculerEffortPeche(capture: Debarquement) -> int:
    date1 = capture.date_depart_peche
    date2 = capture.date_debarquement
    return (date2 - date1).days + 1


def calculerCpue(capture: Debarquement) -> float:

    return 0


@router.post("/upload-excel")
async def upload_captures_excel(
    file: UploadFile = File(...), db: Session = Depends(get_db)
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail="Le fichier doit être au format Excel (.xlsx ou .xls)",
        )

    try:
        contents = await file.read()
        excel_file = io.BytesIO(contents)
        engine = "openpyxl" if file.filename.endswith(".xlsx") else "xlrd"
        df = pd.read_excel(excel_file, engine=engine)

        required_columns = {
            "code_pirogue_bd",
            "depart",
            "retour",
            "zone_de_peche",
            "sitedebarquement",
            "immatriculation_pirogue",
        }
        if not required_columns.issubset(df.columns):
            raise HTTPException(
                status_code=400,
                detail=f"Le fichier Excel doit contenir les colonnes suivantes: {', '.join(required_columns)}",
            )

        df = df.fillna("")

        total_rows = len(df)
        inserted_count = 0
        errors = []
        errors_bateaux = []
        all_errors = []

        # Précharger les espèces une seule fois (hors des boucles)
        especes = db.query(Espece).all()

        # ---- Traitement par lots de BATCH_SIZE lignes ----
        for batch_start in range(0, total_rows, BATCH_SIZE):
            batch_df = df.iloc[batch_start : batch_start + BATCH_SIZE]
            batch_inserted = 0

            for _, row in batch_df.iterrows():
                bateau = (
                    db.query(Bateau)
                    .filter(
                        Bateau.numero_immatriculation
                        == str(row["immatriculation_pirogue"]).strip()
                    )
                    .first()
                )

                # Renommé en 'debarcadere' pour éviter la confusion avec
                # l'objet Debarquement créé plus bas
                debarcadere = (
                    db.query(Debarcadere)
                    .filter(
                        or_(
                            func.lower(func.trim(Debarcadere.nom_local))
                            == str(row["sitedebarquement"]).strip().lower(),
                            func.lower(func.trim(Debarcadere.denomination))
                            == str(row["sitedebarquement"]).strip().lower(),
                        )
                    )
                    .first()
                )

                details_selected = []
                for espece in especes:
                    if (
                        espece.nom_commun_francais in df.columns
                        and row[espece.nom_commun_francais] != ""
                    ):
                        details_selected.append(
                            {
                                "espece_id": espece.id,
                                "quantite_kg": safe_int(
                                    row[espece.nom_commun_francais]
                                ),
                            }
                        )

                try:
                    # Savepoint par ligne : si CETTE ligne échoue, seule
                    # elle est annulée, le reste du lot continue.
                    with db.begin_nested():
                        date_depart = parser_date(
                            row.get("depart"), "Date de départ pêche"
                        )
                        date_debarq = parser_date(
                            row.get("retour"), "Date de débarquement"
                        )

                        if date_depart and date_debarq and date_depart > date_debarq:
                            raise ValueError(
                                f"La date de départ ({date_depart.strftime('%d/%m/%Y')}) est supérieure "
                                f"à la date de débarquement ({date_debarq.strftime('%d/%m/%Y')})"
                            )

                        debarquement_data = DebarquementCreate(
                            bateau_id=bateau.id if bateau else None,
                            pecheur_principal_id=(
                                bateau.proprietaire_pecheur_id if bateau else None
                            ),
                            date_debarquement=date_debarq,
                            date_depart_peche=date_depart,
                            zone_peche_nom=row["zone_de_peche"],
                            debarcadere_id=debarcadere.id if debarcadere else None,
                            details=details_selected,
                        )

                        deb_data = debarquement_data.model_dump(exclude={"details"})
                        deb_data["numero_debarquement"] = generate_numero_debarquement()

                        debarquement = Debarquement(**deb_data)
                        db.add(debarquement)
                        db.flush()  # pour récupérer debarquement.id

                        details_list = []
                        for detail_data in debarquement_data.details:
                            detail = DetailDebarquement(
                                debarquement_id=debarquement.id,
                                **detail_data.model_dump(),
                            )
                            db.add(detail)
                            details_list.append(detail)

                        check_alertes(debarquement, details_list, db)

                    # Sortie du savepoint sans exception => ligne OK
                    batch_inserted += 1

                except Exception as e:
                    # Le savepoint a déjà été annulé automatiquement.
                    error_row = row.to_dict()
                    error_bateaux = row.to_dict()
                    if not bateau:
                        msg = (
                            f'Bateau avec immatriculation {row["immatriculation_pirogue"]} '
                            f"inexistant dans la base de données"
                        )
                        error_bateaux["error_message"] = msg
                        errors_bateaux.append(error_bateaux)
                        all_errors.append(error_bateaux)
                        # error_row["error_message"] = msg
                    else:
                        error_row["error_message"] = str(e)
                        errors.append(error_row)
                        all_errors.append(error_row)

            # ---- Un seul commit pour tout le lot ----
            try:
                db.commit()
                inserted_count += batch_inserted
            except Exception as e:
                db.rollback()
                # Cas rare (perte de connexion, contrainte différée…) :
                # tout le lot est considéré comme échoué.
                for _, row in batch_df.iterrows():
                    error_row = row.to_dict()
                    error_row["error_message"] = f"Échec du commit du lot: {str(e)}"
                    errors.append(error_row)
                    all_errors.append(error_row)

        header = df.columns.tolist()
        header_bateau = ["immatriculation", "nom_pirroge"]
        if errors:
            save_errors(errors, header, ERROR_FILE)
        if errors_bateaux:
            save_errors(errors_bateaux, header, ERROR_FILE_BATEAUX)

        return {
            "total": total_rows,
            "inseres": inserted_count,
            "bacth": batch_inserted,
            "echoues": len(errors),
            "erreurs": all_errors,
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


# @router.post("/upload-excel2")
# async def upload_captures_excel2(
#     file: UploadFile = File(...), db: Session = Depends(get_db)
# ):
#     """
#     Télécharge un fichier Excel contenant les données des bateaux et les insère dans la base de données.

#     Format attendu du fichier Excel:
#     - code_pirogue_bd:Code unique du bateau (ex: Pirogue-001)
#     - nom: Nom du bateau (ex: La Belle Pirogue)
#     - immatriculation: Numéro d'immatriculation du bateau (ex: GA-1234-AB)
#     - depart: Date de départ en mer
#     - retour: Date de retour au débarcadère
#     - zone_de_peche: Zone de pêche habituelle (ex: Zone A, Zone B)
#     - sitedebarquement: Nom du site de débarquement (ex: Port de Libreville)
#     """

#     # Vérifier l'extension du fichier
#     if not file.filename.endswith((".xlsx", ".xls")):
#         raise HTTPException(
#             status_code=400,
#             detail="Le fichier doit être au format Excel (.xlsx ou .xls)",
#         )

#     try:
#         # Lire le fichier Excel avec pandas
#         contents = await file.read()
#         excel_file = io.BytesIO(contents)
#         engine = "openpyxl" if file.filename.endswith(".xlsx") else "xlrd"
#         df = pd.read_excel(excel_file, engine=engine)

#         # Valider les colonnes requises
#         required_columns = {
#             "code_pirogue_bd",
#             "depart",
#             "retour",
#             "zone_de_peche",
#             "sitedebarquement",
#             "immatriculation_pirogue",
#         }
#         if not required_columns.issubset(df.columns):
#             raise HTTPException(
#                 status_code=400,
#                 detail=f"Le fichier Excel doit contenir les colonnes suivantes: {', '.join(required_columns)}",
#             )

#         # Nettoyer les données
#         df = df.fillna("")  # Remplacer NaN par chaîne vide

#         header = df.columns.tolist()
#         print(header)

#         # Statistiques d'import
#         total_rows = len(df)
#         inserted_count = 0
#         updated_count = 0
#         errors = []
#         errors_bateaux = []

#         # Précharger les données de référence pour éviter les requêtes répétées
#         especes = db.query(Espece).all()

#         # Insérer les données dans la base de données
#         for _, row in df.iterrows():

#             # print(f"Traitement de la ligne: {row.to_dict()}")  # Debug

#             bateau = (
#                 db.query(Bateau)
#                 .filter(
#                     Bateau.numero_immatriculation
#                     == str(row["immatriculation_pirogue"]).strip()
#                 )
#                 .first()
#             )

#             debarquement = (
#                 db.query(Debarcadere)
#                 .filter(
#                     or_(
#                         func.lower(func.trim(Debarcadere.nom_local))
#                         == str(row["sitedebarquement"]).strip().lower(),
#                         func.lower(func.trim(Debarcadere.denomination))
#                         == str(row["sitedebarquement"]).strip().lower(),
#                     )
#                 )
#                 .first()
#             )

#             details_selected = []

#             for espece in especes:
#                 if (
#                     espece.nom_commun_francais in df.columns
#                     and row[espece.nom_commun_francais] != ""
#                 ):
#                     # print(
#                     #     f"Colonne pour l'espèce {espece.nom_commun_francais} trouvée dans le fichier Excel"
#                     # )  # Debug
#                     espece_chosen = {
#                         "espece_id": espece.id,
#                         "quantite_kg": (
#                             safe_int(row[espece.nom_commun_francais])
#                             if row[espece.nom_commun_francais] != ""
#                             else 0
#                         ),
#                     }
#                     details_selected.append(espece_chosen)

#             try:

#                 date_depart = parser_date(row.get("depart"), "Date de départ pêche")
#                 date_debarq = parser_date(row.get("retour"), "Date de débarquement")

#                 # Contrôle de cohérence métier tant qu'on y est
#                 if date_depart and date_debarq and date_depart > date_debarq:
#                     raise ValueError(
#                         f"La date de départ ({date_depart.strftime('%d/%m/%Y')}) est supérieure "
#                         f"à la date de débarquement ({date_debarq.strftime('%d/%m/%Y')})"
#                     )

#                 debarquement_data = DebarquementCreate(
#                     # numero_debarquement=generate_numero_debarquement(),
#                     bateau_id=bateau.id if bateau else None,
#                     pecheur_principal_id=(
#                         bateau.proprietaire_pecheur_id if bateau else None
#                     ),
#                     date_debarquement=date_debarq,
#                     date_depart_peche=date_depart,
#                     zone_peche_nom=row["zone_de_peche"],
#                     debarcadere_id=debarquement.id if debarquement else None,
#                     details=details_selected,
#                 )

#                 # Créer le débarquement
#                 deb_data = debarquement_data.model_dump(exclude={"details"})
#                 deb_data["numero_debarquement"] = generate_numero_debarquement()

#                 debarquement = Debarquement(**deb_data)
#                 db.add(debarquement)
#                 db.flush()

#                 # Créer les détails
#                 details_list = []
#                 for detail_data in debarquement_data.details:
#                     detail = DetailDebarquement(
#                         debarquement_id=debarquement.id, **detail_data.model_dump()
#                     )
#                     db.add(detail)
#                     details_list.append(detail)

#                 # Vérifier les alertes
#                 check_alertes(debarquement, details_list, db)

#                 db.commit()
#                 db.refresh(debarquement)
#                 inserted_count += 1
#             except Exception as e:
#                 db.rollback()
#                 # print(e)

#                 error_row = row.to_dict()
#                 error_row_bateau = {}
#                 if not bateau:
#                     error_row_bateau["immatriculation"] = row["immatriculation_pirogue"]
#                     error_row_bateau["nom_pirroge"] = row["identifiant_pirogue"]
#                     error_row_bateau["error_message"] = (
#                         f'Bateau avec immatriculation {row["immatriculation_pirogue"]} inexistant dans la base de données'
#                     )
#                     error_row["error_message"] = (
#                         f'Bateau avec immatriculation {row["immatriculation_pirogue"]} inexistant dans la base de données'
#                     )
#                     errors_bateaux.append(error_row_bateau)
#                 else:
#                     error_row["error_message"] = str(e)
#                 errors.append(error_row)

#         header = df.columns.tolist()
#         header_bateau = ["immatriculation", "nom_pirroge"]
#         if errors:
#             save_errors(errors, header, ERROR_FILE)

#         if errors_bateaux:
#             save_errors(errors_bateaux, header_bateau, ERROR_FILE_BATEAUX)

#         return {
#             "total": len(df),
#             "inseres": inserted_count,
#             "echoues": len(errors),
#             "erreurs": errors,
#             "error_file": ERROR_FILE if errors else None,
#         }

#     except pd.errors.EmptyDataError:
#         raise HTTPException(
#             status_code=400, detail="Le fichier Excel est vide ou mal formaté"
#         )
#     except Exception as e:
#         raise HTTPException(
#             status_code=500, detail=f"Erreur lors du traitement du fichier: {str(e)}"
#         )


def save_errors(errors: list[dict], header: list[str], path_file: str):
    new_df = pd.DataFrame(errors)
    new_df = (
        new_df[header + ["error_message"]]
        if all(h in new_df.columns for h in header)
        else new_df
    )

    if os.path.exists(path_file):
        existing_df = pd.read_excel(path_file)
        final_df = pd.concat([existing_df, new_df], ignore_index=True)
    else:
        final_df = new_df

    final_df.to_excel(path_file, index=False, header=True)


def check_alertes(debarquement: Debarquement, details: list, db: Session):
    """Vérifier et marquer les alertes pour un débarquement"""
    alertes = []

    for detail in details:
        espece = db.query(Espece).filter(Espece.id == detail.espece_id).first()

        if not espece:
            continue

        # Alerte espèce protégée
        if espece.statut_reglementaire == "Protégé":
            debarquement.alerte_espece_protegee = True
            alertes.append(f"ESPÈCE PROTÉGÉE: {espece.nom_commun_francais}")

        # Alerte taille minimale légale
        if espece.taille_minimale_legale_cm and detail.taille_min_cm:
            if detail.taille_min_cm < espece.taille_minimale_legale_cm:
                debarquement.alerte_taille_illegale = True
                detail.alerte_taille_illegale = True
                alertes.append(f"Taille illégale pour {espece.nom_commun_francais}")

        # Alerte quota
        if espece.quota_mensuel_tonnes:
            # Calculer les captures du mois pour cette espèce
            debut_mois = date.today().replace(day=1)
            total_mois = (
                db.query(func.sum(DetailDebarquement.quantite_kg))
                .join(Debarquement)
                .filter(
                    DetailDebarquement.espece_id == espece.id,
                    Debarquement.date_debarquement >= debut_mois,
                )
                .scalar()
                or 0
            )

            total_mois_tonnes = total_mois / 1000
            if (
                total_mois_tonnes + (detail.quantite_kg / 1000)
                > espece.quota_mensuel_tonnes
            ):
                debarquement.alerte_quota_depasse = True
                detail.alerte_quota = True
                alertes.append(
                    f"Quota mensuel dépassé pour {espece.nom_commun_francais}"
                )

    # Vérifier le bateau
    bateau = db.query(Bateau).filter(Bateau.id == debarquement.bateau_id).first()
    if bateau:
        if bateau.certificat_navigabilite_date_expiration:
            if bateau.certificat_navigabilite_date_expiration < date.today():
                debarquement.alerte_bateau_non_conforme = True
                alertes.append("Certificat de navigabilité expiré")

    if alertes:
        debarquement.alerte_details = " | ".join(alertes)


@router.get("")
def get_debarquements(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=10000),
    debarcadere_id: Optional[int] = None,
    pecheur_id: Optional[int] = None,
    bateau_id: Optional[int] = None,
    date_debut: Optional[date] = None,
    date_fin: Optional[date] = None,
    avec_alertes: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    """
    Récupérer la liste des débarquements avec filtres
    """
    query = db.query(Debarquement)

    if debarcadere_id:
        query = query.filter(Debarquement.debarcadere_id == debarcadere_id).order_by(
            desc(Debarquement.date_debarquement)
        )
    if pecheur_id:
        query = query.filter(Debarquement.pecheur_principal_id == pecheur_id).order_by(
            desc(Debarquement.date_debarquement)
        )
    if bateau_id:
        query = query.filter(Debarquement.bateau_id == bateau_id).order_by(
            desc(Debarquement.date_debarquement)
        )
    if date_debut:
        query = query.filter(Debarquement.date_debarquement >= date_debut).order_by(
            desc(Debarquement.date_debarquement)
        )
    if date_fin:
        query = query.filter(Debarquement.date_debarquement <= date_fin).order_by(
            desc(Debarquement.date_debarquement)
        )
    if avec_alertes:
        query = query.filter(
            (Debarquement.alerte_espece_protegee == True)
            | (Debarquement.alerte_quota_depasse == True)
            | (Debarquement.alerte_taille_illegale == True)
            | (Debarquement.alerte_bateau_non_conforme == True)
        ).order_by(desc(Debarquement.date_debarquement))

    # ✅ COMPTER LE TOTAL (AVANT PAGINATION)
    total = query.count()

    # query = query.order_by(Debarquement.date_debarquement.desc())
    debarquements = query.offset(skip).limit(limit).all()

    result = []
    for deb in debarquements:
        deb_dict = DebarquementInDB.from_orm(deb).model_dump()

        # Enrichir avec les données liées
        debarcadere = (
            db.query(Debarcadere).filter(Debarcadere.id == deb.debarcadere_id).first()
        )
        bateau = db.query(Bateau).filter(Bateau.id == deb.bateau_id).first()
        pecheur = (
            db.query(Pecheur).filter(Pecheur.id == deb.pecheur_principal_id).first()
        )

        if debarcadere:
            deb_dict["debarcadere_nom"] = debarcadere.denomination
        if bateau:
            deb_dict["bateau_immatriculation"] = bateau.numero_immatriculation
        if pecheur:
            deb_dict["pecheur_nom"] = f"{pecheur.nom} {pecheur.prenom}"

        deb_dict["effort_peche"] = calculerEffortPeche(deb)

        # Récupérer les détails
        details = (
            db.query(DetailDebarquement)
            .filter(DetailDebarquement.debarquement_id == deb.id)
            .all()
        )

        details_list = []
        total_quantite = 0
        total_valeur = 0

        for detail in details:
            detail_dict = DetailDebarquementInDB.from_orm(detail).model_dump()
            espece = db.query(Espece).filter(Espece.id == detail.espece_id).first()
            if espece:
                detail_dict["espece_nom"] = espece.nom_commun_francais
                detail_dict["espece_code"] = espece.code_espece

            details_list.append(DetailDebarquementInDB(**detail_dict))
            total_quantite += detail.quantite_kg
            if detail.valeur_totale:
                total_valeur += detail.valeur_totale

        deb_dict["details"] = details_list
        deb_dict["total_quantite_kg"] = total_quantite
        deb_dict["total_valeur"] = total_valeur
        deb_dict["nb_especes"] = len(details)
        deb_dict["has_alertes"] = (
            deb.alerte_espece_protegee
            or deb.alerte_quota_depasse
            or deb.alerte_taille_illegale
            or deb.alerte_bateau_non_conforme
        )
        deb_dict["cpue"] = round(total_quantite / deb_dict["effort_peche"], 2)

        result.append(DebarquementResponse(**deb_dict))

    return {"result": result, "total": total}


@router.get("/{debarquement_id}", response_model=DebarquementResponse)
def get_debarquement(debarquement_id: int, db: Session = Depends(get_db)):
    """
    Récupérer un débarquement par son ID
    """
    deb = db.query(Debarquement).filter(Debarquement.id == debarquement_id).first()

    if not deb:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Débarquement avec ID {debarquement_id} introuvable",
        )

    deb_dict = DebarquementInDB.from_orm(deb).model_dump()

    # Enrichir les données (même logique que get_debarquements)
    debarcadere = (
        db.query(Debarcadere).filter(Debarcadere.id == deb.debarcadere_id).first()
    )
    bateau = db.query(Bateau).filter(Bateau.id == deb.bateau_id).first()
    pecheur = db.query(Pecheur).filter(Pecheur.id == deb.pecheur_principal_id).first()

    if debarcadere:
        deb_dict["debarcadere_nom"] = debarcadere.denomination
    if bateau:
        deb_dict["bateau_immatriculation"] = bateau.numero_immatriculation
    if pecheur:
        deb_dict["pecheur_nom"] = f"{pecheur.nom} {pecheur.prenom}"

    details = (
        db.query(DetailDebarquement)
        .filter(DetailDebarquement.debarquement_id == deb.id)
        .all()
    )

    details_list = []
    total_quantite = 0
    total_valeur = 0

    for detail in details:
        detail_dict = DetailDebarquementInDB.from_orm(detail).model_dump()
        espece = db.query(Espece).filter(Espece.id == detail.espece_id).first()
        if espece:
            detail_dict["espece_nom"] = espece.nom_commun_francais
            detail_dict["espece_code"] = espece.code_espece

        details_list.append(DetailDebarquementInDB(**detail_dict))
        total_quantite += detail.quantite_kg
        if detail.valeur_totale:
            total_valeur += detail.valeur_totale

    deb_dict["details"] = details_list
    deb_dict["total_quantite_kg"] = total_quantite
    deb_dict["total_valeur"] = total_valeur
    deb_dict["nb_especes"] = len(details)
    deb_dict["has_alertes"] = (
        deb.alerte_espece_protegee
        or deb.alerte_quota_depasse
        or deb.alerte_taille_illegale
        or deb.alerte_bateau_non_conforme
    )

    return DebarquementResponse(**deb_dict)


@router.post(
    "", response_model=DebarquementResponse, status_code=status.HTTP_201_CREATED
)
def create_debarquement(
    debarquement_data: DebarquementCreate, db: Session = Depends(get_db)
):
    """
    Créer un nouveau débarquement avec vérification d'alertes
    """
    # Vérifier que les entités existent
    debarcadere = (
        db.query(Debarcadere)
        .filter(Debarcadere.id == debarquement_data.debarcadere_id)
        .first()
    )
    if not debarcadere:
        raise HTTPException(status_code=404, detail="Débarcadère introuvable")

    bateau = db.query(Bateau).filter(Bateau.id == debarquement_data.bateau_id).first()
    if not bateau:
        raise HTTPException(status_code=404, detail="Bateau introuvable")

    pecheur = (
        db.query(Pecheur)
        .filter(Pecheur.id == debarquement_data.pecheur_principal_id)
        .first()
    )
    if not pecheur:
        raise HTTPException(status_code=404, detail="Pêcheur introuvable")

    # Créer le débarquement
    deb_data = debarquement_data.model_dump(exclude={"details"})
    deb_data["numero_debarquement"] = generate_numero_debarquement()

    debarquement = Debarquement(**deb_data)
    db.add(debarquement)
    db.flush()

    # Créer les détails
    details_list = []
    for detail_data in debarquement_data.details:
        detail = DetailDebarquement(
            debarquement_id=debarquement.id, **detail_data.model_dump()
        )
        db.add(detail)
        details_list.append(detail)

    # Vérifier les alertes
    check_alertes(debarquement, details_list, db)

    db.commit()
    db.refresh(debarquement)

    return get_debarquement(debarquement.id, db)


@router.get("/alertes/actives", response_model=List[DebarquementResponse])
def get_debarquements_avec_alertes(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """
    Récupérer tous les débarquements avec alertes actives
    """
    return get_debarquements(skip=skip, limit=limit, avec_alertes=True, db=db)


@router.get("/stats/resume")
def get_stats_resume(
    date_debut: Optional[date] = None,
    date_fin: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """
    Statistiques résumées des débarquements
    """
    query = db.query(Debarquement)

    if date_debut:
        query = query.filter(Debarquement.date_debarquement >= date_debut)
    if date_fin:
        query = query.filter(Debarquement.date_debarquement <= date_fin)

    total_debarquements = query.count()

    # Alertes
    alertes_especes_proteges = query.filter(
        Debarquement.alerte_espece_protegee == True
    ).count()
    alertes_quotas = query.filter(Debarquement.alerte_quota_depasse == True).count()
    alertes_tailles = query.filter(Debarquement.alerte_taille_illegale == True).count()
    alertes_bateaux = query.filter(
        Debarquement.alerte_bateau_non_conforme == True
    ).count()

    # Total quantité et valeur
    debarquements = query.all()
    total_quantite_kg = 0
    total_valeur = 0

    for deb in debarquements:
        details = (
            db.query(DetailDebarquement)
            .filter(DetailDebarquement.debarquement_id == deb.id)
            .all()
        )
        for detail in details:
            total_quantite_kg += detail.quantite_kg
            if detail.valeur_totale:
                total_valeur += detail.valeur_totale

    return {
        "total_debarquements": total_debarquements,
        "total_quantite_kg": total_quantite_kg,
        "total_quantite_tonnes": round(total_quantite_kg / 1000, 2),
        "total_valeur_fcfa": total_valeur,
        "alertes": {
            "especes_protegees": alertes_especes_proteges,
            "quotas_depasses": alertes_quotas,
            "tailles_illegales": alertes_tailles,
            "bateaux_non_conformes": alertes_bateaux,
            "total": alertes_especes_proteges
            + alertes_quotas
            + alertes_tailles
            + alertes_bateaux,
        },
    }
