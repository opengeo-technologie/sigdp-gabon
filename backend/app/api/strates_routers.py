from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db  # adaptez à votre projet

from app.api import strate_crud_functions as crud
from app.schemas import strates as schemas

router = APIRouter(prefix="/api/strates", tags=["Strates majeures & mineures"])


# ═══════════════════════════════════════════════════════════════════════════
#  STRATES MAJEURES
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/majeures/creer", response_model=schemas.StrateMajeureRead)
def creer_majeure(data: schemas.StrateMajeureCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_majeure(db, data)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/majeures/lister", response_model=List[schemas.StrateMajeureRead])
def lister_majeures(
    filtre: schemas.StrateMajeureFiltre = schemas.StrateMajeureFiltre(),
    db: Session = Depends(get_db),
):
    return crud.list_majeures(db, filtre)


@router.post("/majeures/detail", response_model=schemas.StrateMajeureRead)
def detail_majeure(payload: schemas.IdIn, db: Session = Depends(get_db)):
    obj = crud.get_majeure(db, payload.id)
    if obj is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Strate majeure introuvable."
        )
    return obj


@router.post("/majeures/modifier", response_model=schemas.StrateMajeureRead)
def modifier_majeure(
    payload: schemas.StrateMajeureUpdate,
    id: int,
    db: Session = Depends(get_db),
):
    try:
        return crud.update_majeure(db, id, payload)
    except ValueError as e:
        msg = str(e)
        code = (
            status.HTTP_404_NOT_FOUND
            if "introuvable" in msg
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(code, detail=msg)


@router.post("/majeures/supprimer")
def supprimer_majeure(payload: schemas.IdIn, db: Session = Depends(get_db)):
    try:
        crud.delete_majeure(db, payload.id)
    except ValueError as e:
        msg = str(e)
        code = (
            status.HTTP_404_NOT_FOUND
            if "introuvable" in msg
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(code, detail=msg)
    return {"success": True, "message": "Strate majeure supprimée."}


@router.post("/majeures/arborescence", response_model=List[schemas.StrateMajeureArbre])
def arborescence_majeures(
    filtre: schemas.StrateMajeureFiltre = schemas.StrateMajeureFiltre(),
    db: Session = Depends(get_db),
):
    """Majeures avec leurs mineures imbriquées (vue enquête-cadre)."""
    # domaine = filtre.domaine.value if filtre and filtre.domaine else None
    return crud.arborescence(db)


# ═══════════════════════════════════════════════════════════════════════════
#  STRATES MINEURES
# ═══════════════════════════════════════════════════════════════════════════
@router.post("/mineures/creer", response_model=schemas.StrateMineureRead)
def creer_mineure(data: schemas.StrateMineureCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_mineure(db, data)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/mineures/lister", response_model=List[schemas.StrateMineureRead])
def lister_mineures(
    filtre: schemas.StrateMineureFiltre = schemas.StrateMineureFiltre(),
    db: Session = Depends(get_db),
):
    return crud.list_mineures(db, filtre)


@router.post("/mineures/detail", response_model=schemas.StrateMineureRead)
def detail_mineure(payload: schemas.IdIn, db: Session = Depends(get_db)):
    obj = crud.get_mineure(db, payload.id)
    if obj is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Strate mineure introuvable."
        )
    return obj


@router.post("/mineures/modifier", response_model=schemas.StrateMineureRead)
def modifier_mineure(
    payload: schemas.StrateMineureUpdate,
    id: int,
    db: Session = Depends(get_db),
):
    try:
        return crud.update_mineure(db, id, payload)
    except ValueError as e:
        msg = str(e)
        code = (
            status.HTTP_404_NOT_FOUND
            if "introuvable" in msg
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(code, detail=msg)


@router.post("/mineures/supprimer")
def supprimer_mineure(payload: schemas.IdIn, db: Session = Depends(get_db)):
    try:
        crud.delete_mineure(db, payload.id)
    except ValueError as e:
        msg = str(e)
        code = (
            status.HTTP_404_NOT_FOUND
            if "introuvable" in msg
            else status.HTTP_409_CONFLICT
        )
        raise HTTPException(code, detail=msg)
    return {"success": True, "message": "Strate mineure supprimée."}
