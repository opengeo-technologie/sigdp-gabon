import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { HasPermissionDirective } from "../../directives/has-permission.directive";
import { LicencesAutorisationsService } from "../../services/licences-autorisations.service";
import { AutorisationPechePdfService } from "../../services/autorisation-pdf.service";
import { ImageHelperService } from "../../services/image-helper.service";
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
    limit: 10,
  };

  filterParams: any = {};

  currentPage = 1;
  rowsPerPage = 10;
  totalData = 0;

  constructor(
    private licenceService: LicencesAutorisationsService,
    private pdf: AutorisationPechePdfService,
    private imageHelper: ImageHelperService,
  ) {}

  ngOnInit() {
    this.filterParams.limit = this.filters.limit;
    this.loadBData();
    setTimeout(() => this.initializeSelects(), 100);
  }

  loadBData() {
    this.loading = false;
    // const filterParams: any = {};

    if (this.filters.type) this.filterParams.type = this.filters.type;
    if (this.filters.statut) this.filterParams.statut = this.filters.statut;

    this.licenceService.getLicences(this.filterParams).subscribe({
      next: (data) => {
        console.log("Licences chargées:", data);
        this.licences = data.result;
        this.totalData = data.total;
        this.loading = false;
      },
      error: (error) => {
        console.error("Erreur lors du chargement des licences:", error);
        this.loading = false;
        M.toast({
          html: "Erreur lors du chargement des licences",
          classes: "red",
        });
      },
    });
  }

  // get paginatedData() {
  //   const start = (this.currentPage - 1) * this.rowsPerPage;
  //   return this.licences.slice(start, start + this.rowsPerPage);
  // }

  totalPages() {
    return Math.ceil(this.totalData / this.rowsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++;
      this.filterParams.skip = (this.currentPage - 1) * this.filters.limit;
      this.loadBData();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.filterParams.skip = (this.currentPage - 1) * this.filters.limit;
      this.loadBData();
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

  listSiteDebarquement(site_obligatoire: any[]): string {
    if (!site_obligatoire || site_obligatoire.length === 0) {
      return "N/A";
    }
    return site_obligatoire.map((s) => s.nom).join(", ");
  }

  checkProprietaireType(type: string): "NATIONAL" | "ETRANGER" {
    return type === "Gabonaise" ? "NATIONAL" : "ETRANGER";
  }

  async generatePDf(licenceId: number) {
    const logoBase64 = await this.imageHelper.getBase64ImageFromURL(
      "../../../assets/logo.jpg",
    );

    this.licenceService.getLicence(licenceId).subscribe({
      next: (data) => {
        // console.log("Données de la licence:", data);
        // this.pdfService.generateLicencePDF(data);
        this.pdf.open({
          numero: data.numero_licence.padStart(3, "0"),
          anneeValidite: data.annee_validite,
          proprietaireType: this.checkProprietaireType(
            data.proprietaire_info.nationalite,
          ),
          embarcation: {
            nom: data.bateau_info.nom,
            immatriculation: data.bateau_info.immatriculation,
            typePirogue: data.bateau_info.type_bateau,
            marqueMoteur: data.bateau_info.moteur_marque || "N/A",
            puissanceCv: data.bateau_info.moteur_puissance_cv,
            debarcadereAttache: data.bateau_info.site_port_attache.nom,
            siteDebarquement: this.listSiteDebarquement(
              data.bateau_info.site_obligatoire,
            ),
          },
          proprietaire: {
            nom:
              data.proprietaire_info.nom + " " + data.proprietaire_info.prenom,
            nationalite: data.proprietaire_info.nationalite,
            typePiece: data.proprietaire_info.type_piece_identite || "N/A",
            numeroPiece: data.proprietaire_info.numero_piece_identite || "N/A",
            residence: data.proprietaire_info.adresse || "N/A",
            telephone: data.proprietaire_info.telephone || "N/A",
            cooperative: data.bateau_info.cooperative.denomination || "N/A",
          },
          engins: {
            engin1: "Senne tournante",
            especes1: "Sardine",
            codeBarre: "SIGDP-AUTH-452-2026",
          },
          periodeDebut: data.date_debut
            ? new Date(data.date_debut).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "N/A",
          periodeFin: data.date_expiration
            ? new Date(data.date_expiration).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "N/A",
          montantFcfa: 200000,
          quittanceTresor: "2419",
          faitA: "Libreville",
          dateFait: data.date_emission
            ? new Date(data.date_emission).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "N/A",
          signataire: "Brice Didier Celce KOUMBA MABERT",
          logoBase64: logoBase64,
        });
      },
      error: (error) => {
        console.error("Erreur lors de la récupération de la licence:", error);
        M.toast({
          html: "Erreur lors de la récupération de la licence",
          classes: "red",
        });
      },
    });
  }
}
