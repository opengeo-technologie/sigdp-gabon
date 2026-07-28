# -*- coding: utf-8 -*-
"""
Seed de données de test — Module Stations Piscicoles (SIGDP-GABON)
Exécution : python -m app.seed.seed_stations_piscicoles
"""

from datetime import date
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

STATIONS = [
    {
        "code_station": "SP-2026-0001",
        "nom": "Station Piscicole de la Peyrie",
        "date_creation": date(2021, 3, 15),
        "province": "Estuaire",
        "departement": "Komo-Mondah",
        "localite": "Ntoum",
        "latitude": 0.3901,
        "longitude": 9.7671,
        "type_station": TypeStationEnum.ETANGS,
        "superficie_totale": 12000,
        "nombre_bassins": 14,
        "capacite_production": 25.0,
        "source_eau": SourceEauEnum.RIVIERE,
        "especes_elevees": "TILAPIA,CLARIAS",
        "promoteur_nom": "Coopérative Aquacole de Ntoum",
        "promoteur_contact": "+241 66 00 00 01",
        "promoteur_type": TypePromoteurEnum.COOPERATIVE,
        "statut": StatutStationEnum.ACTIVE,
        "numero_agrement": "AGR-SP-2021-014",
        "date_agrement": date(2021, 6, 1),
        "date_expiration_agrement": date(2026, 6, 1),
    },
    {
        "code_station": "SP-2026-0002",
        "nom": "Ferme Aquacole d'Owendo",
        "date_creation": date(2023, 1, 10),
        "province": "Estuaire",
        "departement": "Komo-Mondah",
        "localite": "Owendo",
        "latitude": 0.2833,
        "longitude": 9.5000,
        "type_station": TypeStationEnum.BACS_HORS_SOL,
        "superficie_totale": 3500,
        "nombre_bassins": 24,
        "capacite_production": 18.0,
        "source_eau": SourceEauEnum.FORAGE,
        "especes_elevees": "CLARIAS",
        "promoteur_nom": "AQUAGAB Sarl",
        "promoteur_contact": "+241 66 00 00 02",
        "promoteur_type": TypePromoteurEnum.PRIVE,
        "statut": StatutStationEnum.ACTIVE,
        "numero_agrement": "AGR-SP-2023-003",
        "date_agrement": date(2023, 4, 12),
        "date_expiration_agrement": date(2028, 4, 12),
    },
    {
        "code_station": "SP-2026-0003",
        "nom": "Écloserie Nationale de la Mpassa",
        "date_creation": date(2019, 9, 1),
        "province": "Haut-Ogooué",
        "departement": "Mpassa",
        "localite": "Franceville",
        "latitude": -1.6333,
        "longitude": 13.5833,
        "type_station": TypeStationEnum.ECLOSERIE,
        "superficie_totale": 5000,
        "nombre_bassins": 30,
        "capacite_production": 8.0,
        "source_eau": SourceEauEnum.RIVIERE,
        "especes_elevees": "TILAPIA,CLARIAS,CARPE",
        "promoteur_nom": "Direction Générale de l'Aquaculture",
        "promoteur_contact": "+241 66 00 00 03",
        "promoteur_type": TypePromoteurEnum.ETATIQUE,
        "statut": StatutStationEnum.ACTIVE,
        "numero_agrement": "AGR-SP-2019-001",
        "date_agrement": date(2019, 11, 20),
        "date_expiration_agrement": date(2029, 11, 20),
    },
    {
        "code_station": "SP-2026-0004",
        "nom": "Cages Flottantes du Lac Onangué",
        "date_creation": date(2024, 5, 20),
        "province": "Moyen-Ogooué",
        "departement": "Ogooué et Lacs",
        "localite": "Lambaréné",
        "latitude": -0.7001,
        "longitude": 10.2333,
        "type_station": TypeStationEnum.CAGES_FLOTTANTES,
        "superficie_totale": 800,
        "nombre_bassins": 12,
        "capacite_production": 30.0,
        "source_eau": SourceEauEnum.LAC,
        "especes_elevees": "TILAPIA",
        "promoteur_nom": "Projet PRODAC-Gabon",
        "promoteur_contact": "+241 66 00 00 04",
        "promoteur_type": TypePromoteurEnum.PROJET,
        "statut": StatutStationEnum.ACTIVE,
        "numero_agrement": "AGR-SP-2024-009",
        "date_agrement": date(2024, 8, 5),
        "date_expiration_agrement": date(2029, 8, 5),
    },
    {
        "code_station": "SP-2026-0005",
        "nom": "Station Piscicole d'Oyem",
        "date_creation": date(2022, 7, 8),
        "province": "Woleu-Ntem",
        "departement": "Woleu",
        "localite": "Oyem",
        "latitude": 1.5993,
        "longitude": 11.5793,
        "type_station": TypeStationEnum.MIXTE,
        "superficie_totale": 9000,
        "nombre_bassins": 10,
        "capacite_production": 15.0,
        "source_eau": SourceEauEnum.RIVIERE,
        "especes_elevees": "TILAPIA,CLARIAS",
        "promoteur_nom": "Ndong Essono Aquaculture",
        "promoteur_contact": "+241 66 00 00 05",
        "promoteur_type": TypePromoteurEnum.PRIVE,
        "statut": StatutStationEnum.SUSPENDUE,
        "numero_agrement": "AGR-SP-2022-017",
        "date_agrement": date(2022, 10, 3),
        "date_expiration_agrement": date(2027, 10, 3),
        "observations": "Suspendue pour non-conformité sanitaire (inspection MCS-2026-0032).",
    },
    {
        "code_station": "SP-2026-0006",
        "nom": "Ferme Piscicole de Mouila",
        "date_creation": date(2025, 11, 2),
        "province": "Ngounié",
        "departement": "Douya-Onoye",
        "localite": "Mouila",
        "latitude": -1.8686,
        "longitude": 11.0561,
        "type_station": TypeStationEnum.ETANGS,
        "superficie_totale": 6500,
        "nombre_bassins": 8,
        "capacite_production": 10.0,
        "source_eau": SourceEauEnum.RIVIERE,
        "especes_elevees": "TILAPIA",
        "promoteur_nom": "Coopérative des Femmes de la Ngounié",
        "promoteur_contact": "+241 66 00 00 06",
        "promoteur_type": TypePromoteurEnum.COOPERATIVE,
        "statut": StatutStationEnum.EN_CONSTRUCTION,
    },
    {
        "code_station": "SP-2026-0007",
        "nom": "Aquaferme de Port-Gentil",
        "date_creation": date(2020, 2, 14),
        "province": "Ogooué-Maritime",
        "departement": "Bendjé",
        "localite": "Port-Gentil",
        "latitude": -0.7193,
        "longitude": 8.7815,
        "type_station": TypeStationEnum.BACS_HORS_SOL,
        "superficie_totale": 2200,
        "nombre_bassins": 16,
        "capacite_production": 12.0,
        "source_eau": SourceEauEnum.FORAGE,
        "especes_elevees": "CLARIAS,TILAPIA",
        "promoteur_nom": "Blue Economy Farms",
        "promoteur_contact": "+241 66 00 00 07",
        "promoteur_type": TypePromoteurEnum.PRIVE,
        "statut": StatutStationEnum.FERMEE,
        "numero_agrement": "AGR-SP-2020-006",
        "date_agrement": date(2020, 5, 30),
        "date_expiration_agrement": date(2025, 5, 30),
        "observations": "Fermée suite à la non-reconduction de l'agrément (expiré le 30/05/2025).",
    },
]

