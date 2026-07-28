// station-piscicole.service.ts
import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

import { environment } from "../../environments/environment";
import {
  StationPiscicole,
  StationPiscicoleDetail,
  StationListRequest,
  StationListResponse,
  CycleProduction,
  StatsResponse,
} from "../models/stations-piscicole.model";

@Injectable({ providedIn: "root" })
export class StationPiscicoleService {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/stations-piscicoles`;

  // -------------------------------------------------------------------------
  // Stations
  // -------------------------------------------------------------------------

  lister(filtres: StationListRequest): Observable<StationListResponse> {
    return this.http.post<StationListResponse>(`${this.baseUrl}/list`, filtres);
  }

  obtenir(id: number): Observable<StationPiscicoleDetail> {
    return this.http.post<StationPiscicoleDetail>(`${this.baseUrl}/get`, {
      id,
    });
  }

  creer(station: Partial<StationPiscicole>): Observable<StationPiscicole> {
    return this.http.post<StationPiscicole>(`${this.baseUrl}/create`, station);
  }

  modifier(
    station: Partial<StationPiscicole> & { id: number },
  ): Observable<StationPiscicole> {
    return this.http.post<StationPiscicole>(`${this.baseUrl}/update`, station);
  }

  supprimer(id: number): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/delete`,
      { id },
    );
  }

  changerStatut(
    id: number,
    nouveau_statut: string,
    motif?: string,
  ): Observable<StationPiscicole> {
    return this.http.post<StationPiscicole>(`${this.baseUrl}/changer-statut`, {
      id,
      nouveau_statut,
      motif,
    });
  }

  stats(): Observable<StatsResponse> {
    return this.http.post<StatsResponse>(`${this.baseUrl}/stats`, {});
  }

  // -------------------------------------------------------------------------
  // Cycles de production
  // -------------------------------------------------------------------------

  creerCycle(
    cycle: Partial<CycleProduction> & { station_id: number },
  ): Observable<CycleProduction> {
    return this.http.post<CycleProduction>(
      `${this.baseUrl}/cycles/create`,
      cycle,
    );
  }

  modifierCycle(
    cycle: Partial<CycleProduction> & { id: number },
  ): Observable<CycleProduction> {
    return this.http.post<CycleProduction>(
      `${this.baseUrl}/cycles/update`,
      cycle,
    );
  }

  recolterCycle(payload: {
    id: number;
    date_recolte_effective: string;
    tonnage_recolte: number;
    taux_mortalite?: number;
    observations?: string;
  }): Observable<CycleProduction> {
    return this.http.post<CycleProduction>(
      `${this.baseUrl}/cycles/recolter`,
      payload,
    );
  }

  abandonnerCycle(id: number): Observable<CycleProduction> {
    return this.http.post<CycleProduction>(
      `${this.baseUrl}/cycles/abandonner`,
      { id },
    );
  }

  supprimerCycle(
    id: number,
  ): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/cycles/delete`,
      { id },
    );
  }
}
