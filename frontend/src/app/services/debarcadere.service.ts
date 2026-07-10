import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { Debarcadere } from "../models/debarcadere.model";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class DebarcadereService {
  private apiUrl = `${environment.apiUrl}/api/debarcaderes`;

  constructor(private http: HttpClient) {}

  getLocalites(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/site/localite`);
  }

  getDebarcaderes(filters?: {
    skip?: number;
    limit?: number;
    province?: string;
    type?: string;
    statut?: string;
  }): Observable<any> {
    let params = new HttpParams();

    if (filters) {
      if (filters.skip !== undefined)
        params = params.set("skip", filters.skip.toString());
      if (filters.limit !== undefined)
        params = params.set("limit", filters.limit.toString());
      if (filters.province) params = params.set("province", filters.province);
      if (filters.type) params = params.set("type", filters.type);
      if (filters.statut) params = params.set("statut", filters.statut);
    }

    return this.http.get<any>(this.apiUrl, { params });
  }

  getDebarcadere(id: number): Observable<Debarcadere> {
    return this.http.get<Debarcadere>(`${this.apiUrl}/${id}`);
  }

  getDebarcadereByCode(code: string): Observable<Debarcadere> {
    return this.http.get<Debarcadere>(`${this.apiUrl}/code/${code}`);
  }

  getStatistiquesDebarcadere(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/statistiques/${id}`);
  }

  createDebarcadere(
    debarcadere: Partial<Debarcadere>,
  ): Observable<Debarcadere> {
    return this.http.post<Debarcadere>(this.apiUrl, debarcadere);
  }

  updateDebarcadere(
    id: number,
    debarcadere: Partial<Debarcadere>,
  ): Observable<Debarcadere> {
    return this.http.put<Debarcadere>(`${this.apiUrl}/${id}`, debarcadere);
  }

  deleteDebarcadere(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getDebarcaderesGeoJSON(): Observable<any> {
    return this.http.get(`${this.apiUrl}/geojson/all`);
  }

  getDebarcaderePhotoUrl(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/photo`);
  }

  createDebarcadereWithPhoto(debarcadere: any): Observable<Debarcadere> {
    return this.http.post<any>(`${this.apiUrl}/with-photo`, debarcadere);
  }

  updateDebarcadereWithPhoto(
    id: number,
    debarcadere: any,
  ): Observable<Debarcadere> {
    return this.http.put<any>(`${this.apiUrl}/${id}/with-photo`, debarcadere);
  }
}
