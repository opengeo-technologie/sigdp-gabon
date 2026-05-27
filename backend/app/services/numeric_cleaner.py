"""
Utilitaires pour nettoyer et convertir les valeurs numériques depuis Excel
"""

import pandas as pd
import re
from typing import Union, Optional


def clean_numeric_string(value: any) -> Optional[str]:
    """
    Nettoie une chaîne numérique avec des séparateurs de milliers et décimales

    Exemples:
    - '1?000,0' → '1000.0'
    - '1 000,5' → '1000.5'
    - '1.000,50' → '1000.50'
    - '1,000.50' → '1000.50'
    - '2 500' → '2500'
    """
    if pd.isna(value) or value == "" or value is None:
        return None

    # Convertir en string
    value_str = str(value).strip()

    # Si c'est déjà un nombre valide, le retourner
    try:
        float(value_str)
        return value_str
    except ValueError:
        pass

    # Retirer les espaces, ? et autres caractères non numériques sauf , et .
    # Garder le signe négatif si présent
    is_negative = value_str.startswith("-")
    value_str = value_str.replace("-", "")

    # Retirer les séparateurs de milliers courants
    value_str = value_str.replace("?", "")  # Caractère bizarre
    value_str = value_str.replace(" ", "")  # Espace
    value_str = value_str.replace("\u00a0", "")  # Espace insécable
    value_str = value_str.replace("\u202f", "")  # Espace fine insécable

    # Détecter le séparateur décimal
    # En français: virgule (,)
    # En anglais: point (.)

    # Si on a à la fois , et .
    if "," in value_str and "." in value_str:
        # Le dernier est le séparateur décimal
        comma_pos = value_str.rfind(",")
        dot_pos = value_str.rfind(".")

        if comma_pos > dot_pos:
            # Format français: 1.000,50
            value_str = value_str.replace(".", "").replace(",", ".")
        else:
            # Format anglais: 1,000.50
            value_str = value_str.replace(",", "")

    # Si on a uniquement une virgule
    elif "," in value_str:
        # Compter les virgules
        comma_count = value_str.count(",")

        if comma_count == 1:
            # Vérifier si c'est un séparateur de milliers ou décimal
            comma_pos = value_str.index(",")
            after_comma = value_str[comma_pos + 1 :]

            # Si 3 chiffres ou plus après, c'est probablement un séparateur de milliers
            if len(after_comma) >= 3 and after_comma.isdigit():
                value_str = value_str.replace(",", "")
            else:
                # Sinon c'est un séparateur décimal
                value_str = value_str.replace(",", ".")
        else:
            # Plusieurs virgules = séparateurs de milliers
            value_str = value_str.replace(",", "")

    # Si on a uniquement des points
    elif "." in value_str:
        dot_count = value_str.count(".")
        if dot_count > 1:
            # Plusieurs points = séparateurs de milliers
            value_str = value_str.replace(".", "")
        # Sinon on garde le point comme séparateur décimal

    # Retirer tout ce qui n'est pas un chiffre, point ou signe moins
    value_str = re.sub(r"[^\d.-]", "", value_str)

    # Remettre le signe négatif
    if is_negative and value_str:
        value_str = "-" + value_str

    return value_str if value_str else None


def safe_int(value: any, default: Optional[int] = None) -> Optional[int]:
    """
    Convertit une valeur en entier de manière sécurisée

    Exemples:
    - safe_int('1?000,0') → 1000
    - safe_int('2 500') → 2500
    - safe_int('invalid') → None
    - safe_int('', 0) → 0
    """
    if pd.isna(value) or value == "":
        return default

    try:
        # Si c'est déjà un nombre
        if isinstance(value, (int, float)):
            return int(value)

        # Nettoyer la chaîne
        cleaned = clean_numeric_string(value)
        if cleaned is None:
            return default

        # Convertir en float puis en int
        return int(float(cleaned))

    except (ValueError, TypeError):
        return default


def safe_float(value: any, default: Optional[float] = None) -> Optional[float]:
    """
    Convertit une valeur en float de manière sécurisée

    Exemples:
    - safe_float('1?000,5') → 1000.5
    - safe_float('2 500,75') → 2500.75
    - safe_float('invalid') → None
    - safe_float('', 0.0) → 0.0
    """
    if pd.isna(value) or value == "":
        return default

    try:
        # Si c'est déjà un nombre
        if isinstance(value, (int, float)):
            return float(value)

        # Nettoyer la chaîne
        cleaned = clean_numeric_string(value)
        if cleaned is None:
            return default

        return float(cleaned)

    except (ValueError, TypeError):
        return default


def clean_dataframe_numerics(df: pd.DataFrame, numeric_columns: list) -> pd.DataFrame:
    """
    Nettoie toutes les colonnes numériques d'un DataFrame

    Args:
        df: DataFrame pandas
        numeric_columns: Liste des noms de colonnes à nettoyer

    Returns:
        DataFrame avec les colonnes nettoyées
    """
    df_cleaned = df.copy()

    for col in numeric_columns:
        if col in df_cleaned.columns:
            # Appliquer le nettoyage
            df_cleaned[col] = df_cleaned[col].apply(
                lambda x: clean_numeric_string(x) if pd.notna(x) and x != "" else None
            )

            # Convertir en numérique
            df_cleaned[col] = pd.to_numeric(df_cleaned[col], errors="coerce")

    return df_cleaned


# Tests unitaires
if __name__ == "__main__":
    print("=" * 70)
    print("🧪 TESTS DES FONCTIONS DE NETTOYAGE NUMÉRIQUE")
    print("=" * 70)
    print()

    test_cases = [
        # (input, expected_cleaned, expected_int, expected_float)
        ("1?000,0", "1000.0", 1000, 1000.0),
        ("1 000,5", "1000.5", 1000, 1000.5),
        ("1.000,50", "1000.50", 1000, 1000.50),
        ("1,000.50", "1000.50", 1000, 1000.50),
        ("2 500", "2500", 2500, 2500.0),
        ("3,5", "3.5", 3, 3.5),
        ("1000", "1000", 1000, 1000.0),
        ("1000.5", "1000.5", 1000, 1000.5),
        ("-500", "-500", -500, -500.0),
        ("", None, None, None),
        ("invalid", None, None, None),
        ("12 345,67", "12345.67", 12345, 12345.67),
        ("1\u00a0000,5", "1000.5", 1000, 1000.5),  # Espace insécable
    ]

    print("🔍 Test de clean_numeric_string():")
    print("-" * 70)
    for test_input, expected_cleaned, _, _ in test_cases:
        result = clean_numeric_string(test_input)
        status = "✅" if result == expected_cleaned else "❌"
        print(f"{status} '{test_input}' → '{result}' (attendu: '{expected_cleaned}')")

    print()
    print("🔢 Test de safe_int():")
    print("-" * 70)
    for test_input, _, expected_int, _ in test_cases:
        result = safe_int(test_input)
        status = "✅" if result == expected_int else "❌"
        print(f"{status} '{test_input}' → {result} (attendu: {expected_int})")

    print()
    print("📊 Test de safe_float():")
    print("-" * 70)
    for test_input, _, _, expected_float in test_cases:
        result = safe_float(test_input)
        status = "✅" if result == expected_float else "❌"
        print(f"{status} '{test_input}' → {result} (attendu: {expected_float})")

    print()
    print("=" * 70)
    print("✅ Tests terminés")
    print("=" * 70)
