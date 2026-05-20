import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { ArmementCooperativeService } from "../../services/armement-cooperative.service";

declare var M: any;

@Component({
  selector: "app-armement-cooperative",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./armement-cooperative.component.html",
  styleUrl: "./armement-cooperative.component.scss",
})
export class ArmementCooperativeComponent {
  armements: any[] = [];
  cooperatives: any[] = [];
  loading = true;
  searchTerm = "";
  filters = {
    type: "",
    statut: "",
  };

  currentPage = 1;
  rowsPerPage = 10;
  constructor(private armementCooperativeService: ArmementCooperativeService) {}

  ngOnInit() {
    this.loadData();
    setTimeout(() => this.initializeMaterialize(), 100);
  }

  initializeMaterialize() {
    if (typeof M !== "undefined") {
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.Datepicker.init(document.querySelectorAll(".datepicker"), {
        format: "yyyy-mm-dd",
        autoClose: true,
      });
      M.updateTextFields();
    }
  }

  loadData() {
    this.loading = false;
    const filterParams: any = {};

    if (this.filters.type) filterParams.type_association = this.filters.type;
    if (this.filters.statut) filterParams.statut = this.filters.statut;

    this.armementCooperativeService
      .getArmementsCooperatives(filterParams)
      .subscribe({
        next: (data) => {
          this.armements = data;
          this.loading = false;
        },
        error: (error) => {
          console.error(
            "Erreur lors du chargement des armements coopératives:",
            error,
          );
          this.loading = false;
        },
      });
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.armements.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.armements.length / this.rowsPerPage);
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
    this.loadData();
  }

  search() {
    if (this.searchTerm.trim()) {
      this.armementCooperativeService
        .searchArmementsCooperatives(this.searchTerm.trim())
        .subscribe({
          next: (data) => {
            this.armements = data;
            this.loading = false;
          },
          error: (error) => {
            console.error("Armement/coopérative non trouvé:", error);
            M.toast({
              html: "Armement/coopérative non trouvé",
              classes: "orange",
            });
            this.loadData();
          },
        });
    } else {
      this.loadData();
    }
  }
}
