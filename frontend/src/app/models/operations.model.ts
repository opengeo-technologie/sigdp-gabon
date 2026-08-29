/**
 * SIGPA — Surveillance : opérations / infractions / saisies (modèles Angular 19).
 */

export type Gravite = "mineure" | "majeure" | "critique";

/** Élément de catalogue externe (type d'infraction, bateau). */
export interface RefItem {
  id: number;
  libelle: string;
}

export interface Operation {
  id: number;
  mission_id: number;
  date_operation: string;
  bateau_id?: number | null;
  bateau_immatriculation?: string | null;
  bateau_nom?: string | null;
  bateau_proprietaire?: string | null;
  bateau_pavillon?: string | null;
  lat_entree?: number | null;
  lon_entree?: number | null;
  debarcadere_id?: number | null;
  lieu_operation?: string | null;
  type_operation?: string | null;
  activite?: string | null;
  resultat?: string | null;
  remarques?: string | null;
  nb_infractions: number;
}

export interface Infraction {
  id: number;
  operation_id: number;
  date_infraction: string;
  infraction_id: number; // type (catalogue `infractions`)
  bateau_id?: number | null;
  description_infraction?: string | null;
  gravite_infraction?: Gravite | null;
  sanction_proposee?: string | null;
  nb_saisies: number;
}

export interface Saisie {
  id: number;
  infraction_id: number; // FK infractions_surveillance
  date_saisie: string;
  agent_id?: number | null;
  remarques?: string | null;
  agent_matricule?: string | null;
  agent_nom_complet?: string | null;
}

export interface OperationDetail extends Operation {
  infractions: Infraction[];
}

export interface ApiMessage {
  ok: boolean;
  message?: string;
}

// ------------------------------ Libellés --------------------------------
export const LABELS_GRAVITE: Record<string, string> = {
  mineure: "Mineure",
  majeure: "Majeure",
  critique: "Critique",
};

export const COULEUR_GRAVITE: Record<string, string> = {
  mineure: "green",
  majeure: "orange",
  critique: "red",
};

/** Valeurs proposées (le backend accepte du texte libre). */
export const TYPES_OPERATION = [
  "inspection",
  "contrôle",
  "patrouille",
  "opération conjointe",
  "surveillance",
];
export const RESULTATS_OPERATION = [
  "conforme",
  "non conforme",
  "partiellement conforme",
];

export const TYPES_EMBARCATION: Record<string, string> = {
  Navire: "Navire",
  Pirogue: "Pirogue",
};

export const POSITIONS_EMBARCATION: Record<string, string> = {
  debarcadere: "Débarcadère ou Port",
  quai: "Quai",
  rade_int: "Rade interieur",
  rade_ext: "Rade exterieur",
  mer: "Mer",
};

export const ACTIVITES_EMBARCATION: Record<string, string> = {
  debarquement: "Débarquement",
  empotage: "Empotage",
  transbordement: "Transbordement",
  ravitaillement: "Ravitaillement",
  escale_technique: "Escale technique",
};

export const DOCUMENT_NAVIRE_LOCAL: Record<string, string> = {
  lic_peche: "Licence de pêche",
  ship_particular: "Ship particular",
  crew_list: "Crew list",
  nil_list: "Nil list",
  log_book: "Logbook",
  last_port_of_call: "Last port of call",
  manifest_cargaison: "Manifest de cargaison",
  plan_cale: "Plan de cale",
};

export const DOCUMENT_NAVIRE_ETRANGER: Record<string, string> = {
  lic_peche: "Licence de pêche",
  lic_zone_peche: "Licences des zones de pêches",
  ship_particular: "Ship particular",
  crew_list: "Crew list",
  nil_list: "Nil list",
  log_book: "Logbook",
  last_port_of_call: "Last port of call",
  manifest_cargaison: "Manifest de cargaison",
  plan_cuve: "Plan de cuve",
};

/**
 * SIGPA — Surveillance : tableau de bord (modèles Angular 19).
 */

export interface SerieChart {
  labels: string[];
  data: number[];
}

export interface OperationRow {
  date: string | null;
  lieu: string;
  type: string;
  resultat: string;
  nb_infractions: number;
}

export interface MissionActiveRow {
  mission: string;
  nb_operations: number;
  nb_infractions: number;
}

export interface AgentSaisieRow {
  agent: string;
  nb: number;
}

export interface SanctionRow {
  sanction: string;
  nb: number;
}

export interface DashboardData {
  periode: { debut: string | null; fin: string | null };
  kpi: {
    missions: number;
    operations: number;
    infractions: number;
    saisies: number;
    rapports: number;
    taux_conformite: number;
  };
  operations_par_type: SerieChart;
  operations_par_resultat: SerieChart;
  infractions_par_gravite: SerieChart;
  infractions_par_type: SerieChart;
  missions_par_type: SerieChart;
  activite_par_mois: {
    labels: string[];
    operations: number[];
    infractions: number[];
  };
  dernieres_operations: OperationRow[];
  missions_actives: MissionActiveRow[];
  saisies_par_agent: AgentSaisieRow[];
  sanctions_proposees: SanctionRow[];
}

export interface PeriodeFiltre {
  date_debut?: string | null;
  date_fin?: string | null;
}
