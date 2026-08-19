import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { Bateau } from "../models/bateau.model";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class InfractionsService {
  private apiUrl = `${environment.apiUrl}/api/infractions`;

  constructor(private http: HttpClient) {}

  getInfractions(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  getInfraction(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  createInfraction(payload: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, payload);
  }

  updateInfraction(id: number, payload: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, payload);
  }

  deleteInfraction(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
