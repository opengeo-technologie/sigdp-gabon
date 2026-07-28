// station-piscicole-export-backend.service.ts
// Télécharge les exports générés côté serveur (registre COMPLET filtré,
// pas seulement la page courante). Aucune dépendance npm requise.
import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { environment } from "../../../environments/environment";

declare const M: any;

export interface FiltresExport {
  search?: string;
  province?: string;
  type_station?: string;
  statut?: string;
  espece?: string;
}

@Injectable({ providedIn: "root" })
export class StationPiscicoleExportBackendService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/stations-piscicoles/export`;

  exporterExcel(filtres: FiltresExport = {}): void {
    this.telecharger("excel", "xlsx", filtres);
  }

  exporterCSV(filtres: FiltresExport = {}): void {
    this.telecharger("csv", "csv", filtres);
  }

  exporterJSON(filtres: FiltresExport = {}): void {
    this.telecharger("json", "json", filtres);
  }

  exporterPDF(filtres: FiltresExport = {}): void {
    this.telecharger("pdf", "pdf", filtres);
  }

  private telecharger(
    endpoint: string,
    extension: string,
    filtres: FiltresExport,
  ): void {
    // Ne transmettre que les filtres renseignés
    const payload: FiltresExport = {
      search: filtres.search || undefined,
      province: filtres.province || undefined,
      type_station: filtres.type_station || undefined,
      statut: filtres.statut || undefined,
      espece: filtres.espece || undefined,
    };

    this.http
      .post(`${this.baseUrl}/${endpoint}`, payload, { responseType: "blob" })
      .subscribe({
        next: (blob) => {
          const d = new Date();
          const horodatage =
            `${d.getFullYear()}` +
            `${String(d.getMonth() + 1).padStart(2, "0")}` +
            `${String(d.getDate()).padStart(2, "0")}`;
          const url = URL.createObjectURL(blob);
          const lien = document.createElement("a");
          lien.href = url;
          lien.download = `stations_piscicoles_${horodatage}.${extension}`;
          lien.click();
          URL.revokeObjectURL(url);
        },
        error: () =>
          M.toast({
            html: `Erreur lors de l'export ${extension.toUpperCase()}`,
            classes: "red",
          }),
      });
  }
}
