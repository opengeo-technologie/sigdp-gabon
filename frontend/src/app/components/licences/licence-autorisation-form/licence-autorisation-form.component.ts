import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AutorisationFormComponent } from "../autorisation-form/autorisation-form.component";
import { BateauService } from "../../../services/bateau.service";
import { EspeceService } from "../../../services/espece.service";

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
  bateau: any = {};
  espece_cible1: any = {};
  espece_cible2: any = {};

  constructor(
    private bateauService: BateauService,
    private especeService: EspeceService,
  ) {}

  ngOnInit() {
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

    if (this.data.espece_cible1) {
      this.especeService.getEspece(+this.data.espece_cible1).subscribe(
        (data) => {
          this.espece_cible1 = data;
          console.log(data);
          setTimeout(() => {
            this.initializeMaterialize();
          }, 500);
        },
        (error) => {
          console.error("Error fetching pirogues:", error);
        },
      );
    }
    if (this.data.espece_cible2) {
      this.especeService.getEspece(+this.data.espece_cible2).subscribe(
        (data) => {
          this.espece_cible2 = data;
          console.log(data);
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
