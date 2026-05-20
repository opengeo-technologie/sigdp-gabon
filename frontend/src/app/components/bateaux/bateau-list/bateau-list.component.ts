import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { BateauService } from "../../../services/bateau.service";
import { Bateau, TypeBateau } from "../../../models/bateau.model";
import { HasPermissionDirective } from "../../../directives/has-permission.directive";

declare var M: any;

@Component({
  selector: "app-bateau-list",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HasPermissionDirective],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1>
          <i class="material-icons left">directions_boat</i> Bateaux de pêche
        </h1>
        <p>Gestion de la flotte de pêche artisanale et semi-industrielle</p>
      </div>
    </div>

    <div class="container-fluid">
      <!-- Filtres et actions -->
      <div class="card">
        <div class="card-content">
          <div class="row">
            <div class="col s12 m3">
              <div class="input-field">
                <select
                  [(ngModel)]="filters.type_bateau"
                  (change)="applyFilters()"
                >
                  <option value="">Tous les types</option>
                  <option value="Pirogue">Pirogue</option>
                  <option value="Baleinière">Baleinière</option>
                  <option value="Canot motorisé">Canot motorisé</option>
                  <option value="Fileyeur">Fileyeur</option>
                  <option value="Chalutier artisanal">
                    Chalutier artisanal
                  </option>
                </select>
                <label>Type de bateau</label>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="input-field">
                <select [(ngModel)]="filters.statut" (change)="applyFilters()">
                  <option value="">Tous les statuts</option>
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                  <option value="En réparation">En réparation</option>
                  <option value="Retiré">Retiré</option>
                </select>
                <label>Statut</label>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="input-field">
                <input
                  type="text"
                  [(ngModel)]="searchTerm"
                  (keyup.enter)="search()"
                  placeholder="Rechercher..."
                />
                <label>Immatriculation ou nom</label>
              </div>
            </div>
            <div class="col s12 m3">
              <a
                routerLink="/bateaux/new"
                class="btn btn-primary waves-effect waves-light"
                style="margin-top: 1.5rem;"
                *appHasPermission="'bateau.create'"
              >
                <i class="material-icons left">add</i>
                Nouveau bateau
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Résultats -->
      <div class="card" *ngIf="!loading">
        <div class="card-content">
          <span class="card-title">
            {{ bateaux.length }} bateau(x) trouvé(s)
          </span>
          <div class="table-responsive">
            <table class="highlight responsive-table">
              <thead>
                <tr>
                  <th>Immatriculation</th>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Propulsion</th>
                  <th>Propriétaire</th>
                  <th>Certificat</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let bateau of paginatedData">
                  <td>
                    <strong>{{ bateau.numero_immatriculation }}</strong>
                  </td>
                  <td>{{ bateau.nom_bateau || "Sans nom" }}</td>
                  <td>
                    <span class="badge blue lighten-4 blue-text text-darken-4">
                      {{ bateau.type_bateau }}
                    </span>
                  </td>
                  <td>{{ bateau.propulsion }}</td>
                  <td>
                    <span *ngIf="bateau.proprietaire_info">
                      {{ bateau.proprietaire_info.nom }}
                      {{ bateau.proprietaire_info.prenom }}
                      <br />
                      <small class="grey-text">{{
                        bateau.proprietaire_info.numero_carte
                      }}</small>
                    </span>
                    <span
                      *ngIf="
                        !bateau.proprietaire_info && bateau.proprietaire_nom
                      "
                    >
                      {{ bateau.proprietaire_nom }}
                    </span>
                    <span
                      *ngIf="
                        !bateau.proprietaire_info && !bateau.proprietaire_nom
                      "
                      class="grey-text"
                    >
                      Non renseigné
                    </span>
                  </td>
                  <td>
                    <span
                      class="badge"
                      [ngClass]="
                        bateau.certificat_valide
                          ? 'green white-text'
                          : 'red white-text'
                      "
                    >
                      {{ bateau.certificat_valide ? "Valide" : "Expiré" }}
                    </span>
                  </td>
                  <td>
                    <span
                      class="badge"
                      [ngClass]="getStatutClass(bateau.statut)"
                    >
                      {{ bateau.statut }}
                    </span>
                  </td>
                  <td>
                    <a
                      [routerLink]="['/bateaux', bateau.id]"
                      class="btn-small btn-flat waves-effect"
                      title="Voir détails"
                    >
                      <i class="material-icons">visibility</i>
                    </a>
                    <a
                      [routerLink]="['/bateaux', bateau.id, 'edit']"
                      class="btn-small btn-flat waves-effect"
                      *appHasPermission="'bateau.update'"
                      title="Modifier"
                    >
                      <i class="material-icons">edit</i>
                    </a>
                    <a
                      (click)="deleteBateau(bateau)"
                      *appHasPermission="'bateau.delete'"
                      class="btn-small btn-flat waves-effect red-text"
                      title="Supprimer"
                    >
                      <i class="material-icons">delete</i>
                    </a>
                  </td>
                </tr>
                <tr *ngIf="bateaux.length === 0">
                  <td colspan="8" class="center-align">
                    <p class="grey-text">
                      Aucun bateau trouvé avec ces critères
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="center" style="padding-top: 20px">
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

      .badge.Actif {
        background-color: #4caf50;
        color: white;
      }

      .badge.Inactif {
        background-color: #757575;
        color: white;
      }

      .badge.En-réparation {
        background-color: #ff9800;
        color: white;
      }

      .badge.Retiré {
        background-color: #f44336;
        color: white;
      }
    `,
  ],
})
export class BateauListComponent implements OnInit {
  bateaux: Bateau[] = [];
  loading = true;
  searchTerm = "";
  filters = {
    type_bateau: "",
    statut: "",
  };

  currentPage = 1;
  rowsPerPage = 10;

  constructor(private bateauService: BateauService) {}

  ngOnInit() {
    this.loadBateaux();
    setTimeout(() => this.initializeSelects(), 100);
  }

  loadBateaux() {
    this.loading = true;
    const filterParams: any = {};

    if (this.filters.type_bateau)
      filterParams.type_bateau = this.filters.type_bateau;
    if (this.filters.statut) filterParams.statut = this.filters.statut;

    this.bateauService.getBateaux(filterParams).subscribe({
      next: (data) => {
        this.bateaux = data;
        this.loading = false;
      },
      error: (error) => {
        console.error("Erreur lors du chargement des bateaux:", error);
        this.loading = false;
        M.toast({
          html: "Erreur lors du chargement des bateaux",
          classes: "red",
        });
      },
    });
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.bateaux.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.bateaux.length / this.rowsPerPage);
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
    this.loadBateaux();
  }

  search() {
    if (this.searchTerm.trim()) {
      this.bateauService
        .getBateauByImmatriculation(this.searchTerm.trim())
        .subscribe({
          next: (data) => {
            this.bateaux = [data];
            this.loading = false;
          },
          error: (error) => {
            console.error("Bateau non trouvé:", error);
            M.toast({ html: "Bateau non trouvé", classes: "orange" });
            this.loadBateaux();
          },
        });
    } else {
      this.loadBateaux();
    }
  }

  deleteBateau(bateau: Bateau) {
    const nom = bateau.nom_bateau || bateau.numero_immatriculation;
    if (confirm(`Êtes-vous sûr de vouloir supprimer le bateau "${nom}" ?`)) {
      this.bateauService.deleteBateau(bateau.id).subscribe({
        next: () => {
          this.loadBateaux();
          M.toast({ html: "Bateau supprimé avec succès", classes: "green" });
        },
        error: (error) => {
          console.error("Erreur lors de la suppression:", error);
          M.toast({ html: "Erreur lors de la suppression", classes: "red" });
        },
      });
    }
  }

  getStatutClass(statut: string): string {
    return statut.replace(" ", "-");
  }

  private initializeSelects() {
    if (typeof M !== "undefined") {
      const elems = document.querySelectorAll("select");
      M.FormSelect.init(elems, {});
    }
  }
}
