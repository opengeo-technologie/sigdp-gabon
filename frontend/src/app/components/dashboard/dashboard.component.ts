import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1><i class="material-icons left">dashboard</i> Tableau de bord</h1>
        <p>Vue d'ensemble du système SIG-PECHE</p>
      </div>
    </div>

    <div class="container-fluid">
      <!-- Statistiques principales -->
      <div class="row">
        <div class="col s12 m6 l3">
          <div class="card stat-card">
            <i class="material-icons medium teal-text">location_on</i>
            <h3>{{ stats.globaux?.debarcaderes_actifs || 0 }}</h3>
            <p>Débarcadères actifs</p>
          </div>
        </div>
        <div class="col s12 m6 l3">
          <div class="card stat-card">
            <i class="material-icons medium blue-text">people</i>
            <h3>{{ stats.globaux?.pecheurs_actifs || 0 }}</h3>
            <p>Pêcheurs actifs</p>
          </div>
        </div>
        <div class="col s12 m6 l3">
          <div class="card stat-card">
            <i class="material-icons medium orange-text">directions_boat</i>
            <h3>{{ stats.globaux?.bateaux_actifs || 0 }}</h3>
            <p>Bateaux actifs</p>
          </div>
        </div>
        <div class="col s12 m6 l3">
          <div class="card stat-card">
            <i class="material-icons medium green-text">assessment</i>
            <h3>{{ stats.globaux?.debarquements_mois || 0 }}</h3>
            <p>Débarquements ce mois</p>
          </div>
        </div>
      </div>

      <!-- Captures et valeur -->
      <div class="row">
        <div class="col s12 m6">
          <div class="card">
            <div class="card-content">
              <span class="card-title">
                <i class="material-icons left">scale</i>
                Captures du mois
              </span>
              <h4 class="blue-text">
                {{ stats.captures_mois?.quantite_tonnes || 0 }} tonnes
              </h4>
              <p class="grey-text">
                {{ stats.captures_mois?.quantite_kg || 0 }} kg
              </p>
            </div>
          </div>
        </div>
        <div class="col s12 m6">
          <div class="card">
            <div class="card-content">
              <span class="card-title">
                <i class="material-icons left">attach_money</i>
                Valeur commerciale
              </span>
              <h4 class="green-text">
                {{ stats.captures_mois?.valeur_fcfa || 0 | number: "1.0-0" }}
                FCFA
              </h4>
              <p class="grey-text">Mois en cours</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Alertes et top espèces -->
      <div class="row">
        <div class="col s12 l4">
          <div class="card">
            <div class="card-content">
              <span class="card-title">
                <i class="material-icons left red-text">warning</i>
                Alertes
              </span>
              <div class="alerte-item">
                <span class="badge red white-text">{{
                  stats.alertes?.actives_mois || 0
                }}</span>
                <p>Alertes actives ce mois</p>
              </div>
              <div class="alerte-item">
                <span class="badge orange white-text">{{
                  stats.alertes?.licences_a_renouveler || 0
                }}</span>
                <p>Licences à renouveler (30 jours)</p>
              </div>
              <a
                routerLink="/debarquements"
                [queryParams]="{ alertes: true }"
                class="btn-small waves-effect"
              >
                Voir les alertes
              </a>
            </div>
          </div>

          <div class="card">
            <div class="card-content">
              <span class="card-title">Accès rapides</span>
              <div class="collection">
                <a routerLink="/debarcaderes/new" class="collection-item">
                  <i class="material-icons left">add_location</i>
                  Nouveau débarcadère
                </a>
                <a routerLink="/pecheurs/new" class="collection-item">
                  <i class="material-icons left">person_add</i>
                  Nouveau pêcheur
                </a>
                <a routerLink="/bateaux/new" class="collection-item">
                  <i class="material-icons left">add</i>
                  Nouveau bateau
                </a>
                <a routerLink="/debarquements/new" class="collection-item">
                  <i class="material-icons left">note_add</i>
                  Enregistrer débarquement
                </a>
              </div>
            </div>
          </div>
        </div>

        <div class="col s12 l8">
          <div class="card">
            <div class="card-content">
              <span class="card-title">
                <i class="material-icons left">trending_up</i>
                Top 5 des espèces capturées
              </span>
              <div class="table-responsive" *ngIf="topEspeces.length > 0">
                <table class="highlight">
                  <thead>
                    <tr>
                      <th>Espèce</th>
                      <th>Code</th>
                      <th>Quantité</th>
                      <th>Valeur (FCFA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let espece of topEspeces">
                      <td>
                        <strong>{{ espece.nom }}</strong>
                      </td>
                      <td>{{ espece.code }}</td>
                      <td>{{ espece.quantite_tonnes }} t</td>
                      <td>{{ espece.valeur_fcfa | number: "1.0-0" }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p *ngIf="topEspeces.length === 0" class="grey-text center-align">
                Aucune donnée disponible
              </p>
            </div>
          </div>

          <div class="card">
            <div class="card-content">
              <span class="card-title">
                <i class="material-icons left">place</i>
                Débarcadères les plus actifs
              </span>
              <div class="table-responsive" *ngIf="topDebarcaderes.length > 0">
                <table class="highlight">
                  <thead>
                    <tr>
                      <th>Débarcadère</th>
                      <th>Province</th>
                      <th>Débarquements</th>
                      <th>Quantité</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let deb of topDebarcaderes">
                      <td>
                        <strong>{{ deb.debarcadere }}</strong>
                      </td>
                      <td>{{ deb.province }}</td>
                      <td>{{ deb.nb_debarquements }}</td>
                      <td>{{ deb.quantite_tonnes }} t</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .stat-card i {
        float: right;
        margin-top: 10px;
      }
      .stat-card h3 {
        margin: 0;
        font-size: 2.5rem;
        color: #0d47a1;
      }
      .stat-card p {
        margin: 0.5rem 0 0;
        color: #757575;
        font-size: 0.9rem;
        text-transform: uppercase;
      }

      h4 {
        margin: 1rem 0 0.5rem 0;
        font-size: 2rem;
      }

      .alerte-item {
        padding: 1rem 0;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .alerte-item:last-child {
        border-bottom: none;
      }
      .alerte-item .badge {
        font-size: 1rem;
        padding: 0px 0px;
      }
      .alerte-item p {
        margin: 0;
        flex: 1;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  stats: any = {
    globaux: {},
    captures_mois: {},
    alertes: {},
  };
  topEspeces: any[] = [];
  topDebarcaderes: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadDashboardStats();
    this.loadTopEspeces();
    this.loadTopDebarcaderes();
  }

  loadDashboardStats() {
    this.http
      .get(`${environment.apiUrl}/api/statistiques/dashboard`)
      .subscribe({
        next: (data: any) => {
          this.stats = data;
        },
        error: (err) => console.error("Erreur chargement stats:", err),
      });
  }

  loadTopEspeces() {
    this.http
      .get(`${environment.apiUrl}/api/statistiques/especes/top?limite=5`)
      .subscribe({
        next: (data: any) => {
          this.topEspeces = data;
        },
        error: (err) => console.error("Erreur top espèces:", err),
      });
  }

  loadTopDebarcaderes() {
    this.http
      .get(
        `${environment.apiUrl}/api/statistiques/debarcaderes/activite?limite=5`,
      )
      .subscribe({
        next: (data: any) => {
          // console.log(data);
          this.topDebarcaderes = data;
        },
        error: (err) => console.error("Erreur top débarcadères:", err),
      });
  }
}
