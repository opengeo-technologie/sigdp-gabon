import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { InfractionsService } from "../../../services/infractions.service";
import * as L from "leaflet";

declare const M: any;

@Component({
  selector: "app-infractions",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./infractions.component.html",
  styleUrl: "./infractions.component.scss",
})
export class InfractionsComponent {
  private infractionsService = inject(InfractionsService);
  infractions: any[] = [];
  loading = true;
  enEdition = false;
  filters = {
    type_mission: "",
    moyen_controle: "",
    date_depart: "",
  };

  form = {
    libelle_infra: "",
    type_infra: "",
    description: "",
    sanction_proposee: "",
  };
  currentPage = 1;
  rowsPerPage = 10;

  editionId: number | null = null;
  erreur = "";
  private modaleInst: any;

  ngOnInit() {
    this.loading = false;
    this.loadInfractions();
    this.initModale();
  }

  private formVide(): any {
    return {
      libelle_infra: "",
      type_infra: null,
      description: "",
      sanction_proposee: "",
    };
  }

  private initModale(): void {
    const el = document.getElementById("modaleInfraction");
    if (el && el.parentElement !== document.body) document.body.appendChild(el); // fix z-index
    this.modaleInst = M.Modal.init(el, { dismissible: false });
  }

  private loadInfractions() {
    this.loading = true;
    this.infractionsService.getInfractions().subscribe(
      (data) => {
        this.infractions = data;
        this.loading = false;
      },
      (error) => {
        console.error("Erreur lors du chargement des infractions:", error);
        this.loading = false;
      },
    );
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.infractions.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.infractions.length / this.rowsPerPage);
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

  // -- CRUD
  ouvrirCreation(): void {
    this.enEdition = false;
    this.editionId = null;
    this.erreur = "";
    this.form = this.formVide();
    // this.isLoadingModal = true;
    this.ouvrirModale();
  }

  ouvrirEdition(c: any): void {
    this.enEdition = true;
    this.editionId = c.id;
    this.erreur = "";
    this.form = {
      libelle_infra: c.libelle_infra,
      type_infra: c.type_infra,
      description: c.description,
      sanction_proposee: c.sanction_proposee,
    };
    this.ouvrirModale();
  }

  private ouvrirModale(): void {
    setTimeout(() => {
      setTimeout(() => {
        this.modaleInst?.open();
        // this.isLoadingModal = false;
      }, 100);
    }, 0);
  }

  enregistrer() {
    const obs =
      this.enEdition && this.editionId != null
        ? this.infractionsService.updateInfraction(this.editionId, this.form)
        : this.infractionsService.createInfraction(this.form);

    obs.subscribe({
      next: () => {
        this.modaleInst?.close();
        this.loadInfractions();
        this.toast("Infraction enregistrée.");
        this.form = this.formVide();
      },
      error: (err) => {
        this.erreur = err?.error?.detail ?? "Enregistrement impossible.";
      },
    });
  }

  supprimer(c: any): void {
    if (!confirm(`Supprimer l'infraction ${c.libelle_infra}  ?`)) return;
    this.infractionsService.deleteInfraction(c.id).subscribe(() => {
      this.loadInfractions();
      this.toast("Infraction Supprimée.");
    });
  }

  private toast(msg: string, erreur = false): void {
    M.toast({ html: msg, classes: erreur ? "red" : "green" });
  }
}
