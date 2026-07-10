// src/app/services/mareyeur.service.ts
// Module Mareyeurs - SIGDP-GABON
// Pattern SIGDP : tous les appels en POST avec body JSON, apiUrl depuis environments

import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

import { environment } from "../../environments/environment";
import {
  Mareyeur,
  MareyeurListFilter,
  MareyeurListResponse,
  AgrementMareyage,
  AgrementListResponse,
  InstallationMareyage,
  TransactionAchat,
  TransactionListResponse,
  StatistiquesMareyeurs,
} from "../models/mareyeur.model";

@Injectable({ providedIn: "root" })
export class MareyeurService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/mareyeurs`;

  // ------------------------------------------------------------------ //
  // Mareyeurs
  // ------------------------------------------------------------------ //

  listerMareyeurs(
    filtre: MareyeurListFilter,
  ): Observable<MareyeurListResponse> {
    return this.http.post<MareyeurListResponse>(`${this.apiUrl}/liste`, filtre);
  }

  detailsMareyeur(id: number): Observable<Mareyeur> {
    return this.http.post<Mareyeur>(`${this.apiUrl}/details`, { id });
  }

  creerMareyeur(mareyeur: Mareyeur): Observable<Mareyeur> {
    return this.http.post<Mareyeur>(`${this.apiUrl}/creer`, mareyeur);
  }

  modifierMareyeur(mareyeur: Mareyeur): Observable<Mareyeur> {
    return this.http.post<Mareyeur>(`${this.apiUrl}/modifier`, mareyeur);
  }

  supprimerMareyeur(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/supprimer`, {
      id,
    });
  }

  statistiques(): Observable<StatistiquesMareyeurs> {
    return this.http.post<StatistiquesMareyeurs>(
      `${this.apiUrl}/statistiques`,
      {},
    );
  }

  // ------------------------------------------------------------------ //
  // Agréments
  // ------------------------------------------------------------------ //

  listerAgrements(filtre: {
    mareyeur_id?: number | null;
    statut?: string | null;
    categorie?: string | null;
    page?: number;
    taille_page?: number;
  }): Observable<AgrementListResponse> {
    return this.http.post<AgrementListResponse>(
      `${this.apiUrl}/agrements/liste`,
      { page: 1, taille_page: 25, ...filtre },
    );
  }

  agrementsExpirant(jours: number = 30): Observable<AgrementListResponse> {
    return this.http.post<AgrementListResponse>(
      `${this.apiUrl}/agrements/expirant`,
      { jours },
    );
  }

  detailsAgrement(id: number): Observable<AgrementMareyage> {
    return this.http.post<AgrementMareyage>(
      `${this.apiUrl}/agrements/details`,
      { id },
    );
  }

  creerAgrement(agrement: AgrementMareyage): Observable<AgrementMareyage> {
    return this.http.post<AgrementMareyage>(
      `${this.apiUrl}/agrements/creer`,
      agrement,
    );
  }

  modifierAgrement(
    agrement: Partial<AgrementMareyage>,
  ): Observable<AgrementMareyage> {
    return this.http.post<AgrementMareyage>(
      `${this.apiUrl}/agrements/modifier`,
      agrement,
    );
  }

  delivrerAgrement(id: number): Observable<AgrementMareyage> {
    return this.http.post<AgrementMareyage>(
      `${this.apiUrl}/agrements/delivrer`,
      { id },
    );
  }

  suspendreAgrement(id: number, motif: string): Observable<AgrementMareyage> {
    return this.http.post<AgrementMareyage>(
      `${this.apiUrl}/agrements/suspendre`,
      { id, motif },
    );
  }

  retirerAgrement(id: number, motif: string): Observable<AgrementMareyage> {
    return this.http.post<AgrementMareyage>(
      `${this.apiUrl}/agrements/retirer`,
      { id, motif },
    );
  }

  renouvelerAgrement(
    id: number,
    duree_validite_mois: number,
    montant_redevance?: number | null,
  ): Observable<AgrementMareyage> {
    return this.http.post<AgrementMareyage>(
      `${this.apiUrl}/agrements/renouveler`,
      { id, duree_validite_mois, montant_redevance },
    );
  }

  supprimerAgrement(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/agrements/supprimer`,
      { id },
    );
  }

  // ------------------------------------------------------------------ //
  // Installations
  // ------------------------------------------------------------------ //

  listerInstallations(filtre: {
    mareyeur_id?: number | null;
    type_installation?: string | null;
  }): Observable<InstallationMareyage[]> {
    return this.http.post<InstallationMareyage[]>(
      `${this.apiUrl}/installations/liste`,
      filtre,
    );
  }

  creerInstallation(
    installation: InstallationMareyage,
  ): Observable<InstallationMareyage> {
    return this.http.post<InstallationMareyage>(
      `${this.apiUrl}/installations/creer`,
      installation,
    );
  }

  modifierInstallation(
    installation: InstallationMareyage,
  ): Observable<InstallationMareyage> {
    return this.http.post<InstallationMareyage>(
      `${this.apiUrl}/installations/modifier`,
      installation,
    );
  }

  supprimerInstallation(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/installations/supprimer`,
      { id },
    );
  }

  // ------------------------------------------------------------------ //
  // Transactions d'achat
  // ------------------------------------------------------------------ //

  listerTransactions(filtre: {
    mareyeur_id?: number | null;
    espece?: string | null;
    date_debut?: string | null;
    date_fin?: string | null;
    page?: number;
    taille_page?: number;
  }): Observable<TransactionListResponse> {
    return this.http.post<TransactionListResponse>(
      `${this.apiUrl}/transactions/liste`,
      { page: 1, taille_page: 25, ...filtre },
    );
  }

  creerTransaction(
    transaction: TransactionAchat,
  ): Observable<TransactionAchat> {
    return this.http.post<TransactionAchat>(
      `${this.apiUrl}/transactions/creer`,
      transaction,
    );
  }

  modifierTransaction(
    transaction: TransactionAchat,
  ): Observable<TransactionAchat> {
    return this.http.post<TransactionAchat>(
      `${this.apiUrl}/transactions/modifier`,
      transaction,
    );
  }

  supprimerTransaction(id: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/transactions/supprimer`,
      { id },
    );
  }
}
