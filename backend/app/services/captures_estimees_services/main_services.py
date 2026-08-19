"""
SIGPA — Module « Captures estimées »
Couche service (ORM synchrone). Contient la logique métier : CRUD, upsert,
agrégats prêts pour Chart.js et helpers de référentiels.
"""

from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import captures_estimees as models
from app.models.espece import Espece
from app.models.engin_peche import EnginPeche
from app.schemas import captures_estimees as schemas

MOIS_LIBELLES = schemas.MOIS_LIBELLES


# ---------------------------------------------------------------------------
# Référentiels
# ---------------------------------------------------------------------------
def get_ou_cree_engin(
    db: Session, libelle: str, agrege: bool = False
) -> tuple[EnginPeche, bool]:
    libelle = (libelle or "").strip()
    code = _slug(libelle) or "ENGIN"
    engin = db.execute(
        select(EnginPeche).where(EnginPeche.libelle == libelle)
    ).scalar_one_or_none()
    if engin:
        return engin, False
    engin = EnginPeche(libelle=libelle)
    db.add(engin)
    db.flush()
    return engin, True


def get_ou_cree_espece(
    db: Session, nom: str, groupe: Optional[models.GroupeEspece] = None
) -> tuple[Espece, bool]:
    nom = (nom or "").strip()
    code = _slug(nom) or "ESP"
    esp = db.execute(
        select(Espece).where(Espece.nom_commun_francais == nom)
    ).scalar_one_or_none()
    if esp:
        if groupe and not esp.groupe:  # complète le groupe si manquant
            esp.groupe = groupe
            db.flush()
        return esp, False
    esp = Espece(code=code, nom_commun_francais=nom, groupe=groupe, actif=True)
    db.add(esp)
    db.flush()
    return esp, True


def lister_engins(db: Session) -> list[EnginPeche]:
    return list(
        db.execute(
            select(EnginPeche)
            # .where(EnginPeche.actif.is_(True))
            .order_by(EnginPeche.libelle)
        ).scalars()
    )


def lister_especes(db: Session) -> list[Espece]:
    return list(
        db.execute(
            select(Espece)
            .where(Espece.actif.is_(True))
            .order_by(Espece.nom_commun_francais)
        ).scalars()
    )


# ---------------------------------------------------------------------------
# Captures — CRUD
# ---------------------------------------------------------------------------
def _base_query(db: Session):
    return select(models.CaptureEstimee).options(
        joinedload(models.CaptureEstimee.engin),
        joinedload(models.CaptureEstimee.espece),
        joinedload(models.CaptureEstimee.strate_mineure),
    )


def _appliquer_filtre(stmt, f: schemas.CaptureFiltre):
    C = models.CaptureEstimee
    if f.annee is not None:
        stmt = stmt.where(C.annee == f.annee)
    if f.mois is not None:
        stmt = stmt.where(C.mois == f.mois)
    if f.engin_id is not None:
        stmt = stmt.where(C.engin_id == f.engin_id)
    if f.espece_id is not None:
        stmt = stmt.where(C.espece_id == f.espece_id)
    if f.strate_mineure_id is not None:
        stmt = stmt.where(C.strate_mineure_id == f.strate_mineure_id)
    if f.groupe is not None:
        stmt = stmt.join(Espece).where(
            Espece.categorie == models.GroupeEspece(f.groupe.value)
        )
    return stmt


_COLS_TRI = {
    "annee": models.CaptureEstimee.annee,
    "mois": models.CaptureEstimee.mois,
    "capture_kg": models.CaptureEstimee.capture_kg,
    "valeur_fcfa": models.CaptureEstimee.valeur_fcfa,
}


