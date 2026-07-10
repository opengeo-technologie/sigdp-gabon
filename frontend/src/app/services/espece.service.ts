import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { Espece } from "../models/espece.model";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class EspeceService {
  private apiUrl = `${environment.apiUrl}/api/especes`;

  constructor(private http: HttpClient) {}

  getEspeces(filters?: {
    skip?: number;
    limit?: number;
    categorie?: string;
    statut_reglementaire?: string;
    actif?: boolean;
    search?: string;
  }): Observable<Espece[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.skip !== undefined)
        params = params.set("skip", filters.skip.toString());
      if (filters.limit !== undefined)
        params = params.set("limit", filters.limit.toString());
      if (filters.categorie)
        params = params.set("categorie", filters.categorie);
      if (filters.statut_reglementaire)
        params = params.set(
          "statut_reglementaire",
          filters.statut_reglementaire,
        );
      if (filters.actif !== undefined)
        params = params.set("actif", filters.actif.toString());
      if (filters.search) params = params.set("search", filters.search);
    }

    return this.http.get<Espece[]>(this.apiUrl, { params });
  }

  getEspece(id: number): Observable<Espece> {
    return this.http.get<Espece>(`${this.apiUrl}/${id}`);
  }

  getEspeceByCode(code: string): Observable<Espece> {
    return this.http.get<Espece>(`${this.apiUrl}/code/${code}`);
  }

  createEspece(espece: Partial<Espece>): Observable<Espece> {
    return this.http.post<Espece>(this.apiUrl, espece);
  }

  updateEspece(id: number, espece: Partial<Espece>): Observable<Espece> {
    return this.http.put<Espece>(`${this.apiUrl}/${id}`, espece);
  }

  deleteEspece(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getEspecesProtegees(): Observable<Espece[]> {
    return this.http.get<Espece[]>(`${this.apiUrl}/proteges/list`);
  }

  getStatistiquesEspece(id: number, annee: number): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/statistiques/${id}?annee=${annee}`,
    );
  }

  getEspecesSousQuota(): Observable<Espece[]> {
    return this.http.get<Espece[]>(`${this.apiUrl}/quotas/list`);
  }

  uploadPhoto(id: number, photo: File): Observable<any> {
    const formData = new FormData();
    formData.append("photo", photo);
    return this.http.post(`${this.apiUrl}/${id}/photo`, formData);
  }

  createEspeceWithPhoto(espece: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/with-photo`, espece);
  }

  updateEspeceWithPhoto(id: number, espece: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}/with-photo`, espece);
  }

  getPhotoUrl(id: number): string {
    return `${this.apiUrl}/${id}/photo`;
  }
}
