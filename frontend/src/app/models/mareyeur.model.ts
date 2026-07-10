// src/app/models/mareyeur.model.ts
// Module Mareyeurs - SIGDP-GABON
// Interfaces miroir des schémas Pydantic du backend

export interface Mareyeur {
  id?: number;
  code?: string;
  type_personne: string; // 'physique' | 'morale'
  nom?: string | null;
  prenom?: string | null;
  raison_sociale?: string | null;
  sexe?: string | null;
  date_naissance?: string | null; // ISO 'YYYY-MM-DD'
  lieu_naissance?: string | null;
  nationalite?: string | null;
  nif?: string | null;
  rccm?: string | null;
  telephone?: string | null;
  email?: string | null;
  adresse?: string | null;
  photo?: string | null;
  zones_activite?: string | null; // chaîne séparée par virgules
  sites_debarquement?: string | null; // chaîne séparée par virgules
  statut: string; // 'actif' | 'suspendu' | 'radie'
  observations?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MareyeurListFilter {
  statut?: string | null;
  recherche?: string | null;
  page: number;
  taille_page: number;
}

export interface MareyeurListResponse {
  total: number;
  page: number;
  taille_page: number;
  resultats: Mareyeur[];
}

export interface AgrementMareyage {
  id?: number;
  code?: string;
  mareyeur_id: number;
  categorie: string; // 'mareyeur_simple' | 'mareyeur_exportateur'
  date_demande?: string | null;
  date_delivrance?: string | null;
  duree_validite_mois: number;
  date_expiration?: string | null;
  montant_redevance?: number | null;
  statut?: string; // en_instruction | delivre | expire | suspendu | retire
  motif_statut?: string | null;
  renouvele_de_id?: number | null;
  observations?: string | null;
  created_at?: string;
}

export interface AgrementListResponse {
  total: number;
  page: number;
  taille_page: number;
  resultats: AgrementMareyage[];
}

export interface InstallationMareyage {
  id?: number;
  mareyeur_id: number;
  type_installation: string; // chambre_froide | vehicule_frigorifique | entrepot | etal | autre
  designation: string;
  capacite_tonnes?: number | null;
  immatriculation?: string | null;
  adresse?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  statut: string; // fonctionnelle | hors_service
  observations?: string | null;
  created_at?: string;
}

export interface TransactionAchat {
  id?: number;
  code?: string;
  mareyeur_id: number;
  date_transaction: string;
  site_debarquement?: string | null;
  pecheur?: string | null;
  pirogue?: string | null;
  espece: string;
  quantite_kg: number;
  prix_unitaire_fcfa?: number | null;
  montant_total_fcfa?: number | null;
  observations?: string | null;
  created_at?: string;
}

export interface TransactionListResponse {
  total: number;
  page: number;
  taille_page: number;
  resultats: TransactionAchat[];
}

export interface StatistiquesMareyeurs {
  total_mareyeurs: number;
  par_statut: Record<string, number>;
  par_type_personne: Record<string, number>;
  agrements_par_statut: Record<string, number>;
  agrements_expirant_30j: number;
  volume_total_kg: number;
  volumes_par_espece: Record<string, number>;
  volumes_par_site: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Référentiels (à remplacer par un appel API si un référentiel central existe)
// ---------------------------------------------------------------------------

export const PROVINCES_GABON: string[] = [
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

export const SITES_DEBARQUEMENT: string[] = [
  "Port Môle (Libreville)",
  "Owendo",
  "Cap Estérias",
  "Cocobeach",
  "Port-Gentil",
  "Omboué",
  "Gamba",
  "Mayumba",
  "Lambaréné",
  "Ndjolé",
];

export const LIBELLES_STATUT_MAREYEUR: Record<string, string> = {
  actif: "Actif",
  suspendu: "Suspendu",
  radie: "Radié",
};

export const LIBELLES_STATUT_AGREMENT: Record<string, string> = {
  en_instruction: "En instruction",
  delivre: "Délivré",
  expire: "Expiré",
  suspendu: "Suspendu",
  retire: "Retiré",
};

export const LIBELLES_CATEGORIE_AGREMENT: Record<string, string> = {
  mareyeur_simple: "Mareyeur simple",
  mareyeur_exportateur: "Mareyeur-exportateur",
};