def lister_captures(db: Session, f: schemas.CaptureFiltre) -> schemas.CaptureListe:
    stmt = _appliquer_filtre(_base_query(db), f)

    total = db.execute(
        _appliquer_filtre(select(func.count(models.CaptureEstimee.id)), f)
    ).scalar_one()

    for col in [c.strip() for c in f.tri.split(",") if c.strip()]:
        desc = col.startswith("-")
        col_name = col.lstrip("-")
        if col_name in _COLS_TRI:
            c = _COLS_TRI[col_name]
            stmt = stmt.order_by(c.desc() if desc else c.asc())

    stmt = stmt.offset((f.page - 1) * f.taille_page).limit(f.taille_page)
    elements = [
        schemas.CaptureOut.depuis_orm(c) for c in db.execute(stmt).scalars().unique()
    ]
    return schemas.CaptureListe(
        total=total, page=f.page, taille_page=f.taille_page, elements=elements
    )


def get_capture(db: Session, capture_id: int) -> Optional[models.CaptureEstimee]:
    return db.execute(
        _base_query(db).where(models.CaptureEstimee.id == capture_id)
    ).scalar_one_or_none()


def creer_capture(db: Session, data: schemas.CaptureCreate) -> models.CaptureEstimee:
    existante = db.execute(
        select(models.CaptureEstimee).where(
            models.CaptureEstimee.annee == data.annee,
            models.CaptureEstimee.mois == data.mois,
            models.CaptureEstimee.engin_id == data.engin_id,
            models.CaptureEstimee.espece_id == data.espece_id,
            models.CaptureEstimee.strate_mineure_id == data.strate_mineure_id,
            models.CaptureEstimee.valeur_fcfa == data.valeur_fcfa,
        )
    ).scalar_one_or_none()
    if existante is not None:
        raise ValueError(
            "Une capture estimée existe déjà pour cette combinaison "
            "année / mois / engin / espèce/ strate mineure."
        )
    c = models.CaptureEstimee(**data.model_dump())
    db.add(c)
    db.commit()
    return get_capture(db, c.id)


def maj_capture(
    db: Session, capture_id: int, data: schemas.CaptureUpdate
) -> models.CaptureEstimee:
    c = get_capture(db, capture_id)
    if c is None:
        raise LookupError("Capture estimée introuvable.")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    return get_capture(db, capture_id)


def supprimer_capture(db: Session, capture_id: int) -> None:
    c = db.get(models.CaptureEstimee, capture_id)
    if c is None:
        raise LookupError("Capture estimée introuvable.")
    db.delete(c)
    db.commit()


def upsert_capture(
    db: Session, annee, mois, engin_id, espece_id, capture_kg, valeur_fcfa, source
) -> models.CaptureEstimee:
    """Insère ou met à jour la cellule (utilisé par l'import)."""
    c = db.execute(
        select(models.CaptureEstimee).where(
            models.CaptureEstimee.annee == annee,
            models.CaptureEstimee.mois == mois,
            models.CaptureEstimee.engin_id == engin_id,
            models.CaptureEstimee.espece_id == espece_id,
        )
    ).scalar_one_or_none()
    if c is None:
        c = models.CaptureEstimee(
            annee=annee, mois=mois, engin_id=engin_id, espece_id=espece_id
        )
        db.add(c)
    c.capture_kg = float(capture_kg or 0)
    if valeur_fcfa is not None:  # None → ne pas écraser une valeur déjà saisie
        c.valeur_fcfa = float(valeur_fcfa)
    c.source = source
    return c


# ---------------------------------------------------------------------------
# Efforts — upsert & lecture
# ---------------------------------------------------------------------------
def upsert_effort(db: Session, data: schemas.EffortUpsert) -> models.EffortEstime:
    e = db.execute(
        select(models.EffortEstime).where(
            models.EffortEstime.annee == data.annee,
            models.EffortEstime.mois == data.mois,
            models.EffortEstime.engin_id == data.engin_id,
            models.EffortEstime.strate_mineure_id == data.strate_mineure_id,
        )
    ).scalar_one_or_none()
    if e is None:
        e = models.EffortEstime(
            annee=data.annee,
            mois=data.mois,
            engin_id=data.engin_id,
            strate_mineure_id=data.strate_mineure_id,
        )
        db.add(e)
    e.efforts_jours = data.efforts_jours
    e.nombre_debarquements = data.nombre_debarquements
    e.taux_echantillonnage = data.taux_echantillonnage
    # db.commit()
    return e


