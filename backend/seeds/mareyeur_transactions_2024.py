# backend/seeds/transactions_2024.py
# Module Mareyeurs - SIGDP-GABON
# Génération de transactions d'achat pour l'année 2024 (historique)
#
# Suppose que les mareyeurs sont déjà présents (script mareyeurs.py déjà lancé).
# N'affecte que la table transactions_achat_mareyage.
#
# Usage (depuis backend/) :
#   python3 -m seeds.transactions_2024              # ajoute les transactions
#   python3 -m seeds.transactions_2024 --reset      # purge 2024 puis réinsère
#   python3 -m seeds.transactions_2024 --nb 500     # nombre de transactions

import argparse
import importlib
import pkgutil
import random
import sys
from datetime import date, timedelta
from pathlib import Path

# Ajoute backend/ au chemin Python
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal  # noqa: E402

# Charge TOUS les modèles pour éviter les erreurs de résolution
# des relationships déclarées par nom
import app.models  # noqa: E402

for module in pkgutil.walk_packages(app.models.__path__, prefix="app.models."):
    try:
        importlib.import_module(module.name)
    except Exception as e:
        print(f"[warn] import {module.name} ignoré : {e}")

from sqlalchemy import extract, func, select  # noqa: E402
from app.models.mareyeur import Mareyeur, TransactionAchat  # noqa: E402

ANNEE = 2024
random.seed(2024)  # reproductibilité

# ---------------------------------------------------------------------------
# Référentiels (mêmes que le seed principal)
# ---------------------------------------------------------------------------

NOMS = [
    "Ondo",
    "Obame",
    "Nzue",
    "Mba",
    "Nguema",
    "Moussavou",
    "Mbadinga",
    "Koumba",
    "Bouanga",
    "Ndong",
    "Mintsa",
    "Ella",
    "Allogho",
    "Bivigou",
]
PRENOMS = [
    "Jean-Claude",
    "Guy-Roger",
    "Hervé",
    "Christian",
    "Patrick",
    "Marcelle",
    "Pierrette",
    "Sylvie",
    "Nadège",
    "Ruth",
]

SITES = [
    "Port Môle (Libreville)",
    "Owendo",
    "Cap Estérias",
    "Cocobeach",
    "Port-Gentil",
    "Omboué",
    "Gamba",
    "Mayumba",
    "Lambaréné",
]

ESPECES = [
    "Bar",
    "Capitaine",
    "Machoiron",
    "Sardinelle",
    "Bossu",
    "Sole",
    "Dorade",
    "Thon obèse",
    "Crevette rose",
    "Mérou",
    "Carpe rouge",
    "Pageot",
]

PRIX = {
    "Bar": (2500, 4000),
    "Capitaine": (3000, 5000),
    "Machoiron": (1500, 2500),
    "Sardinelle": (800, 1500),
    "Bossu": (2000, 3500),
    "Sole": (3500, 5500),
    "Dorade": (2500, 4000),
    "Thon obèse": (2000, 3500),
    "Crevette rose": (5000, 8000),
    "Mérou": (3500, 6000),
    "Carpe rouge": (2500, 4500),
    "Pageot": (1800, 3000),
}

PIROGUES = [
    "Espérance",
    "La Grâce de Dieu",
    "Bénédiction",
    "Mami Wata",
    "Le Voyageur",
    "Étoile de Mer",
    "Providence",
    None,
    None,
]

# Répartition états du poisson (frais ≈ 85 %, fumé ≈ 10 %, salé ≈ 5 %)
ETATS = ["frais", "fume", "sale"]
POIDS_ETATS = [85, 10, 5]

# Saisonnalité : facteurs multiplicatifs par mois (janv=1..déc=12)
# Pic de saison sèche (juin-septembre) où les captures sont plus abondantes.
SAISONNALITE_MOIS = {
    1: 0.9,
    2: 0.8,
    3: 0.9,
    4: 1.0,
    5: 1.1,
    6: 1.3,
    7: 1.4,
    8: 1.4,
    9: 1.3,
    10: 1.1,
    11: 0.9,
    12: 0.8,
}


# ---------------------------------------------------------------------------


def prochain_numero(db) -> int:
    """Numéro suivant pour les codes TRX-MAR-2024-XXXX (repart de zéro pour 2024)."""
    motif = f"TRX-MAR-{ANNEE}-%"
    compteur = (
        db.execute(
            select(func.count())
            .select_from(TransactionAchat)
            .where(TransactionAchat.code.like(motif))
        ).scalar()
        or 0
    )
    return compteur + 1


def date_ponderee_par_saisonnalite() -> date:
    """Tire une date dans l'année selon la pondération saisonnière."""
    mois = random.choices(
        list(SAISONNALITE_MOIS.keys()),
        weights=list(SAISONNALITE_MOIS.values()),
        k=1,
    )[0]
    # jours du mois (approximation ; 28 pour rester safe en février)
    jours_max = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mois - 1]
    return date(ANNEE, mois, random.randint(1, jours_max))


