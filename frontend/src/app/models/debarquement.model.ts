export interface DetailDebarquement {
  id?: number;
  espece_id: number;
  espece_nom?: string;
  espece_code?: string;
  quantite_kg: number;
  nombre_individus?: number;
  taille_moyenne_cm?: number;
  taille_min_cm?: number;
  taille_max_cm?: number;
  prix_unitaire_kg?: number;
  valeur_totale?: number;
  etat_fraicheur?: string;
  destination?: string;
  alerte_taille_illegale?: boolean;
  alerte_quota?: boolean;
}

export interface Debarquement {
  id: number;
  numero_debarquement: string;
  debarcadere_id: number;
  debarcadere_nom?: string;
  bateau_id: number;
  bateau_immatriculation?: string;
  pecheur_principal_id: number;
  pecheur_nom?: string;

  date_debarquement: string;
  heure_depart_peche?: string;
  heure_arrivee_debarcadere?: string;
  duree_sortie_heures?: number;
  effort_peche?: number;
  cpue?: number;

  // Zone de pêche
  zone_peche_nom?: string;
  zone_peche_latitude?: number;
  zone_peche_longitude?: number;
  zone_peche_profondeur_m?: number;

  // Météo
  meteo_conditions?: string;
  meteo_etat_mer?: string;
  meteo_temperature_c?: number;

  // Équipage
  nombre_pecheurs?: number;
  liste_pecheurs_ids?: string;

  // Validation
  agent_controle_nom?: string;
  agent_controle_matricule?: string;

  // Alertes
  alerte_espece_protegee: boolean;
  alerte_quota_depasse: boolean;
  alerte_taille_illegale: boolean;
  alerte_bateau_non_conforme: boolean;
  alerte_details?: string;

  // Observations
  observations?: string;
  anomalies_detectees?: string;

  synchronise: boolean;

  // Données enrichies
  details: DetailDebarquement[];
  total_quantite_kg?: number;
  total_valeur?: number;
  nb_especes?: number;
  has_alertes?: boolean;

  created_at: string;
  updated_at?: string;
}

export interface DebarquementCreate {
  debarcadere_id: number;
  bateau_id: number;
  pecheur_principal_id: number;
  date_debarquement: string;
  heure_depart_peche?: string;
  heure_arrivee_debarcadere?: string;
  zone_peche_nom?: string;
  zone_peche_latitude?: number;
  zone_peche_longitude?: number;
  meteo_conditions?: string;
  meteo_etat_mer?: string;
  nombre_pecheurs?: number;
  agent_controle_nom?: string;
  agent_controle_matricule?: string;
  observations?: string;
  details: {
    espece_id: number;
    quantite_kg: number;
    nombre_individus?: number;
    taille_moyenne_cm?: number;
    prix_unitaire_kg?: number;
    valeur_totale?: number;
    etat_fraicheur?: string;
  }[];
}
