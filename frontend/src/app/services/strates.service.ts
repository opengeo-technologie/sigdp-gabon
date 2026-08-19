import { inject, Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

@Injectable({
  providedIn: "root",
})
export class StratesService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/strates`;

  getStratesMajeures(filtre: any = {}): Observable<any> {
    return this.http.post<any>(`${this.base}/majeures/lister`, filtre);
  }

  getStratesMineures(filtre: any = {}): Observable<any> {
    return this.http.post<any>(`${this.base}/mineures/lister`, filtre);
  }
}