def purger_2024(db) -> int:
    """Supprime toutes les transactions de l'année 2024."""
    nb = (
        db.execute(
            select(func.count())
            .select_from(TransactionAchat)
            .where(extract("year", TransactionAchat.date_transaction) == ANNEE)
        ).scalar()
        or 0
    )
    if nb:
        db.query(TransactionAchat).filter(
            extract("year", TransactionAchat.date_transaction) == ANNEE
        ).delete(synchronize_session=False)
        db.commit()
    print(f"{nb} transaction(s) 2024 supprimée(s).")
    return nb


def creer_transactions(db, nombre: int) -> None:
    # Mareyeurs actifs éligibles
    eligibles = (
        db.execute(select(Mareyeur).where(Mareyeur.statut == "actif")).scalars().all()
    )
    if not eligibles:
        print("Aucun mareyeur actif : lancez d'abord `python3 -m seeds.mareyeurs`.")
        return

    print(f"Génération de {nombre} transactions pour {ANNEE}...")
    print(
        f"  {len(eligibles)} mareyeur(s) actif(s), "
        f"{len(ESPECES)} espèces, saisonnalité pondérée juin-septembre."
    )

    numero = prochain_numero(db)
    for _ in range(nombre):
        m = random.choice(eligibles)
        espece = random.choice(ESPECES)
        etat = random.choices(ETATS, weights=POIDS_ETATS, k=1)[0]
        quantite = round(random.uniform(15, 600), 1)
        prix = random.randint(*PRIX[espece])
        sites_m = [
            s.strip() for s in (m.sites_debarquement or "").split(",") if s.strip()
        ] or SITES

        t = TransactionAchat(
            code=f"TRX-MAR-{ANNEE}-{str(numero).zfill(4)}",
            mareyeur_id=m.id,
            date_transaction=date_ponderee_par_saisonnalite(),
            site_debarquement=random.choice(sites_m),
            pecheur=(
                f"{random.choice(NOMS)} {random.choice(PRENOMS)}"
                if random.random() < 0.8
                else None
            ),
            pirogue=random.choice(PIROGUES),
            espece=espece,
            etat_poisson=etat,
            quantite_kg=quantite,
            prix_unitaire_fcfa=float(prix),
            montant_total_fcfa=round(quantite * prix, 2),
        )
        db.add(t)
        numero += 1

    db.commit()
    print(f"{nombre} transaction(s) 2024 créée(s).")


def afficher_repartition(db) -> None:
    """Récapitulatif : volume par mois et par état pour 2024."""
    print("\nRépartition 2024 :")

    par_mois = db.execute(
        select(
            extract("month", TransactionAchat.date_transaction).label("mois"),
            func.count(),
            func.sum(TransactionAchat.quantite_kg),
            func.sum(TransactionAchat.montant_total_fcfa),
        )
        .where(extract("year", TransactionAchat.date_transaction) == ANNEE)
        .group_by("mois")
        .order_by("mois")
    ).all()

    print(f"  {'Mois':<10} {'Nb':>4} {'Volume (kg)':>12} {'Montant (FCFA)':>18}")
    for r in par_mois:
        print(
            f"  {int(r.mois):<10} {r[1]:>4} {float(r[2]):>12,.0f} {float(r[3]):>18,.0f}"
        )

    par_etat = db.execute(
        select(
            TransactionAchat.etat_poisson,
            func.count(),
            func.sum(TransactionAchat.quantite_kg),
        )
        .where(extract("year", TransactionAchat.date_transaction) == ANNEE)
        .group_by(TransactionAchat.etat_poisson)
    ).all()

    print(f"\n  {'État':<10} {'Nb':>4} {'Volume (kg)':>12}")
    for etat, nb, vol in par_etat:
        print(f"  {etat:<10} {nb:>4} {float(vol):>12,.0f}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Génération de transactions mareyeurs pour 2024 (SIGDP)"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Purge les transactions 2024 avant insertion",
    )
    parser.add_argument(
        "--nb",
        type=int,
        default=300,
        help="Nombre de transactions à créer (défaut : 300)",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.reset:
            purger_2024(db)
        else:
            existantes = (
                db.execute(
                    select(func.count())
                    .select_from(TransactionAchat)
                    .where(extract("year", TransactionAchat.date_transaction) == ANNEE)
                ).scalar()
                or 0
            )
            if existantes > 0:
                print(
                    f"{existantes} transaction(s) 2024 existent déjà. "
                    "Utilisez --reset pour les remplacer. Abandon."
                )
                return

        creer_transactions(db, args.nb)
        afficher_repartition(db)
        print("\nSeed 2024 terminé.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
