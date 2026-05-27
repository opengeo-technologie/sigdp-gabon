import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { Debarquement, DebarquementCreate } from "../models/debarquement.model";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class DebarquementService {
  private apiUrl = `${environment.apiUrl}/api/debarquements`;

  constructor(private http: HttpClient) {}

  getDebarquements(filters?: {
    skip?: number;
    limit?: number;
    debarcadere_id?: number;
    pecheur_id?: number;
    bateau_id?: number;
    date_debut?: string;
    date_fin?: string;
    avec_alertes?: boolean;
  }): Observable<any> {
    let params = new HttpParams();

    if (filters) {
      if (filters.skip !== undefined)
        params = params.set("skip", filters.skip.toString());
      if (filters.limit !== undefined)
        params = params.set("limit", filters.limit.toString());
      if (filters.debarcadere_id)
        params = params.set(
          "debarcadere_id",
          filters.debarcadere_id.toString(),
        );
      if (filters.pecheur_id)
        params = params.set("pecheur_id", filters.pecheur_id.toString());
      if (filters.bateau_id)
        params = params.set("bateau_id", filters.bateau_id.toString());
      if (filters.date_debut)
        params = params.set("date_debut", filters.date_debut);
      if (filters.date_fin) params = params.set("date_fin", filters.date_fin);
      if (filters.avec_alertes !== undefined)
        params = params.set("avec_alertes", filters.avec_alertes.toString());
    }

    return this.http.get<any>(this.apiUrl, { params });
  }

  getDebarquement(id: number): Observable<Debarquement> {
    return this.http.get<Debarquement>(`${this.apiUrl}/${id}`);
  }

  createDebarquement(
    debarquement: DebarquementCreate,
  ): Observable<Debarquement> {
    return this.http.post<Debarquement>(this.apiUrl, debarquement);
  }

  getDebarquementsAvecAlertes(
    skip?: number,
    limit?: number,
  ): Observable<Debarquement[]> {
    let params = new HttpParams();
    if (skip !== undefined) params = params.set("skip", skip.toString());
    if (limit !== undefined) params = params.set("limit", limit.toString());

    return this.http.get<Debarquement[]>(`${this.apiUrl}/alertes/actives`, {
      params,
    });
  }

  getStatsResume(date_debut?: string, date_fin?: string): Observable<any> {
    let params = new HttpParams();
    if (date_debut) params = params.set("date_debut", date_debut);
    if (date_fin) params = params.set("date_fin", date_fin);

    return this.http.get(`${this.apiUrl}/stats/resume`, { params });
  }
}
