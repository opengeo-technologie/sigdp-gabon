import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { Bateau } from "../models/bateau.model";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class BateauService {
  private apiUrl = `${environment.apiUrl}/api/bateaux`;

  constructor(private http: HttpClient) {}

  getBateaux(filters?: {
    skip?: number;
    limit?: number;
    type_bateau?: string;
    statut?: string;
    proprietaire_id?: number;
  }): Observable<Bateau[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.skip !== undefined)
        params = params.set("skip", filters.skip.toString());
      if (filters.limit !== undefined)
        params = params.set("limit", filters.limit.toString());
      if (filters.type_bateau)
        params = params.set("type_bateau", filters.type_bateau);
      if (filters.statut) params = params.set("statut", filters.statut);
      if (filters.proprietaire_id)
        params = params.set(
          "proprietaire_id",
          filters.proprietaire_id.toString(),
        );
    }

    return this.http.get<Bateau[]>(this.apiUrl, { params });
  }

  getBateau(id: number): Observable<Bateau> {
    return this.http.get<Bateau>(`${this.apiUrl}/${id}`);
  }

  getBateauByImmatriculation(numero: string): Observable<Bateau> {
    return this.http.get<Bateau>(`${this.apiUrl}/immatriculation/${numero}`);
  }

  createBateau(bateau: Partial<Bateau>): Observable<Bateau> {
    return this.http.post<Bateau>(this.apiUrl, bateau);
  }

  updateBateau(id: number, bateau: Partial<Bateau>): Observable<Bateau> {
    return this.http.put<Bateau>(`${this.apiUrl}/${id}`, bateau);
  }

  createBateauWithPhoto(bateau: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/with-photo`, bateau);
  }

  updateBateauWithPhoto(id: number, bateau: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/with-photo`, bateau);
  }

  deleteBateau(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getProprietaire(bateauId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/${bateauId}/proprietaire`);
  }

  getBateauxByProprietaire(pecheurId: number): Observable<Bateau[]> {
    return this.http.get<Bateau[]>(
      `${this.apiUrl}/proprietaire/${pecheurId}/bateaux`,
    );
  }
}
