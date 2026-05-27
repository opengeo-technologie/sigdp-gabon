import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { DebarquementService } from "../../../services/debarquement.service";
import { Debarquement } from "../../../models/debarquement.model";

declare var M: any;

@Component({
  selector: "app-debarquement-list",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1><i class="material-icons left">inventory</i> Captures</h1>
        <p>Enregistrements des captures de pêche</p>
      </div>
    </div>

    <div class="container-fluid">
      <!-- Filtres -->
      <div class="card">
        <div class="card-content">
          <div class="row">
            <div class="col s12 m3">
              <div class="input-field">
                <input
                  id="date_debut"
                  type="date"
                  [(ngModel)]="filters.date_debut"
                  (change)="applyFilters()"
                />
                <label for="date_debut" class="active">Date début</label>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="input-field">
                <input
                  id="date_fin"
                  type="date"
                  [(ngModel)]="filters.date_fin"
                  (change)="applyFilters()"
                />
                <label for="date_fin" class="active">Date fin</label>
              </div>
            </div>
            <div class="col s12 m3">
              <p style="margin-top: 1.5rem;">
                <label>
                  <input
                    type="checkbox"
                    [(ngModel)]="filters.avec_alertes"
                    (change)="applyFilters()"
                  />
                  <span>Uniquement les alertes</span>
                </label>
              </p>
            </div>
            <div class="col s12 m3">
              <a
                routerLink="/debarquements/new"
                class="btn btn-primary waves-effect"
                style="margin-top: 1.5rem;"
              >
                <i class="material-icons left">add</i>Nouveau
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Résultats -->
      <div class="card" *ngIf="!loading">
        <div class="card-content">
          <span class="card-title">{{ totalData }} Capture(s)</span>
          <div class="table-responsive">
            <table class="highlight responsive-table">
              <thead>
                <tr>
                  <th>N° Débarquement</th>
                  <th>Date</th>
                  <th>Débarcadère</th>
                  <th>Pêcheur</th>
                  <th>Bateau</th>
                  <th>Quantité</th>
                  <th>Valeur</th>
                  <th>Alertes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let deb of debarquements">
                  <td>
                    <strong>{{ deb.numero_debarquement }}</strong>
                  </td>
                  <td>
                    {{ deb.date_debarquement | date: "dd/MM/yyyy HH:mm" }}
                  </td>
                  <td>{{ deb.debarcadere_nom }}</td>
                  <td>{{ deb.pecheur_nom }}</td>
                  <td>{{ deb.bateau_immatriculation }}</td>
                  <td>{{ deb.total_quantite_kg }} kg</td>
                  <td>{{ deb.total_valeur || 0 | number: "1.0-0" }} FCFA</td>
                  <td>
                    <span *ngIf="deb.has_alertes" class="badge red white-text">
                      <i class="material-icons tiny">warning</i>
                      {{ countAlertes(deb) }}
                    </span>
                    <span
                      *ngIf="!deb.has_alertes"
                      class="badge green white-text"
                      >OK</span
                    >
                  </td>
                  <td>
                    <a
                      [routerLink]="['/debarquements', deb.id]"
                      class="btn-small btn-flat"
                    >
                      <i class="material-icons">visibility</i>
                    </a>
                  </td>
                </tr>
                <tr *ngIf="debarquements.length === 0">
                  <td colspan="9" class="center-align grey-text">
                    Aucun débarquement trouvé
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
            <div class="circle-clipper left"><div class="circle"></div></div>
            <div class="gap-patch"><div class="circle"></div></div>
            <div class="circle-clipper right"><div class="circle"></div></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .badge i.tiny {
        vertical-align: middle;
        font-size: 14px;
        margin-right: 4px;
      }
    `,
  ],
})
export class DebarquementListComponent implements OnInit {
  debarquements: Debarquement[] = [];
  loading = true;
  filters = {
    date_debut: "",
    date_fin: "",
    avec_alertes: false,
    limit: 10,
  };

  filterParams: any = {};

  currentPage = 1;
  rowsPerPage = 10;
  totalData = 1;

  constructor(private debarquementService: DebarquementService) {}

  ngOnInit() {
    this.filterParams.limit = this.filters.limit;
    this.loadDebarquements();
  }

  loadDebarquements() {
    this.loading = true;
    // const filterParams: any = {};
    if (this.filters.date_debut)
      this.filterParams.date_debut = this.filters.date_debut;
    if (this.filters.date_fin)
      this.filterParams.date_fin = this.filters.date_fin;
    if (this.filters.avec_alertes) this.filterParams.avec_alertes = true;

    this.debarquementService.getDebarquements(this.filterParams).subscribe({
      next: (data) => {
        // console.log(data);
        this.debarquements = data.result;
        this.totalData = data.total;
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        M.toast({ html: "Erreur", classes: "red" });
      },
    });
  }

  // get paginatedData() {
  //   const start = (this.currentPage - 1) * this.rowsPerPage;
  //   return this.debarquements.slice(start, start + this.rowsPerPage);
  // }

  totalPages() {
    return Math.ceil(this.totalData / this.rowsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++;
      this.filterParams.skip = (this.currentPage - 1) * this.filters.limit;
      this.loadDebarquements();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.filterParams.skip = (this.currentPage - 1) * this.filters.limit;
      this.loadDebarquements();
    }
  }

  applyFilters() {
    this.loadDebarquements();
  }

  countAlertes(deb: Debarquement): number {
    let count = 0;
    if (deb.alerte_espece_protegee) count++;
    if (deb.alerte_quota_depasse) count++;
    if (deb.alerte_taille_illegale) count++;
    if (deb.alerte_bateau_non_conforme) count++;
    return count;
  }
}