def lister_efforts(
    db: Session, annee: int, engin_id: Optional[int] = None
) -> list[schemas.EffortOut]:
    stmt = (
        select(models.EffortEstime)
        .options(joinedload(models.EffortEstime.engin))
        .where(models.EffortEstime.annee == annee)
        .order_by(models.EffortEstime.engin_id, models.EffortEstime.mois)
    )
    if engin_id is not None:
        stmt = stmt.where(models.EffortEstime.engin_id == engin_id)

    # captures totales par (engin, mois) pour le calcul de la CPUE
    tot: dict[tuple[int, int], float] = {}
    for eid, mois, s in db.execute(
        select(
            models.CaptureEstimee.engin_id,
            models.CaptureEstimee.mois,
            func.coalesce(func.sum(models.CaptureEstimee.capture_kg), 0.0),
        )
        .where(models.CaptureEstimee.annee == annee)
        .group_by(models.CaptureEstimee.engin_id, models.CaptureEstimee.mois)
    ).all():
        tot[(eid, mois)] = float(s)

    out: list[schemas.EffortOut] = []
    for e in db.execute(stmt).scalars():
        captures = tot.get((e.engin_id, e.mois), 0.0)
        cpue = round(captures / e.efforts_jours, 4) if e.efforts_jours else None
        out.append(
            schemas.EffortOut(
                id=e.id,
                annee=e.annee,
                mois=e.mois,
                mois_libelle=MOIS_LIBELLES[e.mois - 1],
                engin_id=e.engin_id,
                engin_libelle=e.engin.libelle if e.engin else None,
                strate_mineure_id=e.strate_mineure_id,
                strate_mineure_libelle=(
                    e.strate_mineure.libelle if e.strate_mineure else None
                ),
                efforts_jours=e.efforts_jours,
                nombre_debarquements=e.nombre_debarquements,
                taux_echantillonnage=e.taux_echantillonnage,
                cpue_kg_jour=cpue,
            )
        )
    return out


