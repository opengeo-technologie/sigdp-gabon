import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

import { environment } from "../../environments/environment";
import {
  Mission,
  MissionDetail,
  Equipe,
  Rapport,
  MissionFiltre,
  ApiMessage,
} from "../models/missions.model";

/**
 * SIGPA — Service missions / équipes / rapports.
 * Endpoints POST-only, préfixe /api/surveillance.
 */
@Injectable({ providedIn: "root" })
export class MissionsService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/missions-controle`;
  private readonly base_fiche = `${environment.apiUrl}/api/surveillance/missions`;

  // ------------------------------ Missions ------------------------------
  listerMissions(f: MissionFiltre = {}): Observable<Mission[]> {
    return this.http.post<Mission[]>(`${this.base}/missions/list`, f);
  }
  detailMission(id: number): Observable<MissionDetail> {
    return this.http.post<MissionDetail>(`${this.base}/missions/get`, { id });
  }
  creerMission(m: Partial<Mission>): Observable<Mission> {
    return this.http.post<Mission>(`${this.base}/missions/create`, m);
  }
  modifierMission(m: Partial<Mission> & { id: number }): Observable<Mission> {
    return this.http.post<Mission>(`${this.base}/missions/update`, m);
  }
  supprimerMission(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/missions/delete`, { id });
  }
  uploaderScan(mission_id: number, fichier: File): Observable<ApiMessage> {
    const fd = new FormData();
    fd.append("mission_id", String(mission_id));
    fd.append("fichier", fichier);
    return this.http.post<ApiMessage>(
      `${this.base}/missions/upload-rapport-scan`,
      fd,
    );
  }

  // telechargerFicheMission(
  //   id: number,
  //   empty: boolean = false,
  //   download: boolean = false,
  // ): Observable<any> {
  //   return this.http.get<any>(
  //     `${this.base_fiche}/${id}/fiche?vierge=${empty}&download=${download}`,
  //   );
  // }

  /** URL directe de la fiche de mission (PDF) — aperçu navigateur. */
  ficheUrl(
    missionId: number,
    opts: { vierge?: boolean; download?: boolean } = {},
  ): string {
    const p = new URLSearchParams();
    if (opts.vierge) p.set("vierge", "true");
    if (opts.download) p.set("download", "true");
    const qs = p.toString();
    return `${this.base_fiche}/${missionId}/fiche${qs ? "?" + qs : ""}`;
  }

  /** Téléchargement de la fiche en blob (responseType blob obligatoire). */
  telechargerFiche(missionId: number, vierge = false): Observable<Blob> {
    return this.http.get(this.ficheUrl(missionId, { vierge, download: true }), {
      responseType: "blob",
    });
  }

  // ------------------------------ Équipes -------------------------------
  listerMembres(missionId: number): Observable<Equipe[]> {
    return this.http.post<Equipe[]>(`${this.base}/equipes/list`, {
      id: missionId,
    });
  }
  ajouterMembre(
    mission_id: number,
    agent_id: number,
    role_agent?: string,
  ): Observable<Equipe> {
    return this.http.post<Equipe>(`${this.base}/equipes/add`, {
      mission_id,
      agent_id,
      role_agent,
    });
  }
  ajouterMembres(
    mission_id: number,
    agent_ids: number[],
    role_agent?: string,
  ): Observable<Equipe[]> {
    return this.http.post<Equipe[]>(`${this.base}/equipes/add-bulk`, {
      mission_id,
      agent_ids,
      role_agent,
    });
  }
  modifierRole(id: number, role_agent: string): Observable<Equipe> {
    return this.http.post<Equipe>(`${this.base}/equipes/update`, {
      id,
      role_agent,
    });
  }
  retirerMembre(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/equipes/remove`, { id });
  }

  // ------------------------------ Rapports ------------------------------
  listerRapports(missionId: number): Observable<Rapport[]> {
    return this.http.post<Rapport[]>(`${this.base}/rapports/list`, {
      id: missionId,
    });
  }
  creerRapport(r: Partial<Rapport>): Observable<Rapport> {
    return this.http.post<Rapport>(`${this.base}/rapports/create`, r);
  }
  modifierRapport(r: Partial<Rapport> & { id: number }): Observable<Rapport> {
    return this.http.post<Rapport>(`${this.base}/rapports/update`, r);
  }
  supprimerRapport(id: number): Observable<ApiMessage> {
    return this.http.post<ApiMessage>(`${this.base}/rapports/delete`, { id });
  }
}
