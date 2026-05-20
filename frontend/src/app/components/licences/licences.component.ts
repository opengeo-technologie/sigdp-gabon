import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { HasPermissionDirective } from "../../directives/has-permission.directive";
declare var M: any;

@Component({
  selector: "app-licences",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HasPermissionDirective],
  templateUrl: "./licences.component.html",
  styleUrl: "./licences.component.scss",
})
export class LicencesComponent {
  licences: any[] = [];
  loading = true;
  searchTerm = "";
  filters = {
    type: "",
    statut: "",
  };

  currentPage = 1;
  rowsPerPage = 10;

  // constructor(private bateauService: BateauService) {}

  ngOnInit() {
    this.loadBData();
    setTimeout(() => this.initializeSelects(), 100);
  }

  loadBData() {
    this.loading = false;
    const filterParams: any = {};

    if (this.filters.type) filterParams.type = this.filters.type;
    if (this.filters.statut) filterParams.statut = this.filters.statut;

    // this.bateauService.getBateaux(filterParams).subscribe({
    //   next: (data) => {
    //     this.bateaux = data;
    //     this.loading = false;
    //   },
    //   error: (error) => {
    //     console.error("Erreur lors du chargement des bateaux:", error);
    //     this.loading = false;
    //     M.toast({
    //       html: "Erreur lors du chargement des bateaux",
    //       classes: "red",
    //     });
    //   },
    // });
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.licences.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.licences.length / this.rowsPerPage);
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
    this.loadBData();
  }

  search() {
    this.currentPage = 1;
    this.loadBData();
  }

  deleteLicence(licence: any) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette licence ?")) {
      // this.bateauService.deleteBateau(licence.id).subscribe({
      //   next: () => {
      //     M.toast({ html: "Licence supprimée", classes: "green" });
      //     this.loadBData();
      //   },
      //   error: (error) => {
      //     console.error("Erreur lors de la suppression:", error);
      //     M.toast({ html: "Erreur lors de la suppression", classes: "red" });
      //   },
      // });
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
