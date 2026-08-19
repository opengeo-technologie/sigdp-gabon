import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

import { environment } from "../../environments/environment";
import {
  Fonction,
  Organisme,
  Agent,
  AgentFiltre,
  RefFiltre,
  ApiMessage,
} from "../models/agents.model";

@Injectable({
  providedIn: "root",
})
export class AgentControleService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/agents-controle`;

  // ------------------------------ Fonctions -----------------------------
  listerFonctions(f: RefFiltre = {}): Observable<Fonction[]> {
    return this.http.post<Fonction[]>(`${this.base}/fonctions/list`, f);
  }
  creerFonction(libelle: string): Observable<Fonction> {
    return this.http.post<Fonction>(`${this.base}/fonctions/create`, {
      libelle,
    });
  }
  modifierFonction(id: number, libelle: string): Observable<Fonction> {
    return this.http.post<Fonction>(`${this.base}/fonctions/update`, {
      id,
      libelle,
    });
  }
  supprimerFonction(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/fonctions/delete`, { id });
  }

  // ------------------------------ Organismes ----------------------------
  listerOrganismes(f: RefFiltre = {}): Observable<Organisme[]> {
    return this.http.post<Organisme[]>(`${this.base}/organismes/list`, f);
  }
  creerOrganisme(o: Partial<Organisme>): Observable<Organisme> {
    return this.http.post<Organisme>(`${this.base}/organismes/create`, o);
  }
  modifierOrganisme(
    o: Partial<Organisme> & { id: number },
  ): Observable<Organisme> {
    return this.http.post<Organisme>(`${this.base}/organismes/update`, o);
  }
  supprimerOrganisme(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/organismes/delete`, { id });
  }

  // -------------------------------- Agents ------------------------------
  listerAgents(f: AgentFiltre = {}): Observable<Agent[]> {
    return this.http.post<Agent[]>(`${this.base}/agents/list`, f);
  }
  detailAgent(id: number): Observable<Agent> {
    return this.http.post<Agent>(`${this.base}/agents/get`, { id });
  }
  creerAgent(a: Partial<Agent>): Observable<Agent> {
    return this.http.post<Agent>(`${this.base}/agents/create`, a);
  }
  modifierAgent(a: Partial<Agent> & { id: number }): Observable<Agent> {
    return this.http.post<Agent>(`${this.base}/agents/update`, a);
  }
  supprimerAgent(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/agents/delete`, { id });
  }
}
