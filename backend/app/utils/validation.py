# utils/validation.py
from datetime import date, datetime
from typing import Any

FORMATS_DATE = [
    "%d/%m/%Y",  # 15/03/1985 — format terrain principal
    "%d-%m-%Y",  # 15-03-1985
    "%Y-%m-%d",  # 1985-03-15 — ISO
    "%d/%m/%y",  # 15/03/85 — année sur 2 chiffres
    "%d.%m.%Y",  # 15.03.1985
]


def parser_date(valeur: Any, nom_champ: str) -> date | None:
    """
    Parse une date depuis une cellule Excel en gérant tous les cas terrain.

    Retourne None pour les cellules vides (le contrôle d'obligation
    se fait en amont dans la boucle d'import).

    Lève ValueError avec un message français explicite si la valeur
    est présente mais malformée.

    Cas gérés :
        - Cellule vide (None, chaîne vide, espaces)
        - Cellule Excel formatée en date (openpyxl renvoie datetime)
        - Chaîne dans différents formats (JJ/MM/AAAA, ISO, etc.)
        - Numéro de série Excel (nombre de jours depuis 1900)
        - Dates malformées (trop de séparateurs, mois > 12, etc.)
    """
    # --- Cellule vide ---
    if valeur is None:
        return None
    if isinstance(valeur, str) and not valeur.strip():
        return None

    # --- Types natifs (openpyxl avec data_only=True renvoie souvent datetime) ---
    if isinstance(valeur, datetime):
        return valeur.date()
    if isinstance(valeur, date):
        return valeur

    # --- Numéro de série Excel (float ou int) ---
    # Excel stocke les dates comme le nombre de jours depuis le 1900-01-01
    # (avec le bug historique du 29/02/1900). openpyxl le convertit
    # normalement, mais on garde le fallback pour les fichiers .xls anciens.
    if isinstance(valeur, (int, float)):
        try:
            from openpyxl.utils.datetime import from_excel

            resultat = from_excel(valeur)
            if isinstance(resultat, datetime):
                return resultat.date()
            return resultat
        except Exception:
            raise ValueError(
                f"« {nom_champ} » : valeur numérique « {valeur} » "
                f"non reconnue comme date (format attendu : JJ/MM/AAAA)"
            )

    # --- Chaîne à parser ---
    texte = str(valeur).strip()

    # Nettoyage : Excel ajoute parfois un timestamp '15/03/1985 00:00:00'
    if " " in texte:
        texte = texte.split(" ")[0]

    # Détection des dates malformées type '18/10/10/2024' ou '15--03-1985'
    if texte.count("/") > 2 or texte.count("-") > 2 or texte.count(".") > 2:
        raise ValueError(
            f"« {nom_champ} » : date invalide « {valeur} » "
            f"(trop de séparateurs — format attendu : JJ/MM/AAAA)"
        )

    # Essai de tous les formats connus
    for fmt in FORMATS_DATE:
        try:
            resultat = datetime.strptime(texte, fmt).date()
            # Garde-fou : année sur 2 chiffres → interprétation raisonnable
            # datetime bascule à 2000 pour < 69, à 1900 sinon. On refuse
            # les dates futures pour éviter '15/03/85' → 2085 sur une
            # saisie qui voulait dire 1985.
            if fmt == "%d/%m/%y" and resultat > date.today():
                resultat = resultat.replace(year=resultat.year - 100)
            return resultat
        except ValueError:
            continue

    raise ValueError(
        f"« {nom_champ} » : date invalide « {valeur} » "
        f"(format attendu : JJ/MM/AAAA — exemple : 15/03/1985)"
    )