# ---------------------------------------------------------------------------
# Statistiques (JSON prêt Chart.js)
# ---------------------------------------------------------------------------
def statistiques(db: Session, req: schemas.StatsRequete) -> dict:
    """
    Renvoie un ensemble d'agrégats pour l'année demandée :
      - mensuel : captures (t) et valeur (M f.CFA) par mois
      - par_engin : captures (t) par engin
      - par_groupe : captures (t) par groupe d'espèces
      - top_especes : 10 espèces les plus capturées (t)
      - cpue_mensuel : CPUE (kg/jr) par mois (tous engins réels)
      - kpi : totaux annuels
    Les engins agrégés (« TOTAL ») sont exclus pour éviter le double comptage.
    """
    C = models.CaptureEstimee
    base = select(C).join(EnginPeche).where(C.annee == req.annee)
    if req.engin_id is not None:
        base = base.where(C.engin_id == req.engin_id)

    def _where():
        w = [C.annee == req.annee]
        if req.engin_id is not None:
            w.append(C.engin_id == req.engin_id)
        return w

    # -- mensuel
    mens = db.execute(
        select(
            C.mois,
            func.coalesce(func.sum(C.capture_kg), 0.0),
            func.coalesce(func.sum(C.valeur_fcfa), 0.0),
        )
        .join(EnginPeche)
        .where(*_where())
        .group_by(C.mois)
        .order_by(C.mois)
    ).all()
    mens_map = {m: (kg, val) for m, kg, val in mens}
    mensuel = {
        "labels": MOIS_LIBELLES,
        "captures_tonnes": [
            round(mens_map.get(i, (0, 0))[0] / 1000, 2) for i in range(1, 13)
        ],
        "valeur_millions_fcfa": [
            round(mens_map.get(i, (0, 0))[1] / 1_000_000, 2) for i in range(1, 13)
        ],
    }

    # -- par engin
    par_engin = db.execute(
        select(EnginPeche.libelle, func.coalesce(func.sum(C.capture_kg), 0.0))
        .select_from(C)
        .join(EnginPeche)
        .where(*_where())
        .group_by(EnginPeche.libelle)
        .order_by(func.sum(C.capture_kg).desc())
    ).all()

    # -- par groupe
    par_groupe = db.execute(
        select(Espece.categorie, func.coalesce(func.sum(C.capture_kg), 0.0))
        .select_from(C)
        .join(Espece)
        .join(EnginPeche)
        .where(*_where())
        .group_by(Espece.categorie)
    ).all()

    # -- top espèces
    top = db.execute(
        select(Espece.nom_commun_francais, func.coalesce(func.sum(C.capture_kg), 0.0))
        .select_from(C)
        .join(Espece)
        .join(EnginPeche)
        .where(*_where())
        .group_by(Espece.nom_commun_francais)
        .order_by(func.sum(C.capture_kg).desc())
        .limit(10)
    ).all()

    # -- CPUE mensuel (captures réelles / efforts réels)
    eff = dict(
        db.execute(
            select(
                models.EffortEstime.mois,
                func.coalesce(func.sum(models.EffortEstime.efforts_jours), 0.0),
            )
            .join(EnginPeche)
            .where(
                models.EffortEstime.annee == req.annee,
            )
            .group_by(models.EffortEstime.mois)
        ).all()
    )
    cpue = []
    for i in range(1, 13):
        kg = mens_map.get(i, (0, 0))[0]
        jours = eff.get(i, 0.0)
        cpue.append(round(kg / jours, 2) if jours else 0.0)

    total_kg = sum(v[0] for v in mens_map.values())
    total_val = sum(v[1] for v in mens_map.values())

    # Total « toutes pêcheries » tel que fourni par le bloc agrégé du fichier
    # source (utile car, selon les fichiers, la somme par engin peut ne couvrir
    # qu'une partie des engins effectivement estimés).
    total_source_kg = db.execute(
        select(func.coalesce(func.sum(C.capture_kg), 0.0))
        .join(EnginPeche)
        .where(C.annee == req.annee)
    ).scalar_one()

    return {
        "annee": req.annee,
        "mensuel": mensuel,
        "par_engin": {
            "labels": [r[0] for r in par_engin],
            "tonnes": [round(r[1] / 1000, 2) for r in par_engin],
        },
        "par_groupe": {
            "labels": [(_groupe_label(g)) for g, _ in par_groupe],
            "tonnes": [round(v / 1000, 2) for _, v in par_groupe],
        },
        "top_especes": {
            "labels": [r[0] for r in top],
            "tonnes": [round(r[1] / 1000, 2) for r in top],
        },
        "cpue_mensuel": {"labels": MOIS_LIBELLES, "cpue_kg_jour": cpue},
        "kpi": {
            "captures_tonnes": round(total_kg / 1000, 2),
            "captures_tonnes_source": round(total_source_kg / 1000, 2),
            "valeur_millions_fcfa": round(total_val / 1_000_000, 2),
            "nb_especes": db.execute(
                select(func.count(func.distinct(C.espece_id)))
                .join(EnginPeche)
                .where(*_where())
            ).scalar_one(),
            "nb_engins": db.execute(
                select(func.count(func.distinct(C.engin_id)))
                .join(EnginPeche)
                .where(*_where())
            ).scalar_one(),
        },
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _groupe_label(g) -> str:
    return {
        models.GroupeEspece.PELAGIQUE: "Pélagiques",
        models.GroupeEspece.DEMERSAL: "Démersaux",
        models.GroupeEspece.CRUSTACE: "Crustacés",
        None: "Non classé",
    }.get(g, "Non classé")


def _slug(txt: str) -> str:
    import re
    import unicodedata

    txt = unicodedata.normalize("NFKD", txt or "").encode("ascii", "ignore").decode()
    txt = re.sub(r"[^A-Za-z0-9]+", "_", txt).strip("_").upper()
    return txt[:30]
