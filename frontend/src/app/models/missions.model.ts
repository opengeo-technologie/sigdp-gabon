/**
 * SIGPA — Surveillance : missions / équipes / rapports (modèles Angular 19).
 */

export type TypeMission = "terrain" | "bureau" | "aleatoire";

export interface Mission {
  id: number;
  date_depart: string;
  date_retour?: string | null;
  lieu_mission?: string | null;
  type_mission?: TypeMission | null;
  moyen_controle?: string | null;
  rapport_scan?: string | null;
  nb_membres: number;
  nb_rapports: number;
}

export interface Equipe {
  id: number;
  mission_id: number;
  agent_id: number;
  role_agent?: string | null;
  // Enrichissement agent (renvoyé par l'API)
  matricule?: string | null;
  nom_complet?: string | null;
  fonction_libelle?: string | null;
  organisme_abbreviation?: string | null;
}

export interface Rapport {
  id: number;
  mission_id: number;
  date_rapport: string;
  contenu_rapport?: string | null;
}

export interface MissionDetail extends Mission {
  membres: Equipe[];
  rapports: Rapport[];
}

export interface MissionFiltre {
  q?: string | null;
  type_mission?: TypeMission | null;
  date_debut?: string | null;
  date_fin?: string | null;
  skip?: number;
  limit?: number;
}

export interface ApiMessage {
  ok: boolean;
  message?: string;
  rapport_scan?: string;
}

export const LABELS_TYPE_MISSION: Record<string, string> = {
  terrain: "Terrain",
  bureau: "Bureau",
  aleatoire: "Aléatoire",
};

export const COULEUR_TYPE_MISSION: Record<string, string> = {
  terrain: "green",
  bureau: "blue-grey",
  aleatoire: "deep-purple",
};
