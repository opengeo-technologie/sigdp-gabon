import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class LicencesAutorisationsService {
  private apiUrl = `${environment.apiUrl}/api/licences`;
  private apiUrlSignataires = `${environment.apiUrl}/api/signataires`;

  constructor(private http: HttpClient) {}

  getLicences(filters?: {
    skip?: number;
    limit?: number;
    type_licence?: string;
    statut?: string;
    pecheur_id?: number;
    expiration_avant?: string;
    a_renouveler?: string;
  }): Observable<any> {
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
    return this.http.get<any>(`${this.apiUrl}/`, { params });
  }

  getLicence(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  getLicencesByBateauId(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/bateau/${id}`);
  }

  getStatistiquesLicence(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/statistiques/captures/${id}`);
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

  // Méthodes pour les signatures
  getSignataires(filters?: {
    status?: boolean;
    exclure_ministre?: boolean;
  }): Observable<any[]> {
    let params = new HttpParams();
    if (filters) {
      if (filters.status !== undefined)
        params = params.set("statut", filters.status);
      if (filters.exclure_ministre !== undefined)
        params = params.set("exclure_ministre", filters.exclure_ministre);
    }
    return this.http.get<any[]>(`${this.apiUrlSignataires}/`, { params });
  }

  getSignataire(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrlSignataires}/${id}`);
  }

  getSignataireByRole(filters?: {
    status?: boolean;
    role?: string;
  }): Observable<any> {
    let params = new HttpParams();

    if (filters) {
      if (filters.status !== undefined)
        params = params.set("statut", filters.status);
      if (filters.role !== undefined) params = params.set("role", filters.role);
    }
    return this.http.get<any>(`${this.apiUrlSignataires}/signataire/by-role`, {
      params,
    });
  }

  createSignataire(signataireData: any): Observable<any> {
    return this.http.post(`${this.apiUrlSignataires}/`, signataireData);
  }

  setSignataireLicence(data: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/signataire-licence`, data);
  }

  updateSignataire(id: number, signataireData: any): Observable<any> {
    return this.http.put(`${this.apiUrlSignataires}/${id}`, signataireData);
  }

  deleteSignataire(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrlSignataires}/${id}`);
  }
}
