import type { FeatureCollection, MultiPolygon } from "geojson";

export type TypeZone =
  | "PARC_AQUATIQUE"
  | "ZEE"
  | "FRONTIERE_PAYS"
  | "FRONTIERE_REGION";

/** Propriétés renvoyées par POST /api/zones/geojson */
export interface ProprietesZone {
  id: number;
  type_zone: TypeZone;
  code: string | null;
  nom: string;
  code_parent: string | null;
  niveau: number | null;
  superficie_km2: number | null;
}

export type CollectionZones = FeatureCollection<MultiPolygon, ProprietesZone>;

export interface RequeteGeoJSON {
  type_zone?: TypeZone;
  types_zone?: TypeZone[];
  ids?: number[];
  bbox?: [number, number, number, number];
  tolerance?: number;
  limite?: number;
}

export interface ZoneLocalisee {
  id: number;
  type_zone: TypeZone;
  code: string | null;
  nom: string;
  code_parent: string | null;
  superficie_km2: number | null;
}

export interface ReponseLocalisation {
  nb_resultats: number;
  zones: ZoneLocalisee[];
}

export interface StatistiqueCouche {
  type_zone: TypeZone;
  nb_zones: number;
  superficie_totale_km2: number;
}

/**
 * Configuration d'affichage par couche.
 *
 * `zIndex` fixe l'ordre d'empilement via les panes Leaflet : la ZEE (immense)
 * reste au fond, les parcs (petits) au-dessus, sinon ils deviennent
 * inaccessibles au clic.
 *
 * `tolerance` est la simplification demandée au serveur, en degrés
 * (0.001 ≈ 100 m). Sans elle, le polygone de la ZEE fige le navigateur.
 */
export interface ConfigCouche {
  type: TypeZone;
  libelle: string;
  couleur: string;
  couleurRemplissage: string;
  opaciteRemplissage: number;
  epaisseur: number;
  pointilles?: string;
  zIndex: number;
  visibleParDefaut: boolean;
  tolerance: number;
}

export const COUCHES: readonly ConfigCouche[] = [
  {
    type: "ZEE",
    libelle: "Zone économique exclusive",
    couleur: "#1565c0",
    couleurRemplissage: "#42a5f5",
    opaciteRemplissage: 0.12,
    epaisseur: 2,
    zIndex: 405,
    visibleParDefaut: true,
    tolerance: 0.002,
  },
  {
    type: "FRONTIERE_PAYS",
    libelle: "Frontières nationales",
    couleur: "#37474f",
    couleurRemplissage: "#90a4ae",
    opaciteRemplissage: 0.05,
    epaisseur: 2.5,
    zIndex: 410,
    visibleParDefaut: true,
    tolerance: 0.001,
  },
  {
    type: "FRONTIERE_REGION",
    libelle: "Provinces",
    couleur: "#795548",
    couleurRemplissage: "#bcaaa4",
    opaciteRemplissage: 0.06,
    epaisseur: 1.2,
    pointilles: "4 3",
    zIndex: 415,
    visibleParDefaut: false,
    tolerance: 0.0005,
  },
  {
    type: "PARC_AQUATIQUE",
    libelle: "Parcs aquatiques",
    couleur: "#2e7d32",
    couleurRemplissage: "#66bb6a",
    opaciteRemplissage: 0.35,
    epaisseur: 1.5,
    zIndex: 420,
    visibleParDefaut: true,
    tolerance: 0.0002,
  },
] as const;
