# -*- coding: utf-8 -*-
"""
Générateur de données de test — Module Stations Piscicoles (SIGDP-GABON)
Génère des stations et cycles de production aléatoires mais cohérents,
puis les insère en base via SessionLocal (SQLAlchemy synchrone).

Exécution :
    python -m app.seed.generate_test_stations_piscicoles
    python -m app.seed.generate_test_stations_piscicoles --stations 100
    python -m app.seed.generate_test_stations_piscicoles --reset
"""

import argparse
import random
from datetime import date, timedelta
import importlib
import pkgutil

from app.database import SessionLocal  # à ajuster selon l'arborescence
from app.models.stations_piscicole import (
    StationPiscicole,
    CycleProduction,
    TypeStationEnum,
    SourceEauEnum,
    TypePromoteurEnum,
    StatutStationEnum,
    StatutCycleEnum,
)
import app.models

for module in pkgutil.walk_packages(app.models.__path__, prefix="app.models."):
    importlib.import_module(module.name)

random.seed(42)  # reproductibilité — retirer pour des données différentes à chaque run

# ---------------------------------------------------------------------------
# Référentiels Gabon (provinces, départements, localités + coordonnées approx.)
# ---------------------------------------------------------------------------

LOCALISATIONS = [
    # (province, departement, localite, lat, lng)
    ("Estuaire", "Komo-Mondah", "Ntoum", 0.3901, 9.7671),
    ("Estuaire", "Komo-Mondah", "Owendo", 0.2833, 9.5000),
    ("Estuaire", "Libreville", "Libreville", 0.4162, 9.4673),
    ("Estuaire", "Noya", "Cocobeach", 1.0000, 9.5833),
    ("Haut-Ogooué", "Mpassa", "Franceville", -1.6333, 13.5833),
    ("Haut-Ogooué", "Lemboumbi-Leyou", "Moanda", -1.5336, 13.1987),
    ("Moyen-Ogooué", "Ogooué et Lacs", "Lambaréné", -0.7001, 10.2333),
    ("Moyen-Ogooué", "Abanga-Bigné", "Ndjolé", -0.1833, 10.7667),
    ("Ngounié", "Douya-Onoye", "Mouila", -1.8686, 11.0561),
    ("Ngounié", "Tsamba-Magotsi", "Fougamou", -1.2158, 10.5836),
    ("Nyanga", "Mougoutsi", "Tchibanga", -2.9331, 10.9831),
    ("Ogooué-Ivindo", "Ivindo", "Makokou", 0.5667, 12.8667),
    ("Ogooué-Lolo", "Lolo-Bouenguidi", "Koulamoutou", -1.1333, 12.4667),
    ("Ogooué-Maritime", "Bendjé", "Port-Gentil", -0.7193, 8.7815),
    ("Ogooué-Maritime", "Ndougou", "Gamba", -2.6500, 10.0000),
    ("Woleu-Ntem", "Woleu", "Oyem", 1.5993, 11.5793),
    ("Woleu-Ntem", "Ntem", "Bitam", 2.0819, 11.4900),
]

ESPECES = ["TILAPIA", "CLARIAS", "CARPE", "SILURE", "HETEROTIS"]

ORIGINES_ALEVINS = [
    "Écloserie Nationale de la Mpassa",
    "Production interne",
    "Importation Cameroun",
    "Écloserie privée de Ntoum",
    "Importation Côte d'Ivoire",
]

NOMS_STATION_PREFIXES = [
    "Station Piscicole",
    "Ferme Aquacole",
    "Aquaferme",
    "Complexe Piscicole",
    "Centre Aquacole",
    "Ferme Piscicole",
]

NOMS_PROMOTEURS = [
    ("Coopérative Aquacole de {loc}", TypePromoteurEnum.COOPERATIVE),
    ("Coopérative des Femmes de {loc}", TypePromoteurEnum.COOPERATIVE),
    ("GIC Pisciculteurs de {loc}", TypePromoteurEnum.COOPERATIVE),
    ("AQUAGAB Sarl", TypePromoteurEnum.PRIVE),
    ("Blue Economy Farms", TypePromoteurEnum.PRIVE),
    ("Gabon Fish Farming SA", TypePromoteurEnum.PRIVE),
    ("Ets Ndong Essono & Fils", TypePromoteurEnum.PRIVE),
    ("Mba Aquaculture", TypePromoteurEnum.PRIVE),
    ("Direction Générale de l'Aquaculture", TypePromoteurEnum.ETATIQUE),
    ("Station Expérimentale IGAD", TypePromoteurEnum.ETATIQUE),
    ("Projet PRODAC-Gabon", TypePromoteurEnum.PROJET),
    ("Projet FAO Aquaculture Durable", TypePromoteurEnum.PROJET),
]

