"""
Couche CRUD / service — module Strates majeures & mineures (SIGPA).
SQLAlchemy ORM synchrone.

Les fonctions lèvent ValueError avec un message français en cas de règle
métier violée ; le routeur les traduit en HTTPException.
"""

from typing import List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.schemas.strates import (
    StrateMajeureCreate,
    StrateMajeureUpdate,
    StrateMajeureRead,
    StrateMajeureFiltre,
    StrateMineureCreate,
    StrateMineureFiltre,
    StrateMineureUpdate,
    StrateMineureRead,
)
from app.models.strates import StrateMajeure, StrateMineure


# ═══════════════════════════════════════════════════════════════════════════
#  STRATES MAJEURES
# ═══════════════════════════════════════════════════════════════════════════
def get_majeure(db: Session, majeure_id: int) -> Optional[StrateMajeure]:
    return db.query(StrateMajeure).filter(StrateMajeure.id == majeure_id).first()


def list_majeures(
    db: Session, filtre: Optional[StrateMajeureFiltre] = None
) -> List[StrateMajeure]:
    q = db.query(StrateMajeure)
    if filtre:
        if filtre.recherche:
            motif = f"%{filtre.recherche.strip()}%"
            q = q.filter(
                or_(
                    StrateMajeure.libelle.ilike(motif),
                )
            )
    return q.order_by(StrateMajeure.libelle).all()


def create_majeure(db: Session, data: StrateMajeureCreate) -> StrateMajeure:
    # if data.code:
    #     exists = (
    #         db.query(StrateMajeure)
    #         .filter(func.lower(StrateMajeure.libelle) == data.libelle.lower())
    #         .first()
    #     )
    #     if exists:
    #         raise ValueError(f"Une strate majeure existe déjà !!!!")

    obj = StrateMajeure(
        libelle=data.libelle,
        description=data.description,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_majeure(
    db: Session, majeure_id: int, data: StrateMajeureUpdate
) -> StrateMajeure:
    obj = get_majeure(db, majeure_id)
    if obj is None:
        raise ValueError("Strate majeure introuvable.")

    payload = data.model_dump(exclude_unset=True)

    for champ, valeur in payload.items():
        setattr(obj, champ, valeur)

    db.commit()
    db.refresh(obj)
    return obj


def delete_majeure(db: Session, majeure_id: int) -> None:
    obj = get_majeure(db, majeure_id)
    if obj is None:
        raise ValueError("Strate majeure introuvable.")

    # Garde-fou : refuser la suppression si des mineures existent.
    nb = (
        db.query(StrateMineure)
        .filter(StrateMineure.strate_majeure_id == majeure_id)
        .count()
    )
    if nb > 0:
        raise ValueError(
            f"Suppression impossible : {nb} strate(s) mineure(s) "
            "rattachée(s). Supprimez-les ou désactivez la strate majeure."
        )

    db.delete(obj)
    db.commit()


def arborescence(db: Session) -> List[StrateMajeure]:
    """Majeures + mineures imbriquées (selectinload pour éviter le N+1)."""
    q = db.query(StrateMajeure).options(selectinload(StrateMajeure.strates_mineures))
    return q.order_by(StrateMajeure.libelle).all()


# ═══════════════════════════════════════════════════════════════════════════
#  STRATES MINEURES
# ═══════════════════════════════════════════════════════════════════════════
def get_mineure(db: Session, mineure_id: int) -> Optional[StrateMineure]:
    return db.query(StrateMineure).filter(StrateMineure.id == mineure_id).first()


def list_mineures(
    db: Session, filtre: Optional[StrateMineureFiltre] = None
) -> List[StrateMineure]:
    q = db.query(StrateMineure)
    if filtre:
        if filtre.strate_majeure_id is not None:
            q = q.filter(StrateMineure.strate_majeure_id == filtre.strate_majeure_id)
        if filtre.recherche:
            motif = f"%{filtre.recherche.strip()}%"
            q = q.filter(
                StrateMineure.libelle.ilike(motif),
            )
    return q.order_by(StrateMineure.libelle).all()


def create_mineure(db: Session, data: StrateMineureCreate) -> StrateMineure:
    # La majeure parente doit exister.
    if get_majeure(db, data.strate_majeure_id) is None:
        raise ValueError("La strate majeure parente est introuvable.")

    obj = StrateMineure(
        libelle=data.libelle,
        description=data.description,
        strate_majeure_id=data.strate_majeure_id,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_mineure(
    db: Session, mineure_id: int, data: StrateMineureUpdate
) -> StrateMineure:
    obj = get_mineure(db, mineure_id)
    if obj is None:
        raise ValueError("Strate mineure introuvable.")

    payload = data.model_dump(exclude_unset=True)

    # Si on change de majeure, elle doit exister.
    nouvelle_majeure = payload.get("strate_majeure_id")
    if nouvelle_majeure and nouvelle_majeure != obj.strate_majeure_id:
        if get_majeure(db, nouvelle_majeure) is None:
            raise ValueError("La nouvelle strate majeure est introuvable.")

    for champ, valeur in payload.items():
        setattr(obj, champ, valeur)

    db.commit()
    db.refresh(obj)
    return obj


def delete_mineure(db: Session, mineure_id: int) -> None:
    obj = get_mineure(db, mineure_id)
    if obj is None:
        raise ValueError("Strate mineure introuvable.")

    # [À activer quand Debarcadere.strate_mineure_id existera]
    # nb = db.query(Debarcadere).filter(
    #     Debarcadere.strate_mineure_id == mineure_id
    # ).count()
    # if nb > 0:
    #     raise ValueError(
    #         f"Suppression impossible : {nb} débarcadère(s) rattaché(s)."
    #     )

    db.delete(obj)
    db.commit()
