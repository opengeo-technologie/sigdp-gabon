import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
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
import { HasPermissionDirective } from "../../../directives/has-permission.directive";

declare var M: any;

@Component({
  selector: "app-debarcadere-list",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HasPermissionDirective],
  templateUrl: "./debarcadere-list.component.html",
  styleUrls: ["./debarcadere-list.component.css"],
})
export class DebarcadereListComponent implements OnInit {
  @ViewChild("selectLocalite") selectLocalite!: ElementRef;
  debarcaderes: Debarcadere[] = [];
  localites: any[] = [];
  loading = true;
  filters = {
    province: "",
    type: "",
    statut: "",
    localite: "",
    limit: 10,
  };

  nom_site: string | undefined;

  filterParams: any = {};

  currentPage = 1;
  rowsPerPage = 10;
  totalData = 0;

  constructor(private debarcadereService: DebarcadereService) {}

  ngOnInit() {
    this.filterParams.limit = this.filters.limit;
    // Initialiser les selects Materialize après le chargement
    setTimeout(() => this.initializeSelects(), 100);
  }

  ngAfterViewInit() {
    this.loadDebarcaderes();
    this.loadLocalites();
    if (!this.selectLocalite?.nativeElement) return;

    const element = this.selectLocalite.nativeElement;

    // ✅ 1. Vérifier Materialize chargé
    if (!M?.FormSelect) {
      console.error("Materialize not loaded");
      return;
    }

    // ✅ 2. Initialiser
    M.FormSelect.init(element);

    // ✅ 3. Délai important!
    setTimeout(() => {
      const instance = M.FormSelect.getInstance(element);

      if (instance) {
        console.log("✅ Ready!");
        // Utiliser instance
      }
    }, 100); // ✅ 100ms est important!
  }

  loadDebarcaderes() {
    this.loading = true;
    // const filterParams: any = {};

    if (this.filters.province)
      this.filterParams.province = this.filters.province;
    if (this.filters.type) this.filterParams.type = this.filters.type;
    if (this.filters.statut) this.filterParams.statut = this.filters.statut;
    if (this.filters.localite)
      this.filterParams.localite = this.filters.localite;

    this.debarcadereService.getDebarcaderes(this.filterParams).subscribe({
      next: (data) => {
        // console.log(data);
        this.debarcaderes = data.result;
        this.totalData = data.total;
        this.debarcaderes.sort((a, b) => {
          // const compare = a.denomination.localeCompare(b.denomination);
          const compare = a.taille_flottile - b.taille_flottile;
          return -compare;
        });
        this.loading = false;
      },
      error: (error) => {
        console.error("Erreur lors du chargement des débarcadères:", error);
        this.loading = false;
      },
    });
  }

  loadLocalites() {
    this.debarcadereService.getLocalites().subscribe({
      next: (data) => {
        this.localites = data;
        // this.filteredZones = this.localites;
        // this.addSearchBox(this.selectLocalite.nativeElement);
        setTimeout(() => {
          M.FormSelect.init(this.selectLocalite?.nativeElement);
          this.addSearchBox(this.selectLocalite?.nativeElement);
        }, 1000);
      },
      error: (error) => {
        console.error("Erreur lors du chargement des débarcadères:", error);
        this.loading = false;
      },
    });
  }

  addSearchBox(element: any) {
    const dropdownContent = document.querySelector(
      ".select-dropdown.dropdown-content",
    ) as HTMLElement;
    if (!dropdownContent) return;

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Rechercher...";
    searchInput.classList.add("browser-default", "search-input");
    searchInput.style.margin = "8px";
    searchInput.style.width = "90%";

    //// --- Prevent dropdown from closing ---
    // Handle both mousedown and click (Materialize listens to both)
    ["mousedown", "click"].forEach((evt) => {
      searchInput.addEventListener(evt, (event) => {
        event.stopPropagation();
        event.preventDefault();
      });
    });

    dropdownContent.insertBefore(searchInput, dropdownContent.firstChild);

    // Filter options
    searchInput.addEventListener("keyup", () => {
      const filter = searchInput.value.toLowerCase();
      const items = dropdownContent.querySelectorAll("li > span");
      items.forEach((item: any) => {
        const text = item.textContent.toLowerCase();
        (item.parentElement as HTMLElement).style.display = text.includes(
          filter,
        )
          ? ""
          : "none";
      });
    });
    // --- Focus automatically when dropdown opens ---
    const selectInput = element;
    const instance = M.FormSelect.getInstance(selectInput);

    if (instance && instance.dropdown) {
      instance.dropdown.options.onOpenStart = () => {
        setTimeout(() => searchInput.focus(), 200);
      };
    }
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.debarcaderes.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.totalData / this.rowsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++;
      this.filterParams.skip = (this.currentPage - 1) * this.filters.limit;
      this.loadDebarcaderes();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.filterParams.skip = (this.currentPage - 1) * this.filters.limit;
      this.loadDebarcaderes();
    }
  }

  applyFilters() {
    // this.filterParams.limit = this.totalData;
    this.loadDebarcaderes();
  }

  search() {}

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
