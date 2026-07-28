import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { Pecheur } from "../models/pecheur.model";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class PecheurService {
  private apiUrl = `${environment.apiUrl}/api/pecheurs`;

  constructor(private http: HttpClient) {}

  getPecheurs(filters?: {
    skip?: number;
    limit?: number;
    province?: string;
    categorie?: string;
    statut?: string;
    type_peche?: string;
  }): Observable<Pecheur[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.skip !== undefined)
        params = params.set("skip", filters.skip.toString());
      if (filters.limit !== undefined)
        params = params.set("limit", filters.limit.toString());
      if (filters.province) params = params.set("province", filters.province);
      if (filters.categorie)
        params = params.set("categorie", filters.categorie);
      if (filters.statut) params = params.set("statut", filters.statut);
      if (filters.type_peche)
        params = params.set("type_peche", filters.type_peche);
    }

    return this.http.get<Pecheur[]>(this.apiUrl, { params });
  }

  getPecheursDropdown(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getPecheur(id: number): Observable<Pecheur> {
    return this.http.get<Pecheur>(`${this.apiUrl}/${id}`);
  }

  getPecheurByNumero(numero_carte: string): Observable<Pecheur> {
    return this.http.get<Pecheur>(`${this.apiUrl}/numero/${numero_carte}`);
  }

  getPecheurPhotoUrl(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}/photo`);
  }

  createPecheur(pecheur: Partial<Pecheur>): Observable<Pecheur> {
    return this.http.post<Pecheur>(this.apiUrl, pecheur);
  }

  createPecheurWithPhoto(pecheur: any): Observable<Pecheur> {
    return this.http.post<any>(`${this.apiUrl}/with-photo`, pecheur);
  }

  updatePecheur(id: number, pecheur: Partial<Pecheur>): Observable<Pecheur> {
    return this.http.put<Pecheur>(`${this.apiUrl}/${id}`, pecheur);
  }

  updatePecheurWithPhoto(
    id: number,
    pecheur: Partial<any>,
  ): Observable<Pecheur> {
    return this.http.put<Pecheur>(`${this.apiUrl}/${id}/with-photo`, pecheur);
  }

  deletePecheur(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  uploadPhoto(id: number, photo: File): Observable<any> {
    const formData = new FormData();
    formData.append("photo", photo);
    return this.http.post(`${this.apiUrl}/${id}/photo`, formData);
  }

  getCartePecheurUrl(id: number): string {
    return `${this.apiUrl}/${id}/carte`;
  }

  getQRCodeUrl(id: number): string {
    return `${this.apiUrl}/${id}/qrcode`;
  }

  downloadCarte(id: number): void {
    window.open(this.getCartePecheurUrl(id), "_blank");
  }

  downloadQRCode(id: number): void {
    window.open(this.getQRCodeUrl(id), "_blank");
  }
}
