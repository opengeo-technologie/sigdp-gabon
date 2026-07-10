import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AutorisationFormComponent } from "../autorisation-form/autorisation-form.component";
import { BateauService } from "../../../services/bateau.service";
import { EspeceService } from "../../../services/espece.service";
import { ActivatedRoute, Router } from "@angular/router";
import { LicencesAutorisationsService } from "../../../services/licences-autorisations.service";

declare var M: any;

@Component({
  selector: "app-licence-autorisation-form",
  standalone: true,
  imports: [CommonModule, FormsModule, AutorisationFormComponent],
  templateUrl: "./licence-autorisation-form.component.html",
  styleUrl: "./licence-autorisation-form.component.scss",
})
export class LicenceAutorisationFormComponent implements OnInit {
  type_peche: any = "Autorisation";
  data: any = {};
  editData: any | undefined;
  bateau: any = {};
  espece_cible1: any = {};
  espece_cible2: any = {};
  autorisation_id: any;
  isEditMode: boolean = false;

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
        this.isEditMode = true;
        this.autorisation_id = +params["id"];
        this.getLicenceById(this.autorisation_id);
      }
    });
    this.initializeMaterialize();
  }

  onFormChange(value: any) {
    this.data = value;
    // console.log("Received from child:", value);
    if (this.data.bateau_id != "") {
      this.bateauService.getBateau(+this.data.bateau_id).subscribe(
        (data) => {
          this.bateau = data;
          // console.log(data);
          setTimeout(() => {
            this.initializeMaterialize();
          }, 500);
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
          setTimeout(() => {
            this.initializeMaterialize();
          }, 500);
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
          setTimeout(() => {
            this.initializeMaterialize();
          }, 500);
        },
        (error) => {
          console.error("Error fetching pirogues:", error);
        },
      );
    }
  }

  private initializeMaterialize() {
    if (typeof M === "undefined") {
      console.error("Materialize not loaded");
      return;
    }

    setTimeout(() => {
      const selects = document.querySelectorAll("select");
      M.FormSelect.init(selects, {});

      // const textareas = document.querySelectorAll("textarea");
      // M.textareaAutoResize(textareas);
      M.updateTextFields();
    }, 500);
  }

  getLicenceById(id: number) {
    this.licenceService.getLicence(id).subscribe({
      next: (data) => {
        this.editData = data;
        // this.data = data;
        // console.log(data);
        setTimeout(() => {
          this.initializeMaterialize();
        }, 500);
      },
      error: (error) => {
        console.error("Error fetching licence:", error);
      },
    });
  }

  formatedImmatrication(data: any) {
    const parts = data.split("/");
    // const padded = parts[0].padStart(3, "0") + "/" + parts[1];
    const autorisation_number = parts[0].padStart(3, "0");
    return autorisation_number;
  }

  onChangeType(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    // console.log(value);
    this.type_peche = value;
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
