import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { DebarquementService } from "../../../services/debarquement.service";
import { Debarquement } from "../../../models/debarquement.model";
import { AuthService } from "../../../services/auth.service";

declare var M: any;

@Component({
  selector: "app-debarquement-list",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1>
          <i class="material-icons left">inventory</i> Débarquements et Captures
        </h1>
        <p>Enregistrements des captures de pêche</p>
      </div>
    </div>

    <div class="container-fluid">
      <!-- Filtres -->
      <div class="card">
        <div class="card-content">
          <div class="row">
            <div class="col s12 m3">
              <div class="form-input">
                <label for="date_debut" class="active">Date début</label>
                <div class="input-field">
                  <input
                    id="date_debut"
                    type="date"
                    [(ngModel)]="filters.date_debut"
                    (change)="applyFilters()"
                  />
                </div>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="form-input">
                <label for="date_fin" class="active">Date fin</label>
                <div class="input-field">
                  <input
                    id="date_fin"
                    type="date"
                    [(ngModel)]="filters.date_fin"
                    (change)="applyFilters()"
                  />
                </div>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="form-input">
                <p style="margin-top: 2.5rem;">
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
            </div>
            <div class="col s12 m3">
              <div class="form-input">
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
      </div>

      <!-- Résultats -->
      <div class="card" *ngIf="!loading">
        <div class="card-content">
          <div class="row valign-wrapper" style="margin-bottom: 10px">
            <div class="col s5">
              <span class="card-title"> {{ totalData }} débarquement(s) </span>
            </div>
            <div class="col s7 right-align">
              <a
                routerLink="/debarquements/rapport"
                class="btn waves-effect grey white-text"
                [class.disabled]="!hasPermission('debarquement.export')"
                style="margin-right: 10px"
              >
                <i class="material-icons left">assessment</i>Générer rapport
              </a>
              <a
                routerLink="/debarquements/exporter"
                class="btn waves-effect orange white-text"
                [class.disabled]="!hasPermission('debarquements.export')"
                style="margin-right: 10px"
              >
                <i class="material-icons left">download</i>Exporter
              </a>
              <a
                routerLink="/debarquements/importer"
                class="btn-flat btn waves-effect green white-text"
                style="margin-right: 10px"
              >
                <i class="material-icons left">upload</i>Importer
              </a>
            </div>
          </div>
          <div class="table-responsive">
            <table class="highlight responsive-table">
              <thead>
                <tr>
                  <!-- <th>N° Débarquement</th> -->
                  <th>Date</th>
                  <th>Débarcadère</th>
                  <th>Effort de pêche</th>
                  <th>Cpue</th>
                  <th>Quantité</th>
                  <th>Valeur</th>
                  <th>Alertes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let deb of debarquements">
                  <!-- <td>
                    <strong>{{ deb.numero_debarquement }}</strong>
                  </td> -->
                  <td>
                    {{ deb.date_debarquement | date: "dd/MM/yyyy" }}
                  </td>
                  <td>{{ deb.debarcadere_nom }}</td>
                  <td>{{ deb.effort_peche }}</td>
                  <td>{{ deb.cpue }}</td>
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
                    <div class="btn-group">
                      <a
                        [routerLink]="['/debarquements', deb.id]"
                        class="btn btn-small blue"
                        [class.disabled]="
                          !hasPermission('debarquements.update')
                        "
                      >
                        <i class="material-icons">edit</i>
                      </a>
                      <a
                        [routerLink]="['/debarquements', deb.id]"
                        class="btn btn-small"
                      >
                        <i class="material-icons">visibility</i>
                      </a>
                      <a
                        [routerLink]="['/debarquements', deb.id]"
                        class="btn btn-small red"
                        [class.disabled]="
                          !hasPermission('debarquements.delete')
                        "
                      >
                        <i class="material-icons">delete</i>
                      </a>
                    </div>
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

  constructor(
    private debarquementService: DebarquementService,
    private permissionService: AuthService,
  ) {}

  ngOnInit() {
    this.filterParams.limit = this.filters.limit;
    this.loadDebarquements();
  }

  hasPermission(permission: string): boolean {
    return this.permissionService.hasPermission(permission);
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
        console.log(data);
        this.debarquements = data.result;
        this.totalData = data.total;
        this.sortByDate();
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        M.toast({ html: "Erreur", classes: "red" });
      },
    });
  }

  sortByDate() {
    this.debarquements.sort(
      (a, b) =>
        new Date(a.date_debarquement).getTime() -
        new Date(b.date_debarquement).getTime(),
    );
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
