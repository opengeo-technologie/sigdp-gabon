export enum TypeArmement {
  ARMEMENT = "Armement",
  COOPERATIVE = "Cooperative",
}

export enum TypeCooperative {
  PECHEURS = "Pêcheurs",
  TRANSFORMATEURS = "Transformateurs",
  COMMERCANTS = "Commerçants",
}

export interface ArmementCooperative {
  id: number;
  denomination: string;
  type_association: TypeArmement;
  sigle: string;
  siege: string;
  date_creation: string;
  adresse: string;
  telephone: string;
  email: string;
  province: string;
  departement: string;
  localite: string;
}
