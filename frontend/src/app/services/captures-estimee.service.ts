// SIGPA — Module « Captures estimées » — Service HTTP
// Convention plateforme : endpoints POST uniquement, environment.apiUrl = '/api'.

import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../environments/environment";
import {
  CaptureCreate,
  CaptureEstimee,
  CaptureFiltre,
  CaptureListe,
  CaptureUpdate,
  Effort,
  Engin,
  Espece,
  FormatExport,
  ImportResultat,
  Stats,
} from "../models/capture-estimee.model";

@Injectable({
  providedIn: "root",
})
export class CapturesEstimeeService {
  private readonly base = `${environment.apiUrl}/api/captures-estimees`;

  constructor(private http: HttpClient) {}

  // -- Référentiels
  listerEngins(): Observable<Engin[]> {
    return this.http.post<Engin[]>(`${this.base}/engins/list`, {});
  }
  listerEspeces(): Observable<any[]> {
    return this.http.post<any[]>(`${this.base}/especes/list`, {});
  }

  // -- Captures (CRUD)
  lister(filtre: CaptureFiltre): Observable<CaptureListe> {
    return this.http.post<CaptureListe>(`${this.base}/list`, filtre);
  }
  obtenir(id: number): Observable<CaptureEstimee> {
    return this.http.post<CaptureEstimee>(`${this.base}/get`, { id });
  }
  creer(data: CaptureCreate): Observable<CaptureEstimee> {
    return this.http.post<CaptureEstimee>(`${this.base}/create`, data);
  }
  modifier(id: number, data: CaptureUpdate): Observable<CaptureEstimee> {
    // console.log("modifier", id, data);
    const req = { id: id };
    const payload = { req, data };
    return this.http.post<CaptureEstimee>(`${this.base}/update`, payload);
  }
  supprimer(id: number): Observable<{ succes: boolean; message: string }> {
    return this.http.post<{ succes: boolean; message: string }>(
      `${this.base}/delete`,
      { id },
    );
  }

  // -- Efforts & statistiques
  listerEfforts(filtre: any): Observable<Effort[]> {
    return this.http.post<Effort[]>(`${this.base}/efforts/list`, filtre);
  }
  stats(annee: number, engin_id?: number | null): Observable<Stats> {
    return this.http.post<Stats>(`${this.base}/stats`, { annee, engin_id });
  }

  // -- Import Excel (multipart)
  importerExcel(fichier: File, annee: number): Observable<ImportResultat> {
    const form = new FormData();
    form.append("fichier", fichier);
    form.append("annee", String(annee));
    return this.http.post<ImportResultat>(`${this.base}/import-excel`, form);
  }

  // -- Export (téléchargement binaire)
  exporter(format: FormatExport, filtre: CaptureFiltre): Observable<Blob> {
    return this.http.post(
      `${this.base}/export`,
      { format, filtre },
      { responseType: "blob" },
    );
  }
}
