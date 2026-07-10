import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { HasPermissionDirective } from "../../../directives/has-permission.directive";

@Component({
  selector: "app-missions",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./missions.component.html",
  styleUrl: "./missions.component.scss",
})
export class MissionsComponent {
  missions: any[] = [];
  loading = true;
  filters = {
    type_mission: "",
    moyen_controle: "",
    date_depart: "",
  };
  currentPage = 1;
  rowsPerPage = 10;

  ngOnInit() {
    this.loading = false;
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.missions.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.missions.length / this.rowsPerPage);
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
    // this.loadPecheurs();
  }
}
