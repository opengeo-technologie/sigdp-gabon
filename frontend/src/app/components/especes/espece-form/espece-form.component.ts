import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Router, ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { EspeceService } from "../../../services/espece.service";
import {
  Espece,
  EspeceCreate,
  CategorieEspece,
  StatutReglementaire,
} from "../../../models/espece.model";
import { PhotoUploaderComponent } from "../photo-uploader/photo-uploader.component";

declare var M: any;

@Component({
  selector: "app-espece-form",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PhotoUploaderComponent],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1>
          <i class="material-icons left">{{ isEditMode ? "edit" : "add" }}</i>
          {{ isEditMode ? "Modifier" : "Nouvelle" }} espèce
        </h1>
      </div>
    </div>

    <div class="container-fluid">
      <div class="card">
        <div class="card-content">
          <form (ngSubmit)="onSubmit()" #especeForm="ngForm">
            <div class="row">
              <div class="input-field col s12 m6">
                <input
                  id="code"
                  type="text"
                  [(ngModel)]="formData.code_espece"
                  name="code"
                  required
                />
                <label for="code">Code espèce *</label>
              </div>
              <div class="input-field col s12 m6">
                <input
                  id="nom_sci"
                  type="text"
                  [(ngModel)]="formData.nom_scientifique"
                  name="nom_sci"
                  required
                />
                <label for="nom_sci">Nom scientifique *</label>
              </div>
            </div>
            <div class="row">
              <div class="input-field col s12 m6">
                <input
                  id="nom_fr"
                  type="text"
                  [(ngModel)]="formData.nom_commun_francais"
                  name="nom_fr"
                  required
                />
                <label for="nom_fr">Nom français *</label>
              </div>
              <div class="input-field col s12 m6">
                <select
                  [(ngModel)]="formData.categorie"
                  name="categorie"
                  required
                >
                  <option value="" disabled>Choisir</option>
                  <option value="Poissons pélagiques">
                    Poissons pélagiques
                  </option>
                  <option value="Poissons démersaux">Poissons démersaux</option>
                  <option value="Poissons d'eaux douces">
                    Poissons d'eaux douces
                  </option>
                  <option value="Crustacés">Crustacés</option>
                  <option value="Mollusques">Mollusques</option>
                </select>
                <label>Catégorie *</label>
              </div>
            </div>
            <div class="row">
              <div class="input-field col s12 m4">
                <select
                  [(ngModel)]="formData.statut_reglementaire"
                  name="statut"
                >
                  <option value="Libre">Libre</option>
                  <option value="Sous quota">Sous quota</option>
                  <option value="Protégé">Protégé</option>
                  <option value="Saisonnier">Saisonnier</option>
                </select>
                <label>Statut</label>
              </div>
              <div class="input-field col s12 m4">
                <input
                  id="tml"
                  type="number"
                  step="0.1"
                  [(ngModel)]="formData.taille_minimale_legale_cm"
                  name="tml"
                />
                <label for="tml">TML (cm)</label>
              </div>
              <div class="input-field col s12 m4">
                <input
                  id="quota"
                  type="number"
                  step="0.1"
                  [(ngModel)]="formData.quota_mensuel_tonnes"
                  name="quota"
                />
                <label for="quota">Quota mensuel (t)</label>
              </div>
            </div>
            <!-- Section Photo -->
            <div class="col s12">
              <div class="card">
                <div class="card-content">
                  <span class="card-title">
                    <i class="material-icons left">portrait</i>
                    Photo espèce
                  </span>

                  <!-- Composant Photo Uploader -->
                  <app-photo-uploader
                    (photoSelected)="onPhotoSelected($event)"
                    (photoRemoved)="onPhotoRemoved()"
                  >
                  </app-photo-uploader>
                </div>
              </div>
            </div>
            <div class="row">
              <div class="col s12">
                <button
                  type="submit"
                  class="btn btn-primary waves-effect"
                  [disabled]="!especeForm.form.valid"
                >
                  <i class="material-icons left">save</i
                  >{{ isEditMode ? "Mettre à jour" : "Créer" }}
                </button>
                <a routerLink="/especes" class="btn btn-flat waves-effect ml-2">
                  <i class="material-icons left">cancel</i>Annuler
                </a>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .ml-2 {
        margin-left: 1rem;
      }
    `,
  ],
})
export class EspeceFormComponent implements OnInit {
  isEditMode = false;
  especeId?: number;
  formData: EspeceCreate = {
    code_espece: "",
    nom_scientifique: "",
    nom_commun_francais: "",
    categorie: "" as CategorieEspece,
    statut_reglementaire: "Libre" as StatutReglementaire,
    photo: null,
  };

  constructor(
    private especeService: EspeceService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      if (params["id"]) {
        this.isEditMode = true;
        this.especeId = +params["id"];
        this.loadEspece();
      }
    });
    setTimeout(() => this.initMaterialize(), 100);
  }

  loadEspece() {
    if (this.especeId) {
      this.especeService.getEspece(this.especeId).subscribe({
        next: (d) => {
          this.formData = { ...d };
          setTimeout(() => {
            this.initMaterialize();
            M.updateTextFields();
          }, 100);
        },
        error: (e) => {
          console.error(e);
          M.toast({ html: "Erreur", classes: "red" });
        },
      });
    }
  }

  onSubmit() {
    const formData = new FormData();
    formData.append("code_espece", this.formData.code_espece);
    formData.append("nom_scientifique", this.formData.nom_scientifique);
    formData.append("nom_commun_francais", this.formData.nom_commun_francais);
    formData.append("categorie", this.formData.categorie);
    if (this.formData.statut_reglementaire)
      formData.append(
        "statut_reglementaire",
        this.formData.statut_reglementaire,
      );
    if (this.formData.taille_minimale_legale_cm !== undefined)
      formData.append(
        "taille_minimale_legale_cm",
        this.formData.taille_minimale_legale_cm.toString(),
      );
    if (this.formData.quota_mensuel_tonnes !== undefined)
      formData.append(
        "quota_mensuel_tonnes",
        this.formData.quota_mensuel_tonnes.toString(),
      );
    if (this.formData.photo) formData.append("photo", this.formData.photo);

    const obs =
      this.isEditMode && this.especeId
        ? this.especeService.updateEspeceWithPhoto(this.especeId, formData)
        : this.especeService.createEspeceWithPhoto(formData);

    obs.subscribe({
      next: () => {
        M.toast({ html: "Succès", classes: "green" });
        this.router.navigate(["/especes"]);
      },
      error: (e) => {
        console.error(e);
        M.toast({ html: "Erreur", classes: "red" });
      },
    });
  }

  private initMaterialize() {
    if (typeof M !== "undefined")
      M.FormSelect.init(document.querySelectorAll("select"), {});
  }

  onPhotoSelected(file: File) {
    this.formData.photo = file;
    console.log("Photo sélectionnée:", file.name, file.size);
  }

  onPhotoRemoved() {
    this.formData.photo = null;
    console.log("Photo supprimée");
  }
}
