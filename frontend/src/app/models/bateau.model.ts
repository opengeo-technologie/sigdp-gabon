export enum TypeBateau {
  PIROGUE = "Pirogue",
  BALEINIERE = "Baleinière",
  CANOT_MOTORISE = "Canot motorisé",
  FILEYEUR = "Fileyeur",
  CHALUTIER_ARTISANAL = "Chalutier artisanal",
}

export enum Propulsion {
  RAME = "À rame",
  VOILE = "Voile",
  MOTEUR_HORS_BORD = "Moteur hors-bord",
  MOTEUR_INBOARD = "Moteur inboard",
}

export enum MateriauCoque {
  BOIS = "Bois",
  ALUMINIUM = "Aluminium",
  FIBRE_VERRE = "Fibre de verre",
  ACIER = "Acier",
}

export interface Bateau {
  id: number;
  numero_immatriculation: string;
  nom_bateau?: string;
  type_bateau: TypeBateau;
  propulsion: Propulsion;

  // Dimensions
  longueur_hors_tout?: number;
  largeur?: number;
  tirant_eau?: number;
  jauge_brute?: number;

  // Motorisation
  moteur_marque?: string;
  moteur_puissance_cv?: number;
  moteur_type_carburant?: string;
  moteur_numero_serie?: string;

  // Construction
  materiau_coque: MateriauCoque;
  annee_construction?: number;
  chantier_construction?: string;

  // Engins de pêche
  engins_peche?: string;

  // Propriétaire et équipage
  proprietaire_pecheur_id?: number;
  proprietaire_nom?: string;
  nombre_equipage?: number;

  // Zone de pêche
  zone_peche_habituelle?: string;
  zone_peche_coordonnees?: string;

  // Certificat
  certificat_navigabilite_numero?: string;
  certificat_navigabilite_date_delivrance?: string;
  certificat_navigabilite_date_expiration?: string;

  // Équipements de sécurité
  equipement_gilets_sauvetage: boolean;
  equipement_extincteur: boolean;
  equipement_radio_vhf: boolean;
  equipement_gps: boolean;
  equipement_balise_detresse: boolean;

  // Balise GPS
  balise_gps_imei?: string;
  balise_gps_actif: boolean;

  statut: string;

  photo_url?: string;

  // Champs calculés
  certificat_valide?: boolean;
  proprietaire_info?: {
    id: number;
    nom: string;
    prenom: string;
    numero_carte: string;
    telephone?: string;
  };

  cooperative_armement_info?: {
    id: number;
    denomination: string;
    code: string;
  };

  created_at: string;
  updated_at?: string;
}

export interface BateauCreate {
  numero_immatriculation: string;
  nom_bateau?: string;
  type_bateau: TypeBateau;
  propulsion: Propulsion;
  longueur_hors_tout?: number;
  largeur?: number;
  tirant_eau?: number;
  jauge_brute?: number;
  moteur_marque?: string;
  moteur_puissance_cv?: number;
  moteur_type_carburant?: string;
  moteur_numero_serie?: string;
  materiau_coque: MateriauCoque;
  annee_construction?: number;
  chantier_construction?: string;
  engins_peche?: string;
  proprietaire_pecheur_id?: number;
  proprietaire_nom?: string;
  nombre_equipage?: number;
  zone_peche_habituelle?: string;
  zone_peche_coordonnees?: string;
  certificat_navigabilite_numero?: string;
  certificat_navigabilite_date_delivrance?: string;
  certificat_navigabilite_date_expiration?: string;
  equipement_gilets_sauvetage?: boolean;
  equipement_extincteur?: boolean;
  equipement_radio_vhf?: boolean;
  equipement_gps?: boolean;
  equipement_balise_detresse?: boolean;
  balise_gps_imei?: string;
  balise_gps_actif?: boolean;
  statut?: string;
}
