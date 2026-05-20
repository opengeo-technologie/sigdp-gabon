export interface UserProfile {
  id: number;
  username: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  actif: boolean;
  date_creation: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
  pays?: string;
  photo_profil?: string;
  signature?: string;
  preferences?: any;
}

export interface PasswordChange {
  ancien_password: string;
  nouveau_password: string;
  confirmer_password: string;
}

export interface NotificationSettings {
  email_debarquements: boolean;
  email_alertes: boolean;
  email_rapports: boolean;
  email_quotas: boolean;
  notifications_push: boolean;
  frequence_emails: string;
}
