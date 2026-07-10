// src/app/services/mareyeur-export.service.ts
// Module Mareyeurs - SIGDP-GABON
// Export des données : Excel (classeur 4 feuilles), CSV (texte) et JSON.
//
// Dépendance : npm install xlsx   (SheetJS)

import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import * as XLSX from "xlsx";

import { MareyeurService } from "../mareyeur.service";
import {
  Mareyeur,
  AgrementMareyage,
  InstallationMareyage,
  TransactionAchat,
  MareyeurListFilter,
  LIBELLES_STATUT_MAREYEUR,
  LIBELLES_STATUT_AGREMENT,
  LIBELLES_CATEGORIE_AGREMENT,
} from "../../models/mareyeur.model";

export type FormatExport = "xlsx" | "csv" | "json";

const LIBELLES_TYPE_INSTALLATION: Record<string, string> = {
  chambre_froide: "Chambre froide",
  vehicule_frigorifique: "Véhicule frigorifique",
  entrepot: "Entrepôt",
  etal: "Étal",
  autre: "Autre",
};

@Injectable({ providedIn: "root" })
export class MareyeurExportService {
  private mareyeurService = inject(MareyeurService);

  /**
   * Exporte les données du module dans le format demandé.
   * Le filtre (statut / recherche) de la liste est respecté pour les
   * mareyeurs ; les agréments, installations et transactions exportés
   * sont ceux des mareyeurs retenus.
   */
  async exporter(
    format: FormatExport,
    filtre?: Partial<MareyeurListFilter>,
  ): Promise<void> {
    // 1. Récupération des mareyeurs (toutes pages confondues)
    const reponse = await firstValueFrom(
      this.mareyeurService.listerMareyeurs({
        statut: filtre?.statut || null,
        recherche: filtre?.recherche || null,
        page: 1,
        taille_page: 100000,
      }),
    );
    const mareyeurs = reponse.resultats;
    const ids = new Set(mareyeurs.map((m) => m.id));

    // 2. Données liées (filtrées sur les mareyeurs retenus)
    const [agrements, installations, transactions] = await Promise.all([
      firstValueFrom(
        this.mareyeurService.listerAgrements({ page: 1, taille_page: 100000 }),
      ).then((r) => r.resultats.filter((a) => ids.has(a.mareyeur_id))),
      firstValueFrom(this.mareyeurService.listerInstallations({})).then(
        (liste) => liste.filter((i) => ids.has(i.mareyeur_id)),
      ),
      firstValueFrom(
        this.mareyeurService.listerTransactions({
          page: 1,
          taille_page: 100000,
        }),
      ).then((r) => r.resultats.filter((t) => ids.has(t.mareyeur_id))),
    ]);

    const horodatage = new Date().toISOString().slice(0, 10);
    const nomBase = `mareyeurs_sigdp_${horodatage}`;

    switch (format) {
      case "xlsx":
        this.exporterExcel(
          nomBase,
          mareyeurs,
          agrements,
          installations,
          transactions,
        );
        break;
      case "csv":
        this.exporterCsv(nomBase, mareyeurs);
        break;
      case "json":
        this.exporterJson(
          nomBase,
          mareyeurs,
          agrements,
          installations,
          transactions,
        );
        break;
    }
  }

  // ------------------------------------------------------------------ //
  // Excel : classeur à 4 feuilles
  // ------------------------------------------------------------------ //

  private exporterExcel(
    nomBase: string,
    mareyeurs: Mareyeur[],
    agrements: AgrementMareyage[],
    installations: InstallationMareyage[],
    transactions: TransactionAchat[],
  ): void {
    const parCode = new Map(mareyeurs.map((m) => [m.id, m.code]));

    const classeur = XLSX.utils.book_new();

    const feuilleMareyeurs = XLSX.utils.json_to_sheet(
      mareyeurs.map((m) => this.ligneMareyeur(m)),
    );
    const feuilleAgrements = XLSX.utils.json_to_sheet(
      agrements.map((a) => this.ligneAgrement(a, parCode)),
    );
    const feuilleInstallations = XLSX.utils.json_to_sheet(
      installations.map((i) => this.ligneInstallation(i, parCode)),
    );
    const feuilleTransactions = XLSX.utils.json_to_sheet(
      transactions.map((t) => this.ligneTransaction(t, parCode)),
    );

    XLSX.utils.book_append_sheet(classeur, feuilleMareyeurs, "Mareyeurs");
    XLSX.utils.book_append_sheet(classeur, feuilleAgrements, "Agréments");
    XLSX.utils.book_append_sheet(
      classeur,
      feuilleInstallations,
      "Installations",
    );
    XLSX.utils.book_append_sheet(classeur, feuilleTransactions, "Transactions");

    XLSX.writeFile(classeur, `${nomBase}.xlsx`);
  }

  // ------------------------------------------------------------------ //
  // CSV (texte) : mareyeurs à plat
  // Séparateur point-virgule + BOM UTF-8 pour ouverture directe dans
  // Excel en français sans casser les accents.
  // ------------------------------------------------------------------ //

