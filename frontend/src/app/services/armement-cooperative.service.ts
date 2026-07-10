import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import {
  TypeArmement,
  ArmementCooperative,
} from "../models/armement-cooperative.model";
import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class ArmementCooperativeService {
  private apiUrl = `${environment.apiUrl}/api/armements-cooperatives`;

  constructor(private http: HttpClient) {}

  getArmementsCooperatives(filters?: {
    skip?: number;
    limit?: number;
    type_association?: string;
    statut?: string;
    province?: string;
    localite?: string;
    cooperative_id?: number;
  }): Observable<ArmementCooperative[]> {
    let params = new HttpParams();

    if (filters) {
      if (filters.skip !== undefined)
        params = params.set("skip", filters.skip.toString());
      if (filters.limit !== undefined)
        params = params.set("limit", filters.limit.toString());
      if (filters.type_association)
        params = params.set("type_association", filters.type_association);
      if (filters.statut) params = params.set("statut", filters.statut);
      if (filters.province) params = params.set("province", filters.province);
      if (filters.localite) params = params.set("localite", filters.localite);
      if (filters.cooperative_id)
        params = params.set(
          "cooperative_id",
          filters.cooperative_id.toString(),
        );
    }

    return this.http.get<ArmementCooperative[]>(this.apiUrl, { params });
  }

  getArmementCooperative(id: number): Observable<ArmementCooperative> {
    return this.http.get<ArmementCooperative>(`${this.apiUrl}/${id}`);
  }

  getLocalitesArmementCooperative(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/list/localite`);
  }

  getBateauxArmementCooperative(
    armement_cooperative_id: number,
  ): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/bateaux/${armement_cooperative_id}`,
    );
  }

  searchArmementsCooperatives(
    query: string,
  ): Observable<ArmementCooperative[]> {
    let params = new HttpParams().set("filterBy", query);

    return this.http.get<ArmementCooperative[]>(
      `${this.apiUrl}/search/filterData`,
      {
        params,
      },
    );
  }

  createArmementCooperative(
    armementCooperative: Partial<ArmementCooperative>,
  ): Observable<ArmementCooperative> {
    return this.http.post<ArmementCooperative>(
      this.apiUrl,
      armementCooperative,
    );
  }

  updateArmementCooperative(
    id: number,
    armementCooperative: Partial<ArmementCooperative>,
  ): Observable<ArmementCooperative> {
    return this.http.put<ArmementCooperative>(
      `${this.apiUrl}/${id}`,
      armementCooperative,
    );
  }

  deleteArmementCooperative(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
