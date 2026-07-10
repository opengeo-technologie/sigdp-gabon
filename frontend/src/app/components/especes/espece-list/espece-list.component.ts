import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { EspeceService } from "../../../services/espece.service";
import { Espece } from "../../../models/espece.model";
import { environment } from "../../../../environments/environment";

declare var M: any;

@Component({
  selector: "app-espece-list",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1>
          <i class="material-icons left">set_meal</i> Espèces halieutiques
        </h1>
        <p>Référentiel des espèces de poissons du Gabon</p>
      </div>
    </div>

    <div class="container-fluid">
      <!-- Filtres et recherche -->
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
                  <option value="Poissons pélagiques">
                    Poissons pélagiques
                  </option>
                  <option value="Poissons démersaux">Poissons démersaux</option>
                  <option value="Poissons d'eaux douces">
                    Poissons d'eaux douces
                  </option>
                  <option value="Crustacés">Crustacés</option>
                  <option value="Mollusques">Mollusques</option>
                  <option value="Espèces protégées">Espèces protégées</option>
                </select>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="form-input">
                <label>Statut réglementaire</label>
                <select
                  [(ngModel)]="filters.statut"
                  (change)="applyFilters()"
                  class="browser-default"
                >
                  <option value="">Tous les statuts</option>
                  <option value="Libre">Libre</option>
                  <option value="Sous quota">Sous quota</option>
                  <option value="Protégé">Protégé</option>
                  <option value="Saisonnier">Saisonnier</option>
                </select>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="form-input">
                <label for="search-input">Nom ou code</label>
                <div class="input-field">
                  <input
                    type="text"
                    [(ngModel)]="searchTerm"
                    (keyup.enter)="search()"
                    placeholder="Rechercher..."
                    id="search-input"
                  />
                </div>
              </div>
            </div>
            <div class="col s12 m3">
              <div class="form-input">
                <a
                  routerLink="/especes/new"
                  class="btn btn-primary waves-effect waves-light"
                  style="margin-top: 1.5rem;"
                >
                  <i class="material-icons left">add</i>
                  Nouvelle espèce
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Résultats -->
      <div class="card" *ngIf="!loading">
        <div class="card-content">
          <span class="card-title"
            >{{ especes.length }} espèce(s) trouvée(s)</span
          >
          <div class="row">
            <div class="col s12 m6 l4" *ngFor="let espece of paginatedData">
              <div class="card hoverable espece-card">
                <div class="card-image" *ngIf="espece.photo_url">
                  <img
                    [src]="url + espece.photo_url"
                    alt="{{ espece.nom_commun_francais }}"
                    onerror="this.style.display='none'"
                  />
                </div>
                <div class="card-image" *ngIf="!espece.photo_url">
                  <img
                    [src]="'../../../../assets/fish.png'"
                    alt="{{ espece.nom_commun_francais }}"
                    onerror="this.style.display='none'"
                  />
                </div>
                <div class="card-content">
                  <span class="card-title truncate">{{
                    espece.nom_commun_francais
                  }}</span>
                  <p>
                    <em>{{ espece.nom_scientifique }}</em>
                  </p>
                  <p><strong>Code:</strong> {{ espece.code_espece }}</p>
                  <p>
                    <span
                      class="badge"
                      [ngClass]="getStatutClass(espece.statut_reglementaire)"
                    >
                      {{ espece.statut_reglementaire }}
                    </span>
                  </p>
                  <p *ngIf="espece.taille_minimale_legale_cm">
                    <small
                      ><strong>TML:</strong>
                      {{ espece.taille_minimale_legale_cm }} cm</small
                    >
                  </p>
                  <p *ngIf="espece.quota_mensuel_tonnes">
                    <small
                      ><strong>Quota:</strong>
                      {{ espece.quota_mensuel_tonnes }} t/mois</small
                    >
                  </p>
                </div>
                <div class="card-action">
                  <a [routerLink]="['/especes', espece.id]">Voir détails</a>
                  <a [routerLink]="['/especes', espece.id, 'edit']">Modifier</a>
                </div>
              </div>
            </div>
          </div>
          <p *ngIf="especes.length === 0" class="center-align grey-text">
            Aucune espèce trouvée
          </p>
          <div class="center" style="padding-top: 20px">
            <button
              (click)="prevPage()"
              class="btn waves-effect waves-light white darken-4 btn-small"
              [disabled]="currentPage === 1"
            >
              <i class="material-icons" style="color: #000000;">chevron_left</i>
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
      .espece-card {
        height: 400px;
      }
      .card-image img {
        max-height: 200px;
        object-fit: contain;
      }
      .badge.Libre {
        background-color: #4caf50;
        color: white;
      }
      .badge.Sous-quota {
        background-color: #ff9800;
        color: white;
      }
      .badge.Protégé {
        background-color: #f44336;
        color: white;
      }
      .badge.Saisonnier {
        background-color: #2196f3;
        color: white;
      }
    `,
  ],
})
export class EspeceListComponent implements OnInit {
  especes: Espece[] = [];
  loading = true;
  searchTerm = "";
  filters = { categorie: "", statut: "" };

  currentPage = 1;
  rowsPerPage = 12;

  url: any = `${environment.apiUrl}/uploads/especes/`;

  constructor(private especeService: EspeceService) {}

  ngOnInit() {
    this.loadEspeces();
    setTimeout(() => this.initializeSelects(), 100);
  }

  loadEspeces() {
    this.loading = true;
    const filterParams: any = {};
    if (this.filters.categorie) filterParams.categorie = this.filters.categorie;
    if (this.filters.statut)
      filterParams.statut_reglementaire = this.filters.statut;

    this.especeService.getEspeces(filterParams).subscribe({
      next: (data) => {
        // console.log("Espèces chargées:", data);
        this.especes = data;
        this.especes.sort((a, b) => {
          const compare = a.code_espece.localeCompare(b.code_espece);
          return compare;
        });
        this.loading = false;
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
        M.toast({ html: "Erreur de chargement", classes: "red" });
      },
    });
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.especes.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.especes.length / this.rowsPerPage);
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
    this.loadEspeces();
  }

  search() {
    if (this.searchTerm.trim()) {
      this.especeService
        .getEspeces({ search: this.searchTerm.trim() })
        .subscribe({
          next: (data) => {
            this.especes = data;
          },
          error: (err) => {
            console.error(err);
            M.toast({ html: "Aucun résultat", classes: "orange" });
          },
        });
    } else {
      this.loadEspeces();
    }
  }

  getStatutClass(statut: string): string {
    return statut.replace(" ", "-").replace("é", "e");
  }

  getPhotoUrl(id: number): string {
    return this.especeService.getPhotoUrl(id);
  }

  private initializeSelects() {
    if (typeof M !== "undefined")
      M.FormSelect.init(document.querySelectorAll("select"), {});
  }
}
