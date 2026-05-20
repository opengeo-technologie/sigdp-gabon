export interface Permission {
  id: number;
  code: string;
  nom: string;
  description: string;
  module: string;
  action: string;
  actif: boolean;
}

export interface Role {
  id: number;
  code: string;
  nom: string;
  description: string;
  niveau: number;
  actif: boolean;
  est_systeme: boolean;
  permissions: Permission[];
}

export interface Module {
  module: string;
  permissions: Permission[];
}
