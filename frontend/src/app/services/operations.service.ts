import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

import { environment } from "../../environments/environment";
import {
  Operation,
  OperationDetail,
  Infraction,
  Saisie,
  ApiMessage,
  DashboardData,
  PeriodeFiltre,
} from "../models/operations.model";

/**
 * SIGPA — Service opérations / infractions / saisies.
 * Endpoints POST-only, préfixe /api/surveillance.
 */
@Injectable({ providedIn: "root" })
export class OperationsService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/surveillance`;

  // ---------------------------- Opérations ------------------------------
  listerOperations(missionId: number): Observable<Operation[]> {
    return this.http.post<Operation[]>(`${this.base}/operations/list`, {
      id: missionId,
    });
  }
  detailOperation(id: number): Observable<OperationDetail> {
    return this.http.post<OperationDetail>(`${this.base}/operations/get`, {
      id,
    });
  }
  creerOperation(o: Partial<Operation>): Observable<Operation> {
    return this.http.post<Operation>(`${this.base}/operations/create`, o);
  }
  modifierOperation(
    o: Partial<Operation> & { id: number },
  ): Observable<Operation> {
    return this.http.post<Operation>(`${this.base}/operations/update`, o);
  }
  supprimerOperation(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/operations/delete`, { id });
  }

  // ---------------------------- Infractions -----------------------------
  listerInfractions(operationId: number): Observable<Infraction[]> {
    return this.http.post<Infraction[]>(`${this.base}/infractions/list`, {
      id: operationId,
    });
  }
  creerInfraction(i: Partial<Infraction>): Observable<Infraction> {
    return this.http.post<Infraction>(`${this.base}/infractions/create`, i);
  }
  modifierInfraction(
    i: Partial<Infraction> & { id: number },
  ): Observable<Infraction> {
    return this.http.post<Infraction>(`${this.base}/infractions/update`, i);
  }
  supprimerInfraction(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/infractions/delete`, {
      id,
    });
  }

  // ------------------------------ Saisies -------------------------------
  listerSaisies(infractionId: number): Observable<Saisie[]> {
    return this.http.post<Saisie[]>(`${this.base}/saisies/list`, {
      id: infractionId,
    });
  }
  creerSaisie(s: Partial<Saisie>): Observable<Saisie> {
    return this.http.post<Saisie>(`${this.base}/saisies/create`, s);
  }
  modifierSaisie(s: Partial<Saisie> & { id: number }): Observable<Saisie> {
    return this.http.post<Saisie>(`${this.base}/saisies/update`, s);
  }
  supprimerSaisie(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/saisies/delete`, { id });
  }

  // SIGPA — Service tableau de bord & rapport de surveillance.

  dashboard(filtre: PeriodeFiltre = {}): Observable<DashboardData> {
    return this.http.post<DashboardData>(`${this.base}/dashboard`, filtre);
  }

  /** URL du rapport de surveillance (PDF) — aperçu navigateur. */
  rapportUrl(filtre: PeriodeFiltre = {}, download = false): string {
    const p = new URLSearchParams();
    if (filtre.date_debut) p.set("debut", filtre.date_debut);
    if (filtre.date_fin) p.set("fin", filtre.date_fin);
    if (download) p.set("download", "true");
    const qs = p.toString();
    return `${this.base}/rapport${qs ? "?" + qs : ""}`;
  }

  telechargerRapport(filtre: PeriodeFiltre = {}): Observable<Blob> {
    return this.http.get(this.rapportUrl(filtre, true), {
      responseType: "blob",
    });
  }
}