  private exporterCsv(nomBase: string, mareyeurs: Mareyeur[]): void {
    const lignes = mareyeurs.map((m) => this.ligneMareyeur(m));
    if (lignes.length === 0) {
      return;
    }

    const entetes = Object.keys(lignes[0]);
    const echapper = (valeur: unknown): string => {
      const s = valeur == null ? "" : String(valeur);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const contenu = [
      entetes.join(";"),
      ...lignes.map((l) =>
        entetes.map((e) => echapper((l as any)[e])).join(";"),
      ),
    ].join("\r\n");

    this.telecharger(
      `${nomBase}.csv`,
      new Blob(["\uFEFF" + contenu], { type: "text/csv;charset=utf-8" }),
    );
  }

  // ------------------------------------------------------------------ //
  // JSON : structure imbriquée (chaque mareyeur avec ses données liées)
  // ------------------------------------------------------------------ //

  private exporterJson(
    nomBase: string,
    mareyeurs: Mareyeur[],
    agrements: AgrementMareyage[],
    installations: InstallationMareyage[],
    transactions: TransactionAchat[],
  ): void {
    const donnees = {
      export: {
        source: "SIGDP-GABON — Module Mareyeurs",
        date: new Date().toISOString(),
        nombre_mareyeurs: mareyeurs.length,
      },
      mareyeurs: mareyeurs.map((m) => ({
        ...m,
        agrements: agrements.filter((a) => a.mareyeur_id === m.id),
        installations: installations.filter((i) => i.mareyeur_id === m.id),
        transactions: transactions.filter((t) => t.mareyeur_id === m.id),
      })),
    };

    this.telecharger(
      `${nomBase}.json`,
      new Blob([JSON.stringify(donnees, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
    );
  }

  // ------------------------------------------------------------------ //
  // Mise à plat des entités (libellés français pour Excel/CSV)
  // ------------------------------------------------------------------ //

  private ligneMareyeur(m: Mareyeur): Record<string, unknown> {
    return {
      Code: m.code,
      Type:
        m.type_personne === "morale" ? "Personne morale" : "Personne physique",
      Nom: m.nom || "",
      Prénom: m.prenom || "",
      "Raison sociale": m.raison_sociale || "",
      Sexe: m.sexe || "",
      "Date de naissance": m.date_naissance || "",
      "Lieu de naissance": m.lieu_naissance || "",
      Nationalité: m.nationalite || "",
      NIF: m.nif || "",
      RCCM: m.rccm || "",
      Téléphone: m.telephone || "",
      Email: m.email || "",
      Adresse: m.adresse || "",
      "Zones d\u2019activité": m.zones_activite || "",
      "Sites de débarquement": m.sites_debarquement || "",
      Statut: LIBELLES_STATUT_MAREYEUR[m.statut] || m.statut,
      "Créé le": (m.created_at || "").slice(0, 10),
    };
  }

  private ligneAgrement(
    a: AgrementMareyage,
    parCode: Map<number | undefined, string | undefined>,
  ): Record<string, unknown> {
    return {
      "Code agrément": a.code,
      "Code mareyeur": parCode.get(a.mareyeur_id) || a.mareyeur_id,
      Catégorie: LIBELLES_CATEGORIE_AGREMENT[a.categorie] || a.categorie,
      "Date demande": a.date_demande || "",
      "Date délivrance": a.date_delivrance || "",
      "Durée (mois)": a.duree_validite_mois,
      "Date expiration": a.date_expiration || "",
      "Redevance (FCFA)": a.montant_redevance ?? "",
      Statut: LIBELLES_STATUT_AGREMENT[a.statut || ""] || a.statut,
      Motif: a.motif_statut || "",
    };
  }

  private ligneInstallation(
    i: InstallationMareyage,
    parCode: Map<number | undefined, string | undefined>,
  ): Record<string, unknown> {
    return {
      "Code mareyeur": parCode.get(i.mareyeur_id) || i.mareyeur_id,
      Type:
        LIBELLES_TYPE_INSTALLATION[i.type_installation] || i.type_installation,
      Désignation: i.designation,
      "Capacité (t)": i.capacite_tonnes ?? "",
      Immatriculation: i.immatriculation || "",
      Adresse: i.adresse || "",
      Latitude: i.latitude ?? "",
      Longitude: i.longitude ?? "",
      Statut: i.statut === "fonctionnelle" ? "Fonctionnelle" : "Hors service",
    };
  }

  private ligneTransaction(
    t: TransactionAchat,
    parCode: Map<number | undefined, string | undefined>,
  ): Record<string, unknown> {
    return {
      Code: t.code,
      "Code mareyeur": parCode.get(t.mareyeur_id) || t.mareyeur_id,
      Date: t.date_transaction,
      "Site de débarquement": t.site_debarquement || "",
      Pêcheur: t.pecheur || "",
      Pirogue: t.pirogue || "",
      Espèce: t.espece,
      "Quantité (kg)": t.quantite_kg,
      "Prix unitaire (FCFA)": t.prix_unitaire_fcfa ?? "",
      "Montant (FCFA)": t.montant_total_fcfa ?? "",
    };
  }

  // ------------------------------------------------------------------ //

  private telecharger(nomFichier: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomFichier;
    lien.click();
    URL.revokeObjectURL(url);
  }
}