CYCLES = [
    # Station 1 — cycle récolté + cycle en cours
    {
        "code_cycle": "CY-2026-0001",
        "station_code": "SP-2026-0001",
        "espece": "TILAPIA",
        "date_empoissonnement": date(2025, 9, 1),
        "nombre_alevins": 20000,
        "origine_alevins": "Écloserie Nationale de la Mpassa",
        "date_recolte_prevue": date(2026, 3, 1),
        "date_recolte_effective": date(2026, 3, 10),
        "tonnage_recolte": 6.4,
        "taux_mortalite": 12.5,
        "statut_cycle": StatutCycleEnum.RECOLTE,
    },
    {
        "code_cycle": "CY-2026-0002",
        "station_code": "SP-2026-0001",
        "espece": "CLARIAS",
        "date_empoissonnement": date(2026, 4, 5),
        "nombre_alevins": 15000,
        "origine_alevins": "Écloserie Nationale de la Mpassa",
        "date_recolte_prevue": date(2026, 10, 5),
        "statut_cycle": StatutCycleEnum.EN_COURS,
    },
    # Station 2
    {
        "code_cycle": "CY-2026-0003",
        "station_code": "SP-2026-0002",
        "espece": "CLARIAS",
        "date_empoissonnement": date(2026, 1, 15),
        "nombre_alevins": 30000,
        "origine_alevins": "Importation Cameroun",
        "date_recolte_prevue": date(2026, 7, 15),
        "date_recolte_effective": date(2026, 6, 28),
        "tonnage_recolte": 9.2,
        "taux_mortalite": 8.0,
        "statut_cycle": StatutCycleEnum.RECOLTE,
    },
    # Station 4 — cages flottantes
    {
        "code_cycle": "CY-2026-0004",
        "station_code": "SP-2026-0004",
        "espece": "TILAPIA",
        "date_empoissonnement": date(2026, 2, 20),
        "nombre_alevins": 50000,
        "origine_alevins": "Écloserie Nationale de la Mpassa",
        "date_recolte_prevue": date(2026, 8, 20),
        "statut_cycle": StatutCycleEnum.EN_COURS,
    },
    # Station 3 — cycle abandonné
    {
        "code_cycle": "CY-2026-0005",
        "station_code": "SP-2026-0003",
        "espece": "CARPE",
        "date_empoissonnement": date(2025, 12, 1),
        "nombre_alevins": 5000,
        "origine_alevins": "Production interne",
        "date_recolte_prevue": date(2026, 6, 1),
        "statut_cycle": StatutCycleEnum.ABANDONNE,
        "observations": "Mortalité massive suite à une pollution de la source d'eau.",
    },
]


def seed():
    db = SessionLocal()
    try:
        if db.query(StationPiscicole).count() > 0:
            print("Des stations piscicoles existent déjà — seed ignoré.")
            return

        stations_par_code = {}
        for data in STATIONS:
            station = StationPiscicole(**data)
            db.add(station)
            stations_par_code[data["code_station"]] = station
        db.flush()

        for data in CYCLES:
            data = dict(data)
            station = stations_par_code[data.pop("station_code")]
            cycle = CycleProduction(station_id=station.id, **data)
            db.add(cycle)

        db.commit()
        print(f"Seed terminé : {len(STATIONS)} stations, {len(CYCLES)} cycles créés.")
    except Exception as exc:
        db.rollback()
        print(f"Erreur pendant le seed : {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
