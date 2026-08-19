"""
SIGPA — Module « Captures estimées »
Import du classeur « Données_estimées_<année> ».

Structure attendue (feuille unique) :
  • Deux grandes sections empilées verticalement, séparées par un bandeau :
        1. « Captures (kg) »   → tonnages estimés
        2. « Valeurs (f.cfa) » → valeurs estimées
  • Chaque section est découpée horizontalement en BLOCS de 15 colonnes,
    un bloc par engin de pêche. Le bloc de tête (sans titre d'engin, ou dont
    le titre n'est pas un libellé d'engin plausible) correspond au cumul
    TOUS ENGINS et est marqué `agrege`.
  • Dans un bloc :
        - en-tête : « Espèces | Janvier | … | Décembre | Total »
        - lignes espèces  : nom + 12 valeurs mensuelles + total
        - lignes de synthèse : « Efforts (jr) », « Nbre débarq. »,
          « Taux échant. », « CPUE (kg/jr) », « Captures (kg) »

Principes de robustesse (classeur d'analyste souvent irrégulier) :
  • La section (kg vs f.cfa) est déterminée par la POSITION du bandeau
    « Valeurs (f.cfa) » — signal fiable — et non par un balayage de colonne.
  • Seuls les blocs proches de leur bandeau de section sont importés ; les
    tableaux annexes situés plus bas (production par groupe, blocs tuilés
    non standard) sont IGNORÉS et signalés, jamais importés « au jugé ».
  • Un titre d'engin purement numérique est rejeté (→ bloc agrégé).
  • Les erreurs sont isolées ligne par ligne (savepoints) sans interrompre
    l'import ; chaque anomalie est renvoyée dans `erreurs`.

Dépendance : openpyxl.
"""

from __future__ import annotations

import re
from io import BytesIO
from typing import Optional
from fastapi import HTTPException
import pandas as pd

from openpyxl import load_workbook
from sqlalchemy import func, select
from sqlalchemy.orm import Session


from app.models import captures_estimees as models
from app.models.engin_peche import EnginPeche
from app.models.espece import Espece
from app.models.strates import StrateMineure
from app.schemas import captures_estimees as schemas
from app.services.captures_estimees_services import main_services as service

MOIS = schemas.MOIS_LIBELLES
_MOIS_LOWER = {m.lower() for m in MOIS}

BATCH_SIZE = 100

# COLONNES_REQUISES = {"Espèces", *MOIS, "strateMineure", "annee", "Engin"}
COLONNES_REQUISES = {
    "Espèces",
    "Mois",
    "captures_kg",
    "prix_kg",
    "strateMineure",
    "annee",
    "Engin",
}

PRIX_KG_DEFAUT = 0.0


# ---------------------------------------------------------------------------
# Helpers de lecture
# ---------------------------------------------------------------------------
def _norm(v) -> str:
    return str(v).strip().lower() if v is not None else ""


