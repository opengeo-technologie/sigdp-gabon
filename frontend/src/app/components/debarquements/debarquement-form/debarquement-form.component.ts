import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Router } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { DebarquementService } from "../../../services/debarquement.service";
import { DebarcadereService } from "../../../services/debarcadere.service";
import { PecheurService } from "../../../services/pecheur.service";
import { BateauService } from "../../../services/bateau.service";
import { EspeceService } from "../../../services/espece.service";
import { DebarquementCreate } from "../../../models/debarquement.model";
import { Debarcadere } from "../../../models/debarcadere.model";
import { Pecheur } from "../../../models/pecheur.model";
import { Bateau } from "../../../models/bateau.model";
import { Espece } from "../../../models/espece.model";

declare var M: any;

@Component({
  selector: "app-debarquement-form",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./debarquement-form.component.html",
  styleUrls: ["./debarquement-form.component.css"],
})
export class DebarquementFormComponent implements OnInit {
  submitting = false;
  debarcaderes: Debarcadere[] = [];
  pecheurs: Pecheur[] = [];
  bateaux: Bateau[] = [];
  bateauxFiltered: Bateau[] = [];
  especes: Espece[] = [];

  formData: DebarquementCreate = {
    debarcadere_id: 0,
    bateau_id: 0,
    pecheur_principal_id: 0,
    date_debarquement: "",
    details: [{ espece_id: 0, quantite_kg: 0 }],
  };

  constructor(
    private debarquementService: DebarquementService,
    private debarcadereService: DebarcadereService,
    private pecheurService: PecheurService,
    private bateauService: BateauService,
    private especeService: EspeceService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.loadData();
    setTimeout(() => this.initMaterialize(), 500);
  }

  loadData() {
    this.debarcadereService.getDebarcaderes().subscribe((data) => {
      // console.log("Debarcaderes:", data);
      this.debarcaderes = data;
    });
    this.pecheurService.getPecheurs().subscribe((data) => {
      // console.log("Pecheurs:", data);
      this.pecheurs = data;
    });
    this.bateauService.getBateaux().subscribe((data) => {
      // console.log("Bateaux:", data);
      this.bateaux = data;
      this.bateauxFiltered = data;
    });
    this.especeService.getEspeces({ actif: true }).subscribe((data) => {
      // console.log("Especes:", data);
      this.especes = data;
    });
  }

  onPecheurChange() {
    if (this.formData.pecheur_principal_id) {
      this.bateauService
        .getBateauxByProprietaire(this.formData.pecheur_principal_id)
        .subscribe({
          next: (data) => {
            this.bateauxFiltered = data.length > 0 ? data : this.bateaux;
            setTimeout(() => this.initMaterialize(), 50);
          },
          error: () => {
            this.bateauxFiltered = this.bateaux;
          },
        });
    }
  }

  addCapture() {
    this.formData.details.push({ espece_id: 0, quantite_kg: 0 });
    setTimeout(() => this.initMaterialize(), 50);
  }

  removeCapture(index: number) {
    this.formData.details.splice(index, 1);
  }

  onSubmit() {
    this.submitting = true;

    // Calculer les valeurs totales
    this.formData.details = this.formData.details.map((d) => {
      if (d.prix_unitaire_kg && d.quantite_kg) {
        d.valeur_totale = d.prix_unitaire_kg * d.quantite_kg;
      }
      return d;
    });

    this.debarquementService.createDebarquement(this.formData).subscribe({
      next: (result) => {
        M.toast({
          html: "Débarquement enregistré avec succès",
          classes: "green",
        });
        if (result.has_alertes) {
          M.toast({
            html: `⚠️ ${this.countAlertes(result)} alerte(s) détectée(s)`,
            classes: "orange",
            displayLength: 6000,
          });
        }
        this.router.navigate(["/debarquements", result.id]);
      },
      error: (error) => {
        console.error("Erreur:", error);
        M.toast({ html: "Erreur lors de l'enregistrement", classes: "red" });
        this.submitting = false;
      },
    });
  }

  countAlertes(deb: any): number {
    let count = 0;
    if (deb.alerte_espece_protegee) count++;
    if (deb.alerte_quota_depasse) count++;
    if (deb.alerte_taille_illegale) count++;
    if (deb.alerte_bateau_non_conforme) count++;
    return count;
  }

  private initMaterialize() {
    if (typeof M !== "undefined") {
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.updateTextFields();
    }
  }
}
