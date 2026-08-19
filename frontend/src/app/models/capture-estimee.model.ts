// SIGPA — Module « Captures estimées » — Modèles TypeScript

export type GroupeEspece = "PELAGIQUE" | "DEMERSAL" | "CRUSTACE";
export type FormatExport = "excel" | "csv" | "json" | "pdf";

export const MOIS_LIBELLES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

export interface Engin {
  id: number;
  code: string;
  libelle: string;
  agrege: boolean;
  actif: boolean;
}

export interface Espece {
  id: number;
  code: string;
  nom: string;
  groupe?: GroupeEspece | null;
  actif: boolean;
}

export interface CaptureEstimee {
  id: number;
  annee: number;
  mois: number;
  mois_libelle: string;
  engin_id: number;
  engin_libelle?: string;
  espece_id: number;
  espece_nom?: string;
  espece_groupe?: GroupeEspece | null;
  strate_mineure_id?: number;
  strate_mineure_libelle?: string;
  capture_kg: number;
  capture_tonnes: number;
  valeur_fcfa: number;
  source?: string;
  date_maj?: string;
}

export interface CaptureCreate {
  annee: number;
  mois: number;
  engin_id: number;
  espece_id: number;
  strate_mineure_id: number;
  capture_kg: number;
  valeur_fcfa: number;
  source?: string;
}

export interface CaptureUpdate {
  capture_kg?: number;
  valeur_fcfa?: number;
  source?: string;
}

export interface CaptureFiltre {
  annee?: number | null;
  mois?: number | null;
  engin_id?: number | null;
  espece_id?: number | null;
  strate_mineure_id?: number | null;
  groupe?: GroupeEspece | null;
  inclure_agrege?: boolean;
  page: number;
  taille_page: number;
  tri: string;
}

export interface CaptureListe {
  total: number;
  page: number;
  taille_page: number;
  elements: CaptureEstimee[];
}

export interface Effort {
  id: number;
  annee: number;
  mois: number;
  mois_libelle: string;
  engin_id: number;
  engin_libelle?: string;
  efforts_jours: number;
  nombre_debarquements: number;
  taux_echantillonnage?: number | null;
  cpue_kg_jour?: number | null;
}

export interface ImportResultat {
  lignes_lues: number;
  captures_importees: number;
  efforts_importes: number;
  engins_crees: number;
  especes_creees: number;
  erreurs: { feuille: string; reference: string; message: string }[];
  succes: boolean;
}

export interface Stats {
  annee: number;
  mensuel: {
    labels: string[];
    captures_tonnes: number[];
    valeur_millions_fcfa: number[];
  };
  par_engin: { labels: string[]; tonnes: number[] };
  par_groupe: { labels: string[]; tonnes: number[] };
  top_especes: { labels: string[]; tonnes: number[] };
  cpue_mensuel: { labels: string[]; cpue_kg_jour: number[] };
  kpi: {
    captures_tonnes: number;
    captures_tonnes_source: number;
    valeur_millions_fcfa: number;
    nb_especes: number;
    nb_engins: number;
  };
}
