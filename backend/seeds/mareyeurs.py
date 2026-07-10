# app/scripts/seed_mareyeurs.py
# Module Mareyeurs - SIGDP-GABON
# Génération de données de test réalistes (contexte gabonais)
#
# Usage :
#   python -m app.scripts.seed_mareyeurs            # insère les données
#   python -m app.scripts.seed_mareyeurs --reset    # purge le module puis insère
#
# Les données sont reproductibles (random.seed fixe) et couvrent tous les cas :
#   - mareyeurs actifs / suspendus / radiés, personnes physiques et morales
#   - agréments dans TOUS les statuts, dont un délivré déjà expiré
#     (pour tester la transition automatique delivre -> expire à la lecture)
#   - une chaîne de renouvellement (renouvele_de_id)
#   - installations avec et sans coordonnées (test du filtrage Leaflet
#     des valeurs NULL pour éviter les marqueurs à 0,0)
#   - ~200 transactions sur 6 mois pour alimenter les statistiques Chart.js

import argparse
import random
from datetime import date, timedelta
import sys
from pathlib import Path
import importlib
import pkgutil

# Ajoute backend/ au chemin Python pour résoudre le package app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi import Depends
from sqlalchemy.orm import Session, selectinload

from app.database import get_db, SessionLocal  # <-- adapter selon votre projet

from app.models.mareyeur import (
    Mareyeur,
    AgrementMareyage,
    InstallationMareyage,
    TransactionAchat,
)
import app.models

for module in pkgutil.walk_packages(app.models.__path__, prefix="app.models."):
    importlib.import_module(module.name)

random.seed(2026)

ANNEE = 2026

# ---------------------------------------------------------------------------
# Référentiels de test
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

PRENOMS_H = [
    "Jean-Claude",
    "Guy-Roger",
    "Hervé",
    "Christian",
    "Patrick",
    "Serge",
    "Aimé",
    "Rodrigue",
]
PRENOMS_F = [
    "Marcelle",
    "Pierrette",
    "Sylvie",
    "Nadège",
    "Ruth",
    "Émilienne",
    "Clarisse",
    "Georgette",
]

SOCIETES = [
    ("GABON MARÉE SARL", "Libreville"),
    ("OGOOUÉ FISH SA", "Port-Gentil"),
    ("ATLANTIC PÊCHE GABON", "Owendo"),
    ("SOPEGA - Société de Pêche du Gabon", "Libreville"),
    ("NYANGA SEAFOOD SARL", "Mayumba"),
]

PROVINCES = ["Estuaire", "Ogooué-Maritime", "Nyanga", "Moyen-Ogooué"]

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

# Prix indicatifs FCFA/kg par espèce (fourchettes)
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


def tel() -> str:
    return (
        f"+241 0{random.choice([6, 7])} {random.randint(10, 99)} "
        f"{random.randint(10, 99)} {random.randint(10, 99)}"
    )


def nif() -> str:
    return f"{random.randint(100000, 999999)} {random.choice('ABCDEFGH')}"


def rccm() -> str:
    return f"GA-LBV-{ANNEE - random.randint(1, 8)}-B-{random.randint(1000, 9999)}"


def code(prefixe: str, n: int) -> str:
    return f"{prefixe}-{ANNEE}-{str(n).zfill(4)}"


# ---------------------------------------------------------------------------
# Génération
# ---------------------------------------------------------------------------


def purger(db) -> None:
    db.query(TransactionAchat).delete()
    db.query(InstallationMareyage).delete()
    db.query(AgrementMareyage).delete()
    db.query(Mareyeur).delete()
    db.commit()
    print("Module mareyeurs purgé.")


