import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class LicencesAutorisationsService {
  private apiUrl = `${environment.apiUrl}/api/licences`;

  constructor(private http: HttpClient) {}

  getLicences(filters?: {
    skip?: number;
    limit?: number;
    type_licence?: string;
    statut?: string;
    pecheur_id?: number;
    expiration_avant?: string;
    a_renouveler?: string;
  }): Observable<any[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.skip !== undefined)
        params = params.set("skip", filters.skip.toString());
      if (filters.limit !== undefined)
        params = params.set("limit", filters.limit.toString());
      if (filters.type_licence)
        params = params.set("type_licence", filters.type_licence);
      if (filters.statut) params = params.set("statut", filters.statut);
      if (filters.pecheur_id)
        params = params.set("pecheur_id", filters.pecheur_id.toString());
      if (filters.expiration_avant)
        params = params.set("expiration_avant", filters.expiration_avant);
      if (filters.a_renouveler)
        params = params.set("a_renouveler", filters.a_renouveler);
    }
    return this.http.get<any[]>(`${this.apiUrl}/`, { params });
  }

  getLicence(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  createLicence(licenceData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/`, licenceData);
  }

  updateLicence(id: number, licenceData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, licenceData);
  }

  deleteLicence(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
