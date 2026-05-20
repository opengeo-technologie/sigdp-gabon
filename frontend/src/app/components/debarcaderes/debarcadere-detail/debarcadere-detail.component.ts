import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, ActivatedRoute, Router } from "@angular/router";
import { DebarcadereService } from "../../../services/debarcadere.service";
import { Debarcadere } from "../../../models/debarcadere.model";
import { environment } from "../../../../environments/environment";

declare var M: any;

@Component({
  selector: "app-debarcadere-detail",
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1>
          <i class="material-icons left">location_on</i>
          Détails du débarcadère
        </h1>
      </div>
    </div>

    <div class="container-fluid" *ngIf="debarcadere">
      <div class="row">
        <div class="col s12">
          <a routerLink="/debarcaderes" class="btn btn-flat waves-effect">
            <i class="material-icons left">arrow_back</i>
            Retour à la liste
          </a>
          <a
            [routerLink]="['/debarcaderes', debarcadere.id, 'edit']"
            class="btn btn-primary waves-effect waves-light"
          >
            <i class="material-icons left">edit</i>
            Modifier
          </a>
          <a
            (click)="deleteDebarcadere()"
            class="btn red waves-effect waves-light"
          >
            <i class="material-icons left">delete</i>
            Supprimer
          </a>
        </div>
      </div>

      <div class="row">
        <!-- Informations principales -->
        <div class="col s12 l8">
          <div class="card">
            <div class="card-content">
              <span class="card-title">
                {{ debarcadere.denomination }}
                <span class="badge" [ngClass]="getStatutClass()">
                  {{ debarcadere.statut_operationnel }}
                </span>
              </span>

              <div class="row">
                <div class="col s12 m6">
                  <p><strong>Code:</strong> {{ debarcadere.code }}</p>
                  <p *ngIf="debarcadere.nom_local">
                    <strong>Nom local:</strong> {{ debarcadere.nom_local }}
                  </p>
                  <p><strong>Type:</strong> {{ debarcadere.type }}</p>
                  <p>
                    <strong>Milieu:</strong>
                    <span class="badge" [ngClass]="getMilieuClass()">
                      {{ debarcadere.milieu }}
                    </span>
                  </p>
                </div>
                <div class="col s12 m6">
                  <p><strong>Province:</strong> {{ debarcadere.province }}</p>
                  <p *ngIf="debarcadere.departement">
                    <strong>Département:</strong> {{ debarcadere.departement }}
                  </p>
                  <p *ngIf="debarcadere.localite">
                    <strong>Localité:</strong> {{ debarcadere.localite }}
                  </p>
                  <p *ngIf="debarcadere.capacite_accueil">
                    <strong>Capacité d'accueil:</strong>
                    {{ debarcadere.capacite_accueil }} bateaux
                  </p>
                </div>
              </div>

              <div class="divider"></div>

              <h6 class="mt-2">Coordonnées GPS</h6>
              <div class="row">
                <div class="col s12 m6">
                  <p><strong>Latitude:</strong> {{ debarcadere.latitude }}</p>
                </div>
                <div class="col s12 m6">
                  <p><strong>Longitude:</strong> {{ debarcadere.longitude }}</p>
                </div>
              </div>

              <div class="divider"></div>

              <div class="row">
                <div class="col s12 m6">
                  <h6 class="mt-2">Infrastructures disponibles</h6>
                  <div class="row">
                    <div class="col s12">
                      <p>
                        <i
                          class="material-icons tiny"
                          [class.green-text]="debarcadere.infrastructure_quai"
                          [class.grey-text]="!debarcadere.infrastructure_quai"
                        >
                          {{
                            debarcadere.infrastructure_quai
                              ? "check_circle"
                              : "cancel"
                          }}
                        </i>
                        Quai
                      </p>
                      <p>
                        <i
                          class="material-icons tiny"
                          [class.green-text]="
                            debarcadere.infrastructure_chambre_froide
                          "
                          [class.grey-text]="
                            !debarcadere.infrastructure_chambre_froide
                          "
                        >
                          {{
                            debarcadere.infrastructure_chambre_froide
                              ? "check_circle"
                              : "cancel"
                          }}
                        </i>
                        Chambre froide
                      </p>
                      <p>
                        <i
                          class="material-icons tiny"
                          [class.green-text]="debarcadere.infrastructure_glace"
                          [class.grey-text]="!debarcadere.infrastructure_glace"
                        >
                          {{
                            debarcadere.infrastructure_glace
                              ? "check_circle"
                              : "cancel"
                          }}
                        </i>
                        Glace
                      </p>
                      <p>
                        <i
                          class="material-icons tiny"
                          [class.green-text]="debarcadere.infrastructure_marche"
                          [class.grey-text]="!debarcadere.infrastructure_marche"
                        >
                          {{
                            debarcadere.infrastructure_marche
                              ? "check_circle"
                              : "cancel"
                          }}
                        </i>
                        Marché
                      </p>
                      <p>
                        <i
                          class="material-icons tiny"
                          [class.green-text]="
                            debarcadere.infrastructure_carburant
                          "
                          [class.grey-text]="
                            !debarcadere.infrastructure_carburant
                          "
                        >
                          {{
                            debarcadere.infrastructure_carburant
                              ? "check_circle"
                              : "cancel"
                          }}
                        </i>
                        Carburant
                      </p>
                      <p>
                        <i
                          class="material-icons tiny"
                          [class.green-text]="debarcadere.infrastructure_eau"
                          [class.grey-text]="!debarcadere.infrastructure_eau"
                        >
                          {{
                            debarcadere.infrastructure_eau
                              ? "check_circle"
                              : "cancel"
                          }}
                        </i>
                        Eau potable
                      </p>
                      <p>
                        <i
                          class="material-icons tiny"
                          [class.green-text]="
                            debarcadere.infrastructure_electricite
                          "
                          [class.grey-text]="
                            !debarcadere.infrastructure_electricite
                          "
                        >
                          {{
                            debarcadere.infrastructure_electricite
                              ? "check_circle"
                              : "cancel"
                          }}
                        </i>
                        Électricité
                      </p>
                    </div>
                  </div>
                </div>
                <div class="col s12 m6">
                  <h6 class="mt-2">Photo débarcadère</h6>
                  <div *ngIf="debarcadere.photo_url">
                    <img
                      [src]="url + debarcadere.photo_url"
                      alt="Photo de {{ debarcadere.code }}"
                      class="responsive-img"
                      style="max-width: 200px; border-radius: 8px;"
                    />
                  </div>
                </div>
              </div>

              <div
                class="divider"
                *ngIf="debarcadere.agent_responsable_nom"
              ></div>

              <div *ngIf="debarcadere.agent_responsable_nom">
                <h6 class="mt-2">Agent responsable</h6>
                <p>
                  <strong>Nom:</strong> {{ debarcadere.agent_responsable_nom }}
                </p>
                <p *ngIf="debarcadere.agent_responsable_matricule">
                  <strong>Matricule:</strong>
                  {{ debarcadere.agent_responsable_matricule }}
                </p>
                <p *ngIf="debarcadere.agent_responsable_telephone">
                  <strong>Téléphone:</strong>
                  {{ debarcadere.agent_responsable_telephone }}
                </p>
              </div>

              <div class="divider" *ngIf="debarcadere.description"></div>

              <div *ngIf="debarcadere.description">
                <h6 class="mt-2">Description</h6>
                <p>{{ debarcadere.description }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Carte et statistiques -->
        <div class="col s12 l4">
          <!-- Mini carte -->
          <div class="card">
            <div class="card-content">
              <span class="card-title">Localisation</span>
              <div id="mini-map" class="mini-map"></div>
              <p class="center-align mt-2">
                <a
                  [href]="getGoogleMapsUrl()"
                  target="_blank"
                  class="btn btn-small waves-effect waves-light"
                >
                  <i class="material-icons left">map</i>
                  Voir sur Google Maps
                </a>
              </p>
            </div>
          </div>

          <!-- Statistiques -->
          <div class="card">
            <div class="card-content">
              <span class="card-title">Statistiques</span>
              <div class="stat-item">
                <i class="material-icons blue-text">assessment</i>
                <div>
                  <strong>24</strong>
                  <p>Débarquements ce mois</p>
                </div>
              </div>
              <div class="stat-item">
                <i class="material-icons orange-text">directions_boat</i>
                <div>
                  <strong>12</strong>
                  <p>Bateaux actifs</p>
                </div>
              </div>
              <div class="stat-item">
                <i class="material-icons green-text">people</i>
                <div>
                  <strong>35</strong>
                  <p>Pêcheurs rattachés</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Métadonnées -->
          <div class="card">
            <div class="card-content">
              <span class="card-title">Informations système</span>
              <p>
                <small
                  ><strong>Créé le:</strong>
                  {{
                    debarcadere.created_at | date: "dd/MM/yyyy à HH:mm"
                  }}</small
                >
              </p>
              <p *ngIf="debarcadere.updated_at">
                <small
                  ><strong>Modifié le:</strong>
                  {{
                    debarcadere.updated_at | date: "dd/MM/yyyy à HH:mm"
                  }}</small
                >
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div class="spinner-container" *ngIf="!debarcadere">
      <div class="preloader-wrapper big active">
        <div class="spinner-layer spinner-blue-only">
          <div class="circle-clipper left">
            <div class="circle"></div>
          </div>
          <div class="gap-patch">
            <div class="circle"></div>
          </div>
          <div class="circle-clipper right">
            <div class="circle"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .mini-map {
        height: 300px;
        border-radius: 8px;
        background-color: #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .stat-item {
        display: flex;
        align-items: center;
        padding: 1rem 0;
        border-bottom: 1px solid #e0e0e0;
      }

      .stat-item:last-child {
        border-bottom: none;
      }

      .stat-item i {
        font-size: 2.5rem;
        margin-right: 1rem;
      }

      .stat-item div {
        flex: 1;
      }

      .stat-item strong {
        font-size: 1.8rem;
        display: block;
        color: #0d47a1;
      }

      .stat-item p {
        margin: 0;
        color: #757575;
        font-size: 0.9rem;
      }

      .mt-2 {
        margin-top: 1rem;
      }

      .divider {
        margin: 1.5rem 0;
      }

      h6 {
        color: #0d47a1;
        font-weight: 500;
      }

      .badge.Maritime {
        background-color: #2196f3;
      }

      .badge.Fluvial {
        background-color: #4caf50;
      }

      .badge.Lagunaire {
        background-color: #00bcd4;
      }
    `,
  ],
})
export class DebarcadereDetailComponent implements OnInit {
  debarcadere?: Debarcadere;
  debarcadereId?: number;

  url: any = `${environment.apiUrl}/uploads/debarcaderes/`;

  constructor(
    private debarcadereService: DebarcadereService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.debarcadereId = +params["id"];
      this.loadDebarcadere();
    });
  }

  loadDebarcadere() {
    if (this.debarcadereId) {
      this.debarcadereService.getDebarcadere(this.debarcadereId).subscribe({
        next: (data) => {
          // console.log(data);
          this.debarcadere = data;
          setTimeout(() => this.initializeMap(), 100);
        },
        error: (error) => {
          console.error("Erreur lors du chargement:", error);
          M.toast({
            html: "Erreur lors du chargement du débarcadère",
            classes: "red",
          });
          this.router.navigate(["/debarcaderes"]);
        },
      });
    }
  }

  deleteDebarcadere() {
    if (
      this.debarcadere &&
      confirm(
        `Êtes-vous sûr de vouloir supprimer le débarcadère "${this.debarcadere.denomination}" ?`,
      )
    ) {
      this.debarcadereService.deleteDebarcadere(this.debarcadere.id).subscribe({
        next: () => {
          M.toast({
            html: "Débarcadère supprimé avec succès",
            classes: "green",
          });
          this.router.navigate(["/debarcaderes"]);
        },
        error: (error) => {
          console.error("Erreur lors de la suppression:", error);
          M.toast({ html: "Erreur lors de la suppression", classes: "red" });
        },
      });
    }
  }

  getStatutClass(): string {
    if (!this.debarcadere) return "";
    const classes: { [key: string]: string } = {
      Actif: "actif",
      Inactif: "inactif",
      "En travaux": "en-travaux",
    };
    return classes[this.debarcadere.statut_operationnel] || "";
  }

  getMilieuClass(): string {
    return this.debarcadere?.milieu || "";
  }

  getGoogleMapsUrl(): string {
    if (!this.debarcadere) return "#";
    return `https://www.google.com/maps?q=${this.debarcadere.latitude},${this.debarcadere.longitude}`;
  }

  private initializeMap() {
    // Placeholder pour la carte Leaflet
    // À implémenter avec Leaflet
  }
}
