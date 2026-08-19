// mareyeur-stats.service.ts
import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import {
  FiltreStatistiques,
  StatistiquesMareyeurs,
} from "../models/mareyeur-stats.model";
import { environment } from "../../environments/environment";

@Injectable({ providedIn: "root" })
export class MareyeurStatsService {
  private http = inject(HttpClient);

  // Adapter au besoin (ex. `${environment.apiUrl}/api/mareyeurs`).
  private readonly base = `${environment.apiUrl}/api/mareyeurs/rapport`;

  /** Statistiques complètes (JSON prêt Chart.js). */
  getStatistiques(
    filtre: FiltreStatistiques = {},
  ): Observable<StatistiquesMareyeurs> {
    return this.http.post<StatistiquesMareyeurs>(
      `${this.base}/statistiques`,
      filtre,
    );
  }

  /** Rapport PDF (flux binaire à télécharger). */
  exporterPdf(filtre: FiltreStatistiques = {}): Observable<Blob> {
    return this.http.post(`${this.base}/statistiques/export/pdf`, filtre, {
      responseType: "blob",
    });
  }
}
