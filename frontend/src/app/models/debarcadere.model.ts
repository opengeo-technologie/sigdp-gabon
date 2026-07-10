export enum DebarcadereType {
  OFFICIEL = "Officiel",
  INFORMEL = "Informel",
  SAISONNIER = "Saisonnier",
  CAPA = "Centre d'Appui à la Pêche Artisanale",
}

export enum Milieu {
  MARITIME = "Maritime",
  FLUVIAL = "Fluvial",
  LAGUNAIRE = "Lagunaire",
  CONTINENTAL = "Continental",
}

export enum StatutOperationnel {
  ACTIF = "Actif",
  INACTIF = "Inactif",
  EN_TRAVAUX = "En travaux",
}

export interface Debarcadere {
  id: number;
  code: string;
  denomination: string;
  nom_local?: string;
  type: DebarcadereType;
  milieu: Milieu;
  latitude: number;
  longitude: number;
  province: string;
  departement?: string;
  localite?: string;
  est_localise: boolean;

  // Infrastructures
  infrastructure_quai: boolean;
  infrastructure_chambre_froide: boolean;
  infrastructure_glace: boolean;
  infrastructure_marche: boolean;
  infrastructure_carburant: boolean;
  infrastructure_eau: boolean;
  infrastructure_electricite: boolean;

  capacite_accueil?: number;
  taille_flottile: number;

  // Agent responsable
  agent_responsable_nom?: string;
  agent_responsable_matricule?: string;
  agent_responsable_telephone?: string;

  statut_operationnel: StatutOperationnel;
  description?: string;

  photo_url?: string;

  geojson?: {
    type: string;
    coordinates: [number, number];
  };

  created_at: string;
  updated_at?: string;
}

export interface DebarcadereCreate {
  code: string;
  denomination: string;
  nom_local?: string;
  type: DebarcadereType;
  milieu: Milieu;
  latitude: number;
  longitude: number;
  province: string;
  departement?: string;
  localite?: string;
  est_localise?: boolean;
  infrastructure_quai?: boolean;
  infrastructure_chambre_froide?: boolean;
  infrastructure_glace?: boolean;
  infrastructure_marche?: boolean;
  infrastructure_carburant?: boolean;
  infrastructure_eau?: boolean;
  infrastructure_electricite?: boolean;
  capacite_accueil?: number;
  agent_responsable_nom?: string;
  agent_responsable_matricule?: string;
  agent_responsable_telephone?: string;
  statut_operationnel?: StatutOperationnel;
  description?: string;
  photo?: File | null;
}
