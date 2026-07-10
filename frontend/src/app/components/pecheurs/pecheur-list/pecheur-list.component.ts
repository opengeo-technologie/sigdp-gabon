import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { PecheurService } from "../../../services/pecheur.service";
import { CardGeneratorService } from "../../../services/card-generator.service";
import { environment } from "../../../../environments/environment";
import {
  Pecheur,
  CategoriePecheur,
  TypePeche,
  StatutPecheur,
} from "../../../models/pecheur.model";
import { HasPermissionDirective } from "../../../directives/has-permission.directive";

declare var M: any;

@Component({
  selector: "app-pecheur-list",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HasPermissionDirective],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1><i class="material-icons left">people</i> Pêcheurs</h1>
        <p>Gestion des pêcheurs et cartes nationales de pêcheur</p>
      </div>
    </div>

    <div class="container-fluid">
      <!-- Filtres et actions -->
      <div class="card">
        <div class="card-content">
          <div class="row">
            <div class="col s12 m3">
              <div class="form-input">
                <label>Catégorie</label>
                <select
                  [(ngModel)]="filters.categorie"
                  (change)="applyFilters()"
                  class="browser-default"
                >
                  <option value="">Toutes les catégories</option>
                  <option value="Pêcheur artisanal">Pêcheur artisanal</option>
                  <option value="Pêcheur semi-industriel">
                    Pêcheur semi-industriel
                  </option>
                  <option value="Patron de pêche">Patron de pêche</option>
                  <option value="Aide-pêcheur">Aide-pêcheur</option>
                </select>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="form-input">
                <label>Type de pêche</label>
                <select
                  [(ngModel)]="filters.type_peche"
                  (change)="applyFilters()"
                  class="browser-default"
                >
                  <option value="">Tous les types</option>
                  <option value="Côtière">Côtière</option>
                  <option value="Fluviale">Fluviale</option>
                  <option value="Lagunaire">Lagunaire</option>
                  <option value="Hauturière">Hauturière</option>
                </select>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="form-input">
                <label>Statut</label>
                <select
                  [(ngModel)]="filters.statut"
                  (change)="applyFilters()"
                  class="browser-default"
                >
                  <option value="">Tous les statuts</option>
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                  <option value="Suspendu">Suspendu</option>
                </select>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="form-input">
                <a
                  routerLink="/pecheurs/new"
                  class="btn btn-primary waves-effect waves-light"
                  *appHasPermission="'pecheur.create'"
                  style="margin-top: 1.5rem;"
                >
                  <i class="material-icons left">person_add</i>
                  Nouveau pêcheur
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Résultats -->
      <div class="card" *ngIf="!loading">
        <div class="card-content">
          <span class="card-title">
            {{ pecheurs.length }} pêcheur(s) trouvé(s)
          </span>
          <div class="table-responsive">
            <table class="highlight responsive-table">
              <thead>
                <tr>
                  <th>Numéro CNP</th>
                  <th>Nom et Prénom</th>
                  <th>Âge</th>
                  <th>Catégorie</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let pecheur of paginatedData">
                  <td>
                    <strong>{{ pecheur.numero_carte }}</strong>
                  </td>
                  <td>
                    {{ pecheur.nom }} {{ pecheur.prenom }}
                    <br />
                    <small class="grey-text" *ngIf="pecheur.telephone">
                      <i class="material-icons tiny">phone</i>
                      {{ pecheur.telephone }}
                    </small>
                  </td>
                  <td>{{ pecheur.age }} ans</td>
                  <td>
                    <span class="badge blue lighten-4 blue-text text-darken-4">
                      {{ pecheur.categorie }}
                    </span>
                  </td>
                  <td>
                    <span
                      class="badge"
                      [ngClass]="getStatutClass(pecheur.statut)"
                    >
                      {{ pecheur.statut }}
                    </span>
                  </td>
                  <td>
                    <div class="btn-group" role="group">
                      <a
                        [routerLink]="['/pecheurs', pecheur.id]"
                        class="btn-small btn green white-text btn-flat waves-effect"
                        title="Voir détails"
                      >
                        <i class="material-icons">visibility</i>
                      </a>
                      <a
                        [routerLink]="['/pecheurs', pecheur.id, 'edit']"
                        class="btn-small btn blue white-text btn-flat waves-effect"
                        *appHasPermission="'pecheur.update'"
                        title="Modifier"
                      >
                        <i class="material-icons">edit</i>
                      </a>
                      <a
                        (click)="printCarte(pecheur)"
                        class="btn-small btn teal white-text btn-flat waves-effect"
                        *appHasPermission="'pecheur.read'"
                        title="Télécharger carte"
                      >
                        <i class="material-icons">credit_card</i>
                      </a>
                      <a
                        (click)="deletePecheur(pecheur)"
                        class="btn-small btn red white-text btn-flat waves-effect"
                        title="Supprimer"
                        *appHasPermission="'pecheur.delete'"
                      >
                        <i class="material-icons">delete</i>
                      </a>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="pecheurs.length === 0">
                  <td colspan="8" class="center-align">
                    <p class="grey-text">
                      Aucun pêcheur trouvé avec ces critères
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="center" style="padding-top: 20px">
              <div class="btn-group" role="group">
                <button
                  (click)="prevPage()"
                  class="btn waves-effect waves-light white darken-4 btn-small"
                  [disabled]="currentPage === 1"
                >
                  <i class="material-icons" style="color: #000000;"
                    >chevron_left</i
                  >
                </button>
                <span
                  class="page-number"
                  style="margin-left: 10px; margin-right: 10px"
                  >page {{ currentPage }} / {{ totalPages() }}</span
                >
                <button
                  (click)="nextPage()"
                  class="btn waves-effect waves-light white btn-small"
                  [disabled]="currentPage === totalPages()"
                >
                  <i class="material-icons" style="color: #000000;"
                    >chevron_right</i
                  >
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div class="spinner-container" *ngIf="loading">
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
    </div>
  `,
  styles: [
    `
      .badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.85rem;
      }

      .badge.actif {
        background-color: #4caf50;
        color: white;
      }

      .badge.inactif {
        background-color: #757575;
        color: white;
      }

      .badge.suspendu {
        background-color: #ff9800;
        color: white;
      }
    `,
  ],
})
export class PecheurListComponent implements OnInit {
  pecheurs: Pecheur[] = [];
  loading = true;
  filters = {
    categorie: "",
    type_peche: "",
    statut: "",
  };
  currentPage = 1;
  rowsPerPage = 10;

  constructor(
    private pecheurService: PecheurService,
    private cardGeneratorService: CardGeneratorService,
  ) {}

  ngOnInit() {
    this.loadPecheurs();
    setTimeout(() => this.initializeSelects(), 100);
  }

  loadPecheurs() {
    this.loading = true;
    const filterParams: any = {};

    if (this.filters.categorie) filterParams.categorie = this.filters.categorie;
    if (this.filters.type_peche)
      filterParams.type_peche = this.filters.type_peche;
    if (this.filters.statut) filterParams.statut = this.filters.statut;

    this.pecheurService.getPecheurs(filterParams).subscribe({
      next: (data) => {
        // console.log("Pêcheurs chargés:", data);
        this.pecheurs = data;
        this.pecheurs.sort((a, b) => {
          const compare = a.numero_carte.localeCompare(b.numero_carte);
          return compare;
        });
        this.loading = false;
      },
      error: (error) => {
        console.error("Erreur lors du chargement des pêcheurs:", error);
        this.loading = false;
        M.toast({
          html: "Erreur lors du chargement des pêcheurs",
          classes: "red",
        });
      },
    });
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.pecheurs.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.pecheurs.length / this.rowsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  applyFilters() {
    this.loadPecheurs();
  }

  deletePecheur(pecheur: Pecheur) {
    if (
      confirm(
        `Êtes-vous sûr de vouloir supprimer le pêcheur "${pecheur.nom} ${pecheur.prenom}" ?`,
      )
    ) {
      this.pecheurService.deletePecheur(pecheur.id).subscribe({
        next: () => {
          this.loadPecheurs();
          M.toast({ html: "Pêcheur supprimé avec succès", classes: "green" });
        },
        error: (error) => {
          console.error("Erreur lors de la suppression:", error);
          M.toast({ html: "Erreur lors de la suppression", classes: "red" });
        },
      });
    }
  }

  downloadCarte(pecheur: Pecheur) {
    let url = `${environment.apiUrl}/`;
    this.pecheurService.getPecheurPhotoUrl(pecheur.id).subscribe({
      next: (response) => {
        console.log("URL de la photo du pêcheur:", response);
        if (response.photo_path && response.photo_path !== "") {
          // this.pecheurService.downloadCarte(pecheur.id, url + response.photo_path);
        } else {
          this.pecheurService.downloadCarte(pecheur.id);
        }
        M.toast({
          html: `Téléchargement de la carte de ${pecheur.nom} ${pecheur.prenom}`,
          classes: "blue",
        });
      },
      error: (error) => {
        console.error("Erreur lors du chargement de la photo:", error);
      },
    });
  }

  getStatutClass(statut: string): string {
    const classes: { [key: string]: string } = {
      Actif: "actif",
      Inactif: "inactif",
      Suspendu: "suspendu",
    };
    return classes[statut] || "";
  }

  private initializeSelects() {
    if (typeof M !== "undefined") {
      const elems = document.querySelectorAll("select");
      M.FormSelect.init(elems, {});
    }
  }

  async printCarte(pecheur: any) {
    if (pecheur) {
      try {
        let url = `${environment.apiUrl}/`;
        this.pecheurService.getPecheurPhotoUrl(pecheur.id).subscribe({
          next: async (response) => {
            console.log("URL de la photo du pêcheur:", response);
            M.toast({
              html: "Préparation de l'impression...",
              classes: "blue",
            });
            if (response.photo_path && response.photo_path !== "") {
              await this.cardGeneratorService.printCard(
                pecheur,
                url + response.photo_path,
              );
            } else {
              await this.cardGeneratorService.printCard(pecheur);
            }
          },
          error: (error) => {
            console.error("Erreur lors du chargement de la photo:", error);
          },
        });
      } catch (error) {
        console.error("Erreur:", error);
        M.toast({ html: "Erreur lors de l'impression", classes: "red" });
      }
    }
  }
}