# Pondération réaliste des statuts
STATUTS_PONDERES = (
    [StatutStationEnum.ACTIVE] * 6
    + [StatutStationEnum.EN_CONSTRUCTION] * 2
    + [StatutStationEnum.SUSPENDUE] * 1
    + [StatutStationEnum.FERMEE] * 1
)


# ---------------------------------------------------------------------------
# Génération
# ---------------------------------------------------------------------------


def _date_aleatoire(debut: date, fin: date) -> date:
    delta = (fin - debut).days
    return debut + timedelta(days=random.randint(0, max(delta, 0)))


def _generer_station(index: int, annee: int) -> StationPiscicole:
    province, departement, localite, lat, lng = random.choice(LOCALISATIONS)
    type_station = random.choice(list(TypeStationEnum))
    statut = random.choice(STATUTS_PONDERES)

    nom_promoteur_tpl, type_promoteur = random.choice(NOMS_PROMOTEURS)
    nom_promoteur = nom_promoteur_tpl.format(loc=localite)

    nb_especes = random.randint(1, 3)
    especes = ",".join(random.sample(ESPECES, nb_especes))

    date_creation = _date_aleatoire(date(2018, 1, 1), date(2026, 5, 1))

    # Agrément uniquement pour les stations sorties de construction
    numero_agrement = None
    date_agrement = None
    date_expiration = None
    if statut != StatutStationEnum.EN_CONSTRUCTION:
        date_agrement = date_creation + timedelta(days=random.randint(60, 180))
        date_expiration = date_agrement + timedelta(days=365 * 5)
        numero_agrement = f"AGR-SP-{date_agrement.year}-{index:03d}"

    # Cages flottantes -> lac ou rivière ; bacs hors-sol -> forage ou réseau
    if type_station == TypeStationEnum.CAGES_FLOTTANTES:
        source_eau = random.choice([SourceEauEnum.LAC, SourceEauEnum.RIVIERE])
    elif type_station == TypeStationEnum.BACS_HORS_SOL:
        source_eau = random.choice([SourceEauEnum.FORAGE, SourceEauEnum.RESEAU])
    else:
        source_eau = random.choice(list(SourceEauEnum))

    observations = None
    if statut == StatutStationEnum.SUSPENDUE:
        observations = (
            f"Suspendue pour non-conformité sanitaire "
            f"(inspection MCS-{annee}-{random.randint(1, 99):04d})."
        )
    elif statut == StatutStationEnum.FERMEE:
        observations = "Fermée suite à la non-reconduction de l'agrément."

    return StationPiscicole(
        code_station=f"SP-{annee}-{index:04d}",
        nom=f"{random.choice(NOMS_STATION_PREFIXES)} de {localite} {index}",
        date_creation=date_creation,
        province=province,
        departement=departement,
        localite=localite,
        adresse=f"BP {random.randint(100, 9999)}, {localite}",
        # léger bruit sur les coordonnées pour éviter la superposition sur Leaflet
        latitude=round(lat + random.uniform(-0.05, 0.05), 6),
        longitude=round(lng + random.uniform(-0.05, 0.05), 6),
        type_station=type_station,
        superficie_totale=round(random.uniform(500, 20000), 0),
        nombre_bassins=random.randint(2, 40),
        capacite_production=round(random.uniform(2, 60), 1),
        source_eau=source_eau,
        especes_elevees=especes,
        promoteur_nom=nom_promoteur,
        promoteur_contact=f"+241 6{random.randint(2, 6)} {random.randint(10, 99)} "
        f"{random.randint(10, 99)} {random.randint(10, 99)}",
        promoteur_type=type_promoteur,
        statut=statut,
        numero_agrement=numero_agrement,
        date_agrement=date_agrement,
        date_expiration_agrement=date_expiration,
        observations=observations,
    )


