import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { Observable } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class StatistiquesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/statistiques`;

  dashboardStats(): Observable<any> {
    return this.http.get<any>(`${this.base}/dashboard`);
  }
}
