export enum CategorieEspece {
  PELAGIQUE = "Poissons pélagiques",
  DEMERSAL = "Poissons démersaux",
  EAU_DOUCE = "Poissons d'eaux douces",
  CRUSTACE = "Crustacés",
  MOLLUSQUE = "Mollusques",
  PROTEGE = "Espèces protégées",
}

export enum StatutReglementaire {
  LIBRE = "Libre",
  SOUS_QUOTA = "Sous quota",
  PROTEGE = "Protégé",
  SAISONNIER = "Saisonnier",
}

export interface Espece {
  id: number;
  code_espece: string;
  nom_scientifique: string;
  nom_commun_francais: string;
  nom_commun_fang?: string;
  nom_commun_myene?: string;
  autres_noms_locaux?: string;

  // Classification
  categorie: CategorieEspece;
  famille?: string;
  ordre?: string;
  classe?: string;

  // Statut réglementaire
  statut_reglementaire: StatutReglementaire;
  taille_minimale_legale_cm?: number;

  // Quotas
  quota_annuel_tonnes?: number;
  quota_mensuel_tonnes?: number;
  quota_hebdomadaire_tonnes?: number;

  // Saisonnalité
  saison_peche_debut?: string;
  saison_peche_fin?: string;
  saison_reproduction_debut?: string;
  saison_reproduction_fin?: string;

  // Valeur commerciale
  prix_reference_kg_min?: number;
  prix_reference_kg_max?: number;

  // Informations biologiques
  habitat?: string;
  alimentation?: string;
  taille_maximale_cm?: number;
  poids_maximal_kg?: number;
  esperance_vie_annees?: number;

  // Importance écologique
  importance_ecologique?: string;
  vulnerabilite_surpeche?: string;

  actif: boolean;
  photo_url?: string;

  created_at: string;
  updated_at?: string;
}

export interface EspeceCreate {
  code_espece: string;
  nom_scientifique: string;
  nom_commun_francais: string;
  nom_commun_fang?: string;
  nom_commun_myene?: string;
  categorie: CategorieEspece;
  statut_reglementaire?: StatutReglementaire;
  taille_minimale_legale_cm?: number;
  quota_mensuel_tonnes?: number;
  prix_reference_kg_min?: number;
  prix_reference_kg_max?: number;
  actif?: boolean;
  photo?: File | null;
}
