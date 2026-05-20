export enum CategoriePecheur {
  ARTISANAL = "Pêcheur artisanal",
  SEMI_INDUSTRIEL = "Pêcheur semi-industriel",
  PATRON = "Patron de pêche",
  AIDE_PECHEUR = "Aide-pêcheur",
}

export enum TypePeche {
  COTIERE = "Côtière",
  FLUVIALE = "Fluviale",
  LAGUNAIRE = "Lagunaire",
  HAUTURIERE = "Hauturière",
}

export enum StatutPecheur {
  ACTIF = "Actif",
  INACTIF = "Inactif",
  SUSPENDU = "Suspendu",
  DECEDE = "Décédé",
}

export interface Pecheur {
  id: number;
  numero_carte: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  lieu_naissance?: string;
  nationalite: string;
  nif?: string;

  // Contact
  telephone?: string;
  email?: string;
  adresse?: string;

  // Catégorisation
  categorie: CategoriePecheur;
  type_peche: TypePeche;

  // Débarcadère habituel
  debarcadere_habituel_code?: string;

  // Licence
  licence_numero?: string;
  licence_date_delivrance?: string;
  licence_date_expiration?: string;

  // Contacts d'urgence
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
  contact_urgence_relation?: string;

  statut: StatutPecheur;

  // Champs calculés
  age?: number;
  licence_active?: boolean;
  photo_url?: string;
  qr_code_url?: string;

  created_at: string;
  updated_at?: string;
}

export interface PecheurCreate {
  numero_carte: string;
  nom: string;
  prenom: string;
  date_naissance: string;
  lieu_naissance?: string;
  nationalite?: string;
  nif?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  categorie: CategoriePecheur;
  type_peche: TypePeche;
  debarcadere_habituel_code?: string;
  licence_numero?: string;
  licence_date_delivrance?: string;
  licence_date_expiration?: string;
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
  contact_urgence_relation?: string;
  statut?: StatutPecheur;
  photo?: File | null;
}
