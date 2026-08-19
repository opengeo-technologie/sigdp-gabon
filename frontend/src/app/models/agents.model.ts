/**
 * SIGPA — Surveillance : référentiel des agents de contrôle (modèles Angular 19).
 */

export interface Fonction {
  id: number;
  libelle: string;
  nb_agents: number;
}

export interface Organisme {
  id: number;
  libelle: string;
  abbreviation?: string | null;
  nb_agents: number;
}

export interface Agent {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  date_naissance?: string | null;
  fonction_id?: number | null;
  organisme_id?: number | null;
  contact_email?: string | null;
  contact_telephone?: string | null;
  // Champs enrichis renvoyés par l'API
  nom_complet?: string | null;
  fonction_libelle?: string | null;
  organisme_libelle?: string | null;
  organisme_abbreviation?: string | null;
}

export interface AgentFiltre {
  q?: string | null;
  fonction_id?: number | null;
  organisme_id?: number | null;
  skip?: number;
  limit?: number;
}

export interface RefFiltre {
  q?: string | null;
  skip?: number;
  limit?: number;
}

export interface ApiMessage {
  ok: boolean;
  message: string;
}
