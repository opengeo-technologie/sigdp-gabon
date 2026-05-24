import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { DebarcadereService } from "../../../services/debarcadere.service";
import {
  Debarcadere,
  DebarcadereType,
  Milieu,
  StatutOperationnel,
} from "../../../models/debarcadere.model";

@Component({
  selector: "app-debarcadere-list",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1><i class="material-icons left">location_on</i> Débarcadères</h1>
        <p>Gestion des débarcadères de pêche au Gabon</p>
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
                  [(ngModel)]="filters.province"
                  (change)="applyFilters()"
                >
                  <option value="">Toutes les provinces</option>
                  <option value="ESTUAIRE">Estuaire</option>
                  <option value="OGOOUE MARITIME">Ogooué-Maritime</option>
                  <option value="HAUT OGOOUE">Haut-Ogooué</option>
                  <option value="NYANGA">Nyanga</option>
                  <option value="NGOUNIE">Ngounié</option>
                  <option value="MOYEN OGOOUE">Moyen-Ogooué</option>
                  <option value="OGOOUE IVINDO">Ogooué-Ivindo</option>
                  <option value="OGOOUE LOLO">Ogooué-Lolo</option>
                  <option value="WOLEU-NTEM">Woleu-Ntem</option>
                </select>
                <label>Province</label>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="input-field">
                <select [(ngModel)]="filters.type" (change)="applyFilters()">
                  <option value="">Tous les types</option>
                  <option value="Officiel">Officiel</option>
                  <option value="Informel">Informel</option>
                  <option value="Saisonnier">Saisonnier</option>
                </select>
                <label>Type</label>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="input-field">
                <select [(ngModel)]="filters.statut" (change)="applyFilters()">
                  <option value="">Tous les statuts</option>
                  <option value="Actif">Actif</option>
                  <option value="Inactif">Inactif</option>
                  <option value="En travaux">En travaux</option>
                </select>
                <label>Statut</label>
              </div>
            </div>
            <div class="col s12 m3">
              <a
                routerLink="/debarcaderes/new"
                class="btn btn-primary waves-effect waves-light"
                style="margin-top: 1.5rem;"
              >
                <i class="material-icons left">add</i>
                Nouveau débarcadère
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Résultats -->
      <div class="card" *ngIf="!loading">
        <div class="card-content">
          <span class="card-title">
            {{ debarcaderes.length }} débarcadère(s) trouvé(s)
          </span>
          <div class="table-responsive">
            <table class="highlight responsive-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Dénomination</th>
                  <th>Type</th>
                  <th>Milieu</th>
                  <th>Province</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let deb of paginatedData">
                  <td>
                    <strong>{{ deb.code }}</strong>
                  </td>
                  <td>
                    {{ deb.denomination }}
                    <br />
                    <small class="grey-text" *ngIf="deb.nom_local">{{
                      deb.nom_local
                    }}</small>
                  </td>
                  <td>{{ deb.type }}</td>
                  <td>
                    <span class="badge" [ngClass]="getMilieuClass(deb.milieu)">
                      {{ deb.milieu }}
                    </span>
                  </td>
                  <td>{{ deb.province }}</td>
                  <td>
                    <span
                      class="badge"
                      [ngClass]="getStatutClass(deb.statut_operationnel)"
                    >
                      {{ deb.statut_operationnel }}
                    </span>
                  </td>
                  <td>
                    <a
                      [routerLink]="['/debarcaderes', deb.id]"
                      class="btn-small btn-flat waves-effect"
                    >
                      <i class="material-icons">visibility</i>
                    </a>
                    <a
                      [routerLink]="['/debarcaderes', deb.id, 'edit']"
                      class="btn-small btn-flat waves-effect"
                    >
                      <i class="material-icons">edit</i>
                    </a>
                    <a
                      (click)="deleteDebarcadere(deb)"
                      class="btn-small btn-flat waves-effect red-text"
                    >
                      <i class="material-icons">delete</i>
                    </a>
                  </td>
                </tr>
                <tr *ngIf="debarcaderes.length === 0">
                  <td colspan="7" class="center-align">
                    <p class="grey-text">
                      Aucun débarcadère trouvé avec ces critères
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
      .badge.Maritime {
        background-color: #2196f3;
        color: #ffffff;
      }

      .badge.Continental {
        background-color: #4caf50;
        color: #ffffff;
      }

      .badge.Lagunaire {
        background-color: #00bcd4;
        color: #ffffff;
      }
    `,
  ],
})
export class DebarcadereListComponent implements OnInit {
  debarcaderes: Debarcadere[] = [];
  loading = true;
  filters = {
    province: "",
    type: "",
    statut: "",
  };

  currentPage = 1;
  rowsPerPage = 10;

  constructor(private debarcadereService: DebarcadereService) {}

  ngOnInit() {
    this.loadDebarcaderes();
    // Initialiser les selects Materialize après le chargement
    setTimeout(() => this.initializeSelects(), 100);
  }

  loadDebarcaderes() {
    this.loading = true;
    const filterParams: any = {};

    if (this.filters.province) filterParams.province = this.filters.province;
    if (this.filters.type) filterParams.type = this.filters.type;
    if (this.filters.statut) filterParams.statut = this.filters.statut;

    this.debarcadereService.getDebarcaderes(filterParams).subscribe({
      next: (data) => {
        this.debarcaderes = data;
        this.loading = false;
      },
      error: (error) => {
        console.error("Erreur lors du chargement des débarcadères:", error);
        this.loading = false;
      },
    });
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.debarcaderes.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.debarcaderes.length / this.rowsPerPage);
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
    this.loadDebarcaderes();
  }

  deleteDebarcadere(debarcadere: Debarcadere) {
    if (
      confirm(
        `Êtes-vous sûr de vouloir supprimer le débarcadère "${debarcadere.denomination}" ?`,
      )
    ) {
      this.debarcadereService.deleteDebarcadere(debarcadere.id).subscribe({
        next: () => {
          this.loadDebarcaderes();
          // Toast notification (Materialize)
          if (typeof M !== "undefined") {
            M.toast({
              html: "Débarcadère supprimé avec succès",
              classes: "green",
            });
          }
        },
        error: (error) => {
          console.error("Erreur lors de la suppression:", error);
          if (typeof M !== "undefined") {
            M.toast({ html: "Erreur lors de la suppression", classes: "red" });
          }
        },
      });
    }
  }

  getStatutClass(statut: string): string {
    const classes: { [key: string]: string } = {
      Actif: "actif",
      Inactif: "inactif",
      "En travaux": "en-travaux",
    };
    return classes[statut] || "";
  }

  getMilieuClass(milieu: string): string {
    return milieu;
  }

  private initializeSelects() {
    if (typeof M !== "undefined") {
      const elems = document.querySelectorAll("select");
      M.FormSelect.init(elems, {});
    }
  }
}

declare var M: any;
