import { Component } from "@angular/core";
import { LicencesAutorisationsService } from "../../../services/licences-autorisations.service";
import { BateauService } from "../../../services/bateau.service";
import { EspeceService } from "../../../services/espece.service";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HasPermissionDirective } from "../../../directives/has-permission.directive";

@Component({
  selector: "app-licence-details",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, HasPermissionDirective],
  templateUrl: "./licence-details.component.html",
  styleUrl: "./licence-details.component.scss",
})
export class LicenceDetailsComponent {
  data: any = {};
  bateau: any = {};
  espece_cible1: any = {};
  espece_cible2: any = {};
  autorisation_id: any;
  captures: any;

  constructor(
    private bateauService: BateauService,
    private especeService: EspeceService,
    private licenceService: LicencesAutorisationsService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    // Vérifier si mode édition
    this.route.params.subscribe((params) => {
      if (params["id"]) {
        this.autorisation_id = +params["id"];
        this.getLicenceById(this.autorisation_id);
        this.getStatitisquesLicence(this.autorisation_id);
      }
    });
  }

  getLicenceById(id: number) {
    this.licenceService.getLicence(id).subscribe({
      next: (data) => {
        // console.log("Licence data:", data);
        this.data = data;
        if (this.data.bateau_id != "") {
          this.bateauService.getBateau(+this.data.bateau_id).subscribe(
            (data) => {
              this.bateau = data;
              // console.log(data);
            },
            (error) => {
              console.error("Error fetching pirogues:", error);
            },
          );
        }

        if (this.data.especes_autorisees) {
          this.especeService.getEspece(+this.data.especes_autorisees).subscribe(
            (data) => {
              this.espece_cible1 = data;
              // console.log(data);
            },
            (error) => {
              console.error("Error fetching pirogues:", error);
            },
          );
        }
        if (this.data.autres_especes) {
          this.especeService.getEspece(+this.data.autres_especes).subscribe(
            (data) => {
              this.espece_cible2 = data;
              // console.log(data);
            },
            (error) => {
              console.error("Error fetching pirogues:", error);
            },
          );
        }
      },
      error: (error) => {
        console.error("Error fetching licence:", error);
      },
    });
  }

  getStatitisquesLicence(id: number) {
    this.licenceService.getStatistiquesLicence(id).subscribe({
      next: (data) => {
        // console.log("Statistiques licence:", data);
        this.captures = data;
      },
      error: (error) => {
        console.error("Error fetching statistiques licence:", error);
      },
    });
  }

  deleteLicence(id: number) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cette licence ?")) {
      this.licenceService.deleteLicence(id).subscribe({
        next: () => {
          alert("Licence supprimée avec succès.");
          this.router.navigate(["/licences"]);
        },
        error: (error) => {
          console.error("Erreur lors de la suppression:", error);
          alert("Erreur lors de la suppression de la licence.");
        },
      });
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

  formatedImmatrication(data: any) {
    const parts = data.split("/");
    // const padded = parts[0].padStart(3, "0") + "/" + parts[1];
    const autorisation_number = parts[0].padStart(3, "0");
    return autorisation_number;
  }

  formatDateFrench(dateStr: string): string {
    const date = new Date(dateStr);
    const months = [
      "Janvier",
      "Février",
      "Mars",
      "Avril",
      "Mai",
      "Juin",
      "Juillet",
      "Août",
      "Septembre",
      "Octobre",
      "Novembre",
      "Décembre",
    ];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }
}