def _num(v) -> float:
    """Convertit une cellule en float, tolérant vides, virgules et espaces FR."""
    if v is None or v == "":
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("\u00a0", "").replace(" ", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return 0.0


def _upsert_capture(
    db: Session,
    *,
    annee,
    mois,
    engin_id,
    espece_id,
    strate_mineure_id,
    capture_kg,
    valeur_fcfa,
    source,
) -> None:
    """Insère ou met à jour la capture identifiée par son quintuplet clé."""
    obj = db.execute(
        select(models.CaptureEstimee).where(
            models.CaptureEstimee.annee == annee,
            models.CaptureEstimee.mois == mois,
            models.CaptureEstimee.engin_id == engin_id,
            models.CaptureEstimee.espece_id == espece_id,
            models.CaptureEstimee.strate_mineure_id == strate_mineure_id,
        )
    ).scalar_one_or_none()
    if obj is None:
        db.add(
            models.CaptureEstimee(
                annee=annee,
                mois=mois,
                engin_id=engin_id,
                espece_id=espece_id,
                strate_mineure_id=strate_mineure_id,
                capture_kg=capture_kg,
                valeur_fcfa=valeur_fcfa,
                source=source,
            )
        )
    else:
        obj.capture_kg = capture_kg
        obj.valeur_fcfa = valeur_fcfa
        obj.source = source


def _annee_depuis_nom(nom_fichier: str, defaut: int) -> int:
    m = re.search(r"(20\d{2})", nom_fichier or "")
    return int(m.group(1)) if m else defaut


def get_engin_id(db: Session, nom_engin: str) -> Optional[int]:
    """Renvoie l'ID de l'engin correspondant au libellé (ou None)."""
    if not nom_engin:
        return None
    stmt = select(EnginPeche.id).where(
        func.lower(func.trim(EnginPeche.libelle)) == nom_engin.strip().lower()
    )
    return db.scalar(stmt)


def get_espece_id(db: Session, nom_espece: str) -> Optional[int]:
    """Renvoie l'ID de l'espèce correspondant au nom (ou None)."""
    if not nom_espece:
        return None
    stmt = select(Espece.id).where(
        func.lower(func.trim(Espece.nom_commun_francais)) == nom_espece.strip().lower()
    )
    return db.scalar(stmt)


def get_strate_mineure_id(db: Session, nom_strate: str) -> Optional[int]:
    """Renvoie l'ID de la strate mineure correspondant au libellé (ou None)."""
    if not nom_strate:
        return None
    stmt = select(StrateMineure.id).where(
        func.lower(func.trim(StrateMineure.libelle)) == nom_strate.strip().lower()
    )
    return db.scalar(stmt)


def importer_classeur(
    db: Session,
    contenu: bytes,
    nom_fichier: str,
    prix_kg_defaut: float = PRIX_KG_DEFAUT,
):
    """Importe un classeur normalisé (format long) de captures estimées."""

    flux = BytesIO(contenu) if isinstance(contenu, (bytes, bytearray)) else contenu
    flux.seek(0)

    xls = pd.ExcelFile(flux)  # openpyxl auto pour .xlsx
    if len(xls.sheet_names) == 0:
        raise HTTPException(400, "Le classeur doit contenir au moins une feuille.")

    df = xls.parse(xls.sheet_names[0])
    manquantes = COLONNES_REQUISES - set(df.columns)

    if manquantes:
        raise HTTPException(400, f"Colonnes absentes : {', '.join(sorted(manquantes))}")

    res = schemas.ImportResultat(
        lignes_lues=0,
        captures_importees=0,
        efforts_importes=0,
        engins_crees=0,
        especes_creees=0,
        erreurs=[],
        succes=False,
    )

    for index, row in df.iterrows():
        ligne = index + 2  # +1 en-tête, +1 base-1
        # 1) Décoder/valider AVANT d'ouvrir un savepoint — un skip ne doit jamais
        #    laisser un savepoint ouvert.
        kg = _num(row["captures_kg"])
        if kg == 0:
            continue  # aucun savepoint ouvert ici

        mois_lib = str(row["Mois"]).strip()
        if mois_lib not in MOIS:
            res.erreurs.append(
                schemas.LigneErreur(
                    feuille=xls.sheet_names[0],
                    reference=f"Ligne {ligne}",
                    message=f"Mois invalide : {mois_lib!r}",
                )
            )
            continue
        mois_index = MOIS.index(mois_lib) + 1
        # sp = db.begin_nested()  # savepoint : isole les erreurs par ligne

        try:
            with db.begin_nested():
                annee = int(_num(row["annee"]))
                engin_id = get_engin_id(db, str(row["Engin"]).strip())
                espece_id = get_espece_id(db, str(row["Espèces"]).strip())
                strate_id = get_strate_mineure_id(db, str(row["strateMineure"]).strip())
                if not engin_id:
                    raise ValueError("Engin introuvable.")
                if not espece_id:
                    raise ValueError("Espèce introuvable.")
                if not strate_id:
                    raise ValueError("Strate mineure introuvable.")

                prix = _num(row.get("prix_kg", prix_kg_defaut)) or prix_kg_defaut
                _upsert_capture(
                    db,
                    annee=annee,
                    mois=mois_index,
                    engin_id=engin_id,
                    espece_id=espece_id,
                    strate_mineure_id=strate_id,
                    capture_kg=kg,
                    valeur_fcfa=kg * prix,
                    source=f"Import Excel {nom_fichier}",
                )
                res.captures_importees += 1
            res.lignes_lues += 1
        except Exception as e:  # noqa: BLE001 — on veut isoler chaque ligne
            db.begin_nested().rollback()
            res.erreurs.append(
                schemas.LigneErreur(
                    feuille=xls.sheet_names[0],
                    reference=f"Ligne {ligne}",
                    message=str(e),
                )
            )

    df_efforts = xls.parse(xls.sheet_names[1]) if len(xls.sheet_names) > 1 else None
    if df_efforts is not None:
        for index, row in df_efforts.iterrows():
            ligne = index + 2
            sp = db.begin_nested()
            try:
                annee = int(_num(row["annee"]))
                engin_id = get_engin_id(db, str(row["Engin"]).strip())
                strate_mineure_id = get_strate_mineure_id(
                    db, str(row["strateMineure"]).strip()
                )
                if not engin_id:
                    raise ValueError("Engin introuvable.")
                if not strate_mineure_id:
                    raise ValueError("Strate mineure introuvable.")

                effort_jours = _num(row["Effort"])
                debarq = int(_num(row["nbDebarquement"]))
                taux_ech = _num(row["tauxEchantillon"])
                mois_index = (
                    MOIS.index(str(row["Mois"])) + 1
                    if str(row["Mois"]) in MOIS
                    else None
                )
                if mois_index is None:
                    raise ValueError("Mois invalide.")

                data_upload = schemas.EffortUpsert(
                    annee=annee,
                    mois=mois_index,
                    engin_id=engin_id,
                    strate_mineure_id=strate_mineure_id,
                    efforts_jours=effort_jours,
                    nombre_debarquements=debarq,
                    taux_echantillonnage=taux_ech,
                )
                service.upsert_effort(db, data_upload)
                res.efforts_importes += 1

                # for i, nom_mois in enumerate(MOIS, start=1):
                #     jours = _num(row[f"Efforts (jr) {nom_mois}"])
                #     debarq = int(_num(row[f"Nbre débarq. {nom_mois}"]))
                #     taux_ech = _num(row[f"Taux échant. {nom_mois}"])
                #     service.upsert_effort(
                #         db,
                #         annee=annee,
                #         mois=i,
                #         engin_id=engin_id,
                #         strate_mineure_id=strate_mineure_id,
                #         efforts_jours=jours,
                #         nombre_debarquements=debarq,
                #         taux_echantillonnage=taux_ech,
                #     )
                #     res.efforts_importes += 1

                sp.commit()
            except Exception as e:
                sp.rollback()
                res.erreurs.append(
                    schemas.LigneErreur(
                        feuille=xls.sheet_names[1],
                        reference=f"Ligne {ligne}",
                        message=str(e),
                    )
                )
    db.commit()
    res.succes = res.captures_importees > 0
    return res
