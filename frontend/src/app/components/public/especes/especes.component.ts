import { Component } from "@angular/core";
import { EspeceService } from "../../../services/espece.service";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { environment } from "../../../../environments/environment";

@Component({
  selector: "app-especes",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./especes.component.html",
  styleUrls: ["./especes.component.scss"],
})
export class EspecesComponent {
  especes: any[] = [];
  loading = true;
  currentPage = 1;
  rowsPerPage = 12;

  url: any = `${environment.apiUrl}/uploads/especes/`;

  constructor(private especesService: EspeceService) {}

  ngOnInit() {
    this.loadEspeces();
  }

  loadEspeces() {
    this.especesService.getEspeces().subscribe({
      next: (data) => {
        // console.log("Espèces chargées:", data);
        this.especes = data;
        this.especes.sort((a, b) => {
          const compare = a.code_espece.localeCompare(b.code_espece);
          return compare;
        });
        this.loading = false;
      },
      error: (error) => {
        console.error("Erreur lors du chargement des espèces:", error);
        this.loading = false;
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
}
