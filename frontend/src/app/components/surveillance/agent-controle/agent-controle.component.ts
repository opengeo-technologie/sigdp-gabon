import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { HasPermissionDirective } from "../../../directives/has-permission.directive";

@Component({
  selector: "app-agent-controle",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./agent-controle.component.html",
  styleUrl: "./agent-controle.component.scss",
})
export class AgentControleComponent {
  agents: any[] = [];
  loading = true;
  filters = {
    fonction: "",
    organisme: "",
    matricule: "",
  };
  currentPage = 1;
  rowsPerPage = 10;

  ngOnInit() {
    this.loading = false;
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.agents.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.agents.length / this.rowsPerPage);
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
