# utils/form_helpers.py
from typing import Optional
from datetime import date


def parse_form_date(date_str: Optional[str]) -> Optional[date]:
    """
    Convertir une date de formulaire en objet date
    Gère: None, "null", "", dates valides
    """
    if not date_str:
        return None

    # Gérer "null" comme string
    if isinstance(date_str, str):
        if date_str.lower() in ("null", "none", ""):
            return None

        try:
            return date.fromisoformat(date_str)
        except (ValueError, AttributeError):
            return None

    return None


def parse_form_bool(bool_str: Optional[str]) -> bool:
    """Convertir string bool en boolean"""
    if not bool_str:
        return False

    if isinstance(bool_str, bool):
        return bool_str

    return bool_str.lower() in ("true", "1", "yes", "on")


def parse_form_int(int_str: Optional[str]) -> Optional[int]:
    """Convertir string en int"""
    if not int_str or int_str == "null":
        return None

    try:
        return int(int_str)
    except (ValueError, TypeError):
        return None


def parse_form_float(float_str: Optional[str]) -> Optional[float]:
    """Convertir string en float"""
    if not float_str or float_str == "null":
        return None

    try:
        return float(float_str)
    except (ValueError, TypeError):
        return None
