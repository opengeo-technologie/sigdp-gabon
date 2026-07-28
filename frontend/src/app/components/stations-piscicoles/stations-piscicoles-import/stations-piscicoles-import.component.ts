// station-piscicole-import.component.ts
// Route à ajouter dans station-piscicole.routes.ts AVANT le path ':id' :
//   {
//     path: 'importer',
//     loadComponent: () =>
//       import('./station-piscicole-import.component')
//         .then(m => m.StationPiscicoleImportComponent),
//     title: 'Importer des stations — SIGDP-GABON',
//   },
import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { RouterLink } from "@angular/router";

import { environment } from "../../../../environments/environment";

declare const M: any;

interface RapportImport {
  total_lignes: number;
  importees: number;
  rejetees: number;
  erreurs: { ligne: number; nom: string; erreur: string }[];
}

@Component({
  selector: "app-stations-piscicoles-import",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./stations-piscicoles-import.component.html",
  styleUrl: "./stations-piscicoles-import.component.scss",
})
export class StationsPiscicolesImportComponent {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/stations-piscicoles`;

  fichier: File | null = null;
  envoiEnCours = false;
  rapport: RapportImport | null = null;

  fichierChoisi(evenement: Event): void {
    const cible = evenement.target as HTMLInputElement;
    this.fichier = cible.files?.[0] || null;
    this.rapport = null;
  }

  importer(): void {
    if (!this.fichier) return;

    const formData = new FormData();
    formData.append("fichier", this.fichier, this.fichier.name);

    this.envoiEnCours = true;
    // Pas de Content-Type manuel : le navigateur pose le boundary multipart
    this.http
      .post<RapportImport>(`${this.baseUrl}/import`, formData)
      .subscribe({
        next: (rapport) => {
          this.envoiEnCours = false;
          this.rapport = rapport;
          M.toast({
            html:
              `${rapport.importees} station(s) importée(s)` +
              (rapport.rejetees ? `, ${rapport.rejetees} rejetée(s)` : ""),
            classes: rapport.rejetees ? "orange" : "green",
          });
        },
        error: (err) => {
          this.envoiEnCours = false;
          M.toast({
            html: err?.error?.detail || "Erreur lors de l'import",
            classes: "red",
          });
        },
      });
  }

  telechargerModele(): void {
    this.http
      .post(`${this.baseUrl}/import/modele`, {}, { responseType: "blob" })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const lien = document.createElement("a");
          lien.href = url;
          lien.download = "modele_import_stations_piscicoles.xlsx";
          lien.click();
          URL.revokeObjectURL(url);
        },
        error: () =>
          M.toast({
            html: "Erreur lors du téléchargement du modèle",
            classes: "red",
          }),
      });
  }
}
