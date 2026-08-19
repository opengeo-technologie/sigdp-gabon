// mareyeur-stats.model.ts
// Interfaces miroir des schémas Pydantic du back-end (mareyeur_statistiques.py)

export interface SerieChart {
  labels: string[];
  data: number[];
}

export interface BlocMareyeurs {
  total: number;
  actifs: number;
  par_type_personne: SerieChart;
  par_statut: SerieChart;
  par_sexe: SerieChart;
  par_nationalite: SerieChart;
  par_zone_activite: SerieChart;
  par_site_debarquement: SerieChart;
}

export interface BlocAgrements {
  total: number;
  par_statut: SerieChart;
  par_categorie: SerieChart;
  montant_total_redevances_fcfa: number;
  nombre_delivres: number;
  nombre_expires: number;
  nombre_expirant_30j: number;
  nombre_renouvellements: number;
}

export interface BlocInstallations {
  total: number;
  par_type: SerieChart;
  par_statut: SerieChart;
  capacite_totale_tonnes: number;
}

export interface BlocTransactions {
  total: number;
  quantite_totale_kg: number;
  montant_total_fcfa: number;
  prix_moyen_fcfa_par_kg: number;
  par_etat_poisson: SerieChart;
  top_especes_quantite: SerieChart;
  par_site_debarquement: SerieChart;
  evolution_mensuelle_kg: SerieChart;
  evolution_mensuelle_fcfa: SerieChart;
}

export interface StatistiquesMareyeurs {
  genere_le: string;
  periode_debut: string | null;
  periode_fin: string | null;
  mareyeurs: BlocMareyeurs;
  agrements: BlocAgrements;
  installations: BlocInstallations;
  transactions: BlocTransactions;
}

export interface FiltreStatistiques {
  date_debut?: string | null;
  date_fin?: string | null;
  top_n?: number;
}
