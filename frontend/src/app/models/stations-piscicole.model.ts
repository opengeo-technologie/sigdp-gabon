// station-piscicole.model.ts
// Interfaces et enums alignés sur les schémas Pydantic du backend

export enum TypeStation {
  ETANGS = "ETANGS",
  BACS_HORS_SOL = "BACS_HORS_SOL",
  CAGES_FLOTTANTES = "CAGES_FLOTTANTES",
  ECLOSERIE = "ECLOSERIE",
  MIXTE = "MIXTE",
}

export enum SourceEau {
  FORAGE = "FORAGE",
  RIVIERE = "RIVIERE",
  LAC = "LAC",
  RESEAU = "RESEAU",
  AUTRE = "AUTRE",
}

export enum TypePromoteur {
  PRIVE = "PRIVE",
  COOPERATIVE = "COOPERATIVE",
  ETATIQUE = "ETATIQUE",
  PROJET = "PROJET",
}

export enum StatutStation {
  EN_CONSTRUCTION = "EN_CONSTRUCTION",
  ACTIVE = "ACTIVE",
  SUSPENDUE = "SUSPENDUE",
  FERMEE = "FERMEE",
}

export enum StatutCycle {
  EN_COURS = "EN_COURS",
  RECOLTE = "RECOLTE",
  ABANDONNE = "ABANDONNE",
}

// ---------------------------------------------------------------------------
// Libellés français pour l'affichage
// ---------------------------------------------------------------------------

export const TYPE_STATION_LABELS: Record<string, string> = {
  ETANGS: "Étangs",
  BACS_HORS_SOL: "Bacs hors-sol",
  CAGES_FLOTTANTES: "Cages flottantes",
  ECLOSERIE: "Écloserie",
  MIXTE: "Mixte",
};

export const SOURCE_EAU_LABELS: Record<string, string> = {
  FORAGE: "Forage",
  RIVIERE: "Rivière",
  LAC: "Lac",
  RESEAU: "Réseau d'eau",
  AUTRE: "Autre",
};

export const TYPE_PROMOTEUR_LABELS: Record<string, string> = {
  PRIVE: "Privé",
  COOPERATIVE: "Coopérative",
  ETATIQUE: "Étatique",
  PROJET: "Projet",
};

export const STATUT_STATION_LABELS: Record<string, string> = {
  EN_CONSTRUCTION: "En construction",
  ACTIVE: "Active",
  SUSPENDUE: "Suspendue",
  FERMEE: "Fermée",
};

export const STATUT_STATION_COLORS: Record<string, string> = {
  EN_CONSTRUCTION: "orange",
  ACTIVE: "green",
  SUSPENDUE: "amber darken-2",
  FERMEE: "red",
};

export const STATUT_CYCLE_LABELS: Record<string, string> = {
  EN_COURS: "En cours",
  RECOLTE: "Récolté",
  ABANDONNE: "Abandonné",
};

export const STATUT_CYCLE_COLORS: Record<string, string> = {
  EN_COURS: "blue",
  RECOLTE: "green",
  ABANDONNE: "grey",
};

// Transitions autorisées — miroir de TRANSITIONS_STATUT_STATION côté backend
export const TRANSITIONS_STATUT: Record<string, StatutStation[]> = {
  EN_CONSTRUCTION: [StatutStation.ACTIVE, StatutStation.FERMEE],
  ACTIVE: [StatutStation.SUSPENDUE, StatutStation.FERMEE],
  SUSPENDUE: [StatutStation.ACTIVE, StatutStation.FERMEE],
  FERMEE: [],
};

export const ESPECES_DISPONIBLES = [
  "TILAPIA",
  "CLARIAS",
  "CARPE",
  "SILURE",
  "HETEROTIS",
];

export const PROVINCES_GABON = [
  "Estuaire",
  "Haut-Ogooué",
  "Moyen-Ogooué",
  "Ngounié",
  "Nyanga",
  "Ogooué-Ivindo",
  "Ogooué-Lolo",
  "Ogooué-Maritime",
  "Woleu-Ntem",
];

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface CycleProduction {
  id: number;
  code_cycle: string;
  station_id: number;
  espece: string;
  date_empoissonnement: string;
  nombre_alevins?: number;
  origine_alevins?: string;
  date_recolte_prevue?: string;
  date_recolte_effective?: string;
  tonnage_recolte?: number;
  taux_mortalite?: number;
  statut_cycle: StatutCycle;
  observations?: string;
  created_at: string;
  updated_at: string;
}

export interface StationPiscicole {
  id: number;
  code_station: string;
  nom: string;
  date_creation?: string;
  province: string;
  departement?: string;
  localite?: string;
  adresse?: string;
  latitude?: number;
  longitude?: number;
  type_station: TypeStation;
  superficie_totale?: number;
  nombre_bassins?: number;
  capacite_production?: number;
  source_eau?: SourceEau;
  especes_elevees?: string; // "TILAPIA,CLARIAS" — split(',') côté affichage
  promoteur_nom: string;
  promoteur_contact?: string;
  promoteur_type: TypePromoteur;
  statut: StatutStation;
  numero_agrement?: string;
  date_agrement?: string;
  date_expiration_agrement?: string;
  observations?: string;
  created_at: string;
  updated_at: string;
}

export interface StationPiscicoleDetail extends StationPiscicole {
  cycles: CycleProduction[];
}

export interface StationListRequest {
  search?: string;
  province?: string;
  type_station?: string;
  statut?: string;
  espece?: string;
  page: number;
  page_size: number;
}

export interface StationListResponse {
  total: number;
  page: number;
  page_size: number;
  items: StationPiscicole[];
}

export interface StatsResponse {
  indicateurs: {
    total_stations: number;
    stations_actives: number;
    cycles_en_cours: number;
    tonnage_total_recolte: number;
  };
  par_province: { labels: string[]; data: number[] };
  par_type: { labels: string[]; data: number[] };
  par_statut: { labels: string[]; data: number[] };
  production_par_espece: { labels: string[]; data: number[] };
  production_mensuelle: { labels: string[]; data: number[] };
}
