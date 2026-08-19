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
  lieu_operation?: string | null;
  type_operation?: string | null;
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