def _generer_cycles(station: StationPiscicole, compteur: dict, annee: int) -> list:
    """Génère 0 à 4 cycles cohérents avec le statut de la station."""
    cycles = []

    if station.statut == StatutStationEnum.EN_CONSTRUCTION:
        return cycles  # pas de cycle sur une station jamais activée

    nb_cycles = random.randint(0, 4)
    especes_station = (
        station.especes_elevees.split(",") if station.especes_elevees else ESPECES
    )

    for _ in range(nb_cycles):
        compteur["n"] += 1
        espece = random.choice(especes_station)
        date_empoissonnement = _date_aleatoire(date(2024, 1, 1), date(2026, 6, 1))
        duree = random.randint(150, 240)  # jours
        date_recolte_prevue = date_empoissonnement + timedelta(days=duree)
        nombre_alevins = random.randint(3000, 60000)

        aujourd_hui = date(2026, 7, 10)

        # Statut du cycle en fonction des dates et du statut de la station
        if station.statut in (StatutStationEnum.SUSPENDUE, StatutStationEnum.FERMEE):
            # station arrêtée : cycles terminés ou abandonnés
            statut_cycle = random.choice(
                [StatutCycleEnum.RECOLTE, StatutCycleEnum.ABANDONNE]
            )
        elif date_recolte_prevue < aujourd_hui:
            statut_cycle = random.choices(
                [StatutCycleEnum.RECOLTE, StatutCycleEnum.ABANDONNE],
                weights=[85, 15],
            )[0]
        else:
            statut_cycle = StatutCycleEnum.EN_COURS

        cycle = CycleProduction(
            code_cycle=f"CY-{annee}-{compteur['n']:04d}",
            station_id=station.id,
            espece=espece,
            date_empoissonnement=date_empoissonnement,
            nombre_alevins=nombre_alevins,
            origine_alevins=random.choice(ORIGINES_ALEVINS),
            date_recolte_prevue=date_recolte_prevue,
            statut_cycle=statut_cycle,
        )

        if statut_cycle == StatutCycleEnum.RECOLTE:
            cycle.date_recolte_effective = date_recolte_prevue + timedelta(
                days=random.randint(-15, 20)
            )
            taux_mortalite = round(random.uniform(3, 30), 1)
            cycle.taux_mortalite = taux_mortalite
            # tonnage cohérent : survivants x poids moyen (200-450 g)
            survivants = nombre_alevins * (1 - taux_mortalite / 100)
            poids_moyen_kg = random.uniform(0.2, 0.45)
            cycle.tonnage_recolte = round(survivants * poids_moyen_kg / 1000, 2)
        elif statut_cycle == StatutCycleEnum.ABANDONNE:
            cycle.observations = random.choice(
                [
                    "Mortalité massive suite à une pollution de la source d'eau.",
                    "Rupture d'approvisionnement en aliments.",
                    "Vol de poissons — cycle interrompu.",
                    "Crue exceptionnelle ayant détruit les bassins.",
                ]
            )

        cycles.append(cycle)

    return cycles


# ---------------------------------------------------------------------------
# Insertion en base
# ---------------------------------------------------------------------------


def generer(nb_stations: int = 50, reset: bool = False):
    db = SessionLocal()
    annee = 2026
    try:
        if reset:
            supprimes_cycles = db.query(CycleProduction).delete()
            supprimes_stations = db.query(StationPiscicole).delete()
            db.commit()
            print(
                f"Reset : {supprimes_stations} stations et {supprimes_cycles} cycles supprimés."
            )

        existants = db.query(StationPiscicole).count()
        if existants > 0 and not reset:
            print(
                f"{existants} stations déjà en base — génération en complément "
                f"(utiliser --reset pour repartir de zéro)."
            )

        # Décalage d'index pour éviter les collisions de code_station
        offset = existants

        # 1. Stations — insertion par lots de 25 avec flush pour obtenir les IDs
        stations = []
        for i in range(1, nb_stations + 1):
            station = _generer_station(offset + i, annee)
            db.add(station)
            stations.append(station)
            if i % 25 == 0:
                db.flush()
                print(f"  {i}/{nb_stations} stations préparées...")
        db.flush()

        # 2. Cycles de production
        compteur = {"n": db.query(CycleProduction).count()}
        total_cycles = 0
        for station in stations:
            for cycle in _generer_cycles(station, compteur, annee):
                db.add(cycle)
                total_cycles += 1

        db.commit()
        print(
            f"\nGénération terminée : {nb_stations} stations, {total_cycles} cycles insérés."
        )

        # 3. Récapitulatif par statut
        print("\nRépartition des stations par statut :")
        for statut in StatutStationEnum:
            count = (
                db.query(StationPiscicole)
                .filter(StationPiscicole.statut == statut)
                .count()
            )
            print(f"  {statut.value:<16} : {count}")

        print("\nRépartition des cycles par statut :")
        for statut in StatutCycleEnum:
            count = (
                db.query(CycleProduction)
                .filter(CycleProduction.statut_cycle == statut)
                .count()
            )
            print(f"  {statut.value:<16} : {count}")

    except Exception as exc:
        db.rollback()
        print(f"Erreur pendant la génération : {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Génère des données de test pour le module stations piscicoles"
    )
    parser.add_argument(
        "--stations",
        type=int,
        default=50,
        help="Nombre de stations à générer (défaut : 50)",
    )
    parser.add_argument(
        "--reset", action="store_true", help="Vider les tables avant génération"
    )
    args = parser.parse_args()
    generer(nb_stations=args.stations, reset=args.reset)