def creer_mareyeurs(db) -> list:
    mareyeurs = []
    numero = 1

    # 10 personnes physiques
    for i in range(10):
        sexe = random.choice(["M", "F"])
        prenom = random.choice(PRENOMS_H if sexe == "M" else PRENOMS_F)
        zones = random.sample(PROVINCES, k=random.randint(1, 2))
        sites = random.sample(SITES, k=random.randint(1, 3))
        m = Mareyeur(
            code=code("MAR", numero),
            type_personne="physique",
            nom=random.choice(NOMS),
            prenom=prenom,
            sexe=sexe,
            date_naissance=date(
                random.randint(1965, 1998), random.randint(1, 12), random.randint(1, 28)
            ),
            lieu_naissance=random.choice(
                ["Libreville", "Port-Gentil", "Lambaréné", "Oyem", "Tchibanga"]
            ),
            nationalite="Gabonaise",
            nif=nif(),
            telephone=tel(),
            email=None if random.random() < 0.4 else f"mareyeur{numero}@exemple.ga",
            adresse=f"Quartier {random.choice(['Nzeng-Ayong', 'Akébé', 'PK8', 'Lalala', 'Glass'])}, Libreville",
            zones_activite=", ".join(zones),
            sites_debarquement=", ".join(sites),
            # 7 actifs, 2 suspendus, 1 radié
            statut="actif" if i < 7 else ("suspendu" if i < 9 else "radie"),
        )
        db.add(m)
        mareyeurs.append(m)
        numero += 1

    # 5 personnes morales
    for raison, ville in SOCIETES:
        zones = random.sample(PROVINCES, k=random.randint(1, 3))
        sites = random.sample(SITES, k=random.randint(2, 4))
        m = Mareyeur(
            code=code("MAR", numero),
            type_personne="morale",
            raison_sociale=raison,
            nif=nif(),
            rccm=rccm(),
            telephone=tel(),
            email=f"contact@{raison.split()[0].lower().replace('é', 'e')}.ga",
            adresse=f"Zone portuaire, {ville}",
            zones_activite=", ".join(zones),
            sites_debarquement=", ".join(sites),
            statut="actif",
        )
        db.add(m)
        mareyeurs.append(m)
        numero += 1

    db.commit()
    for m in mareyeurs:
        db.refresh(m)
    print(f"{len(mareyeurs)} mareyeurs créés.")
    return mareyeurs


def creer_agrements(db, mareyeurs: list) -> None:
    numero = 1
    aujourd_hui = date.today()

    def ajouter(
        mareyeur,
        statut,
        delivrance=None,
        duree=12,
        categorie=None,
        motif=None,
        renouvele_de=None,
    ):
        nonlocal numero
        expiration = None
        if delivrance:
            # approximation simple pour le seed : duree mois ~ duree*30 jours
            expiration = delivrance + timedelta(days=duree * 30)
        a = AgrementMareyage(
            code=code("AGR-MAR", numero),
            mareyeur_id=mareyeur.id,
            categorie=categorie
            or random.choice(
                ["mareyeur_simple", "mareyeur_simple", "mareyeur_exportateur"]
            ),
            date_demande=(delivrance or aujourd_hui)
            - timedelta(days=random.randint(7, 45)),
            date_delivrance=delivrance,
            duree_validite_mois=duree,
            date_expiration=expiration,
            montant_redevance=random.choice([50000, 75000, 100000, 150000]),
            statut=statut,
            motif_statut=motif,
            renouvele_de_id=renouvele_de,
        )
        db.add(a)
        numero += 1
        return a

    actifs = [m for m in mareyeurs if m.statut == "actif"]

    # Agréments délivrés en cours de validité (majorité des actifs)
    for m in actifs[:8]:
        ajouter(
            m,
            "delivre",
            delivrance=aujourd_hui - timedelta(days=random.randint(30, 200)),
        )

    # Un délivré expirant sous 30 jours (test endpoint /agrements/expirant)
    ajouter(
        actifs[8], "delivre", delivrance=aujourd_hui - timedelta(days=340), duree=12
    )

    # Un délivré DÉJÀ expiré en base (test transition automatique -> expire)
    ajouter(
        actifs[9], "delivre", delivrance=aujourd_hui - timedelta(days=450), duree=12
    )

    # Chaîne de renouvellement : ancien expiré -> nouveau délivré
    ancien = ajouter(
        actifs[0],
        "expire",
        delivrance=aujourd_hui - timedelta(days=420),
        duree=12,
        motif="Renouvellement anticipé",
    )
    db.commit()
    db.refresh(ancien)
    ajouter(
        actifs[0],
        "delivre",
        delivrance=aujourd_hui - timedelta(days=50),
        duree=12,
        categorie=ancien.categorie,
        renouvele_de=ancien.id,
    )

    # Suspendu et retiré (rattachés aux mareyeurs suspendus/radié)
    suspendus = [m for m in mareyeurs if m.statut == "suspendu"]
    radies = [m for m in mareyeurs if m.statut == "radie"]
    if suspendus:
        ajouter(
            suspendus[0],
            "suspendu",
            delivrance=aujourd_hui - timedelta(days=100),
            motif="Non-respect des conditions sanitaires de stockage",
        )
    if radies:
        ajouter(
            radies[0],
            "retire",
            delivrance=aujourd_hui - timedelta(days=250),
            motif="Infractions répétées constatées par la surveillance",
        )

    # Demandes en instruction (sans date de délivrance)
    for m in random.sample(actifs, k=3):
        ajouter(m, "en_instruction")

    db.commit()
    print(f"{numero - 1} agréments créés.")


def creer_installations(db, mareyeurs: list) -> None:
    types = ["chambre_froide", "vehicule_frigorifique", "entrepot", "etal"]
    compteur = 0
    for m in mareyeurs:
        if m.statut == "radie":
            continue
        for _ in range(random.randint(1, 3)):
            t = random.choice(types)
            avec_coords = random.random() < 0.6  # 40 % sans coordonnées (test NULL)
            inst = InstallationMareyage(
                mareyeur_id=m.id,
                type_installation=t,
                designation={
                    "chambre_froide": f"Chambre froide {random.choice(['A', 'B', 'principale'])}",
                    "vehicule_frigorifique": f"Camion frigorifique {random.randint(3, 12)}T",
                    "entrepot": "Entrepôt de stockage",
                    "etal": f"Étal marché {random.choice(['Mont-Bouët', 'Nkembo', 'Oloumi', 'Grand Village'])}",
                }[t],
                capacite_tonnes=(
                    round(random.uniform(0.5, 15), 1) if t != "etal" else None
                ),
                immatriculation=(
                    f"GA-{random.randint(1000, 9999)}-"
                    f"{random.choice(['LBV', 'POG'])}"
                    if t == "vehicule_frigorifique"
                    else None
                ),
                adresse=f"{random.choice(SITES)}",
                # Emprise approximative Libreville/littoral gabonais
                latitude=round(random.uniform(-3.9, 0.6), 6) if avec_coords else None,
                longitude=round(random.uniform(8.7, 11.0), 6) if avec_coords else None,
                statut="fonctionnelle" if random.random() < 0.85 else "hors_service",
            )
            db.add(inst)
            compteur += 1
    db.commit()
    print(f"{compteur} installations créées.")


def creer_transactions(db, mareyeurs: list) -> None:
    aujourd_hui = date.today()
    debut = aujourd_hui - timedelta(days=180)  # 6 mois d'historique
    eligibles = [m for m in mareyeurs if m.statut == "actif"]

    numero = 1
    for _ in range(200):
        m = random.choice(eligibles)
        espece = random.choice(ESPECES)
        quantite = round(random.uniform(15, 600), 1)
        prix = random.randint(*PRIX[espece])
        sites_m = [
            s.strip() for s in (m.sites_debarquement or "").split(",") if s.strip()
        ] or SITES
        t = TransactionAchat(
            code=code("TRX-MAR", numero),
            mareyeur_id=m.id,
            date_transaction=debut + timedelta(days=random.randint(0, 180)),
            site_debarquement=random.choice(sites_m),
            pecheur=(
                f"{random.choice(NOMS)} " f"{random.choice(PRENOMS_H + PRENOMS_F)}"
                if random.random() < 0.8
                else None
            ),
            pirogue=random.choice(PIROGUES),
            espece=espece,
            quantite_kg=quantite,
            prix_unitaire_fcfa=float(prix),
            montant_total_fcfa=round(quantite * prix, 2),
        )
        db.add(t)
        numero += 1
    db.commit()
    print(f"{numero - 1} transactions créées.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Génération de données de test - module mareyeurs SIGDP"
    )
    parser.add_argument(
        "--reset", action="store_true", help="Purge le module avant insertion"
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.reset:
            purger(db)
        elif db.query(Mareyeur).count() > 0:

            print(
                "Des mareyeurs existent déjà. Utilisez --reset pour purger "
                "avant insertion. Abandon."
            )
            return

        mareyeurs = creer_mareyeurs(db)
        creer_agrements(db, mareyeurs)
        creer_installations(db, mareyeurs)
        creer_transactions(db, mareyeurs)
        print("\nDonnées de test générées avec succès.")
    finally:
        db.close()
        print("Init terminated")


if __name__ == "__main__":
    main()
