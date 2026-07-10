import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Router, ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { DebarcadereService } from "../../../services/debarcadere.service";
import {
  Debarcadere,
  DebarcadereCreate,
  DebarcadereType,
  Milieu,
  StatutOperationnel,
} from "../../../models/debarcadere.model";
import { PhotoUploaderComponent } from "../photo-uploader/photo-uploader.component";

declare var M: any;

@Component({
  selector: "app-debarcadere-form",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PhotoUploaderComponent],
  templateUrl: "./debarcadere-form.component.html",
  styleUrls: ["./debarcadere-form.component.css"],
})
export class DebarcadereFormComponent implements OnInit {
  @ViewChild(PhotoUploaderComponent) photoUploader!: PhotoUploaderComponent;
  isEditMode = false;
  debarcadereId?: number;

  formData: DebarcadereCreate = {
    code: "",
    denomination: "",
    nom_local: "",
    type: "" as DebarcadereType,
    milieu: "" as Milieu,
    latitude: 0,
    longitude: 0,
    province: "",
    statut_operationnel: "Actif" as StatutOperationnel,
    infrastructure_quai: false,
    infrastructure_chambre_froide: false,
    infrastructure_glace: false,
    infrastructure_marche: false,
    infrastructure_carburant: false,
    infrastructure_eau: false,
    infrastructure_electricite: false,
    photo: null,
  };

  types: DebarcadereType[] = [
    DebarcadereType.OFFICIEL,
    DebarcadereType.INFORMEL,
    DebarcadereType.SAISONNIER,
    DebarcadereType.CAPA,
  ];

  constructor(
    private debarcadereService: DebarcadereService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      if (params["id"]) {
        this.isEditMode = true;
        this.debarcadereId = +params["id"];
        this.loadDebarcadere();
      }
    });

    setTimeout(() => this.initializeMaterialize(), 100);
  }

  loadDebarcadere() {
    if (this.debarcadereId) {
      this.debarcadereService.getDebarcadere(this.debarcadereId).subscribe({
        next: (data) => {
          this.formData = { ...data };
          setTimeout(() => {
            this.initializeMaterialize();
            M.updateTextFields();
          }, 100);
        },
        error: (error) => {
          console.error("Erreur lors du chargement:", error);
          M.toast({
            html: "Erreur lors du chargement du débarcadère",
            classes: "red",
          });
        },
      });
    }
  }

  onSubmit() {
    if (this.isEditMode && this.debarcadereId) {
      this.debarcadereService
        .updateDebarcadere(this.debarcadereId, this.formData)
        .subscribe({
          next: () => {
            M.toast({
              html: "Débarcadère mis à jour avec succès",
              classes: "green",
            });
            this.router.navigate(["/debarcaderes"]);
          },
          error: (error) => {
            console.error("Erreur lors de la mise à jour:", error);
            M.toast({ html: "Erreur lors de la mise à jour", classes: "red" });
          },
        });
    } else {
      this.debarcadereService.createDebarcadere(this.formData).subscribe({
        next: () => {
          M.toast({ html: "Débarcadère créé avec succès", classes: "green" });
          this.router.navigate(["/debarcaderes"]);
        },
        error: (error) => {
          console.error("Erreur lors de la création:", error);
          M.toast({ html: "Erreur lors de la création", classes: "red" });
        },
      });
    }
  }

  saveDebarcadere() {
    const formData = new FormData();
    formData.append("code", this.formData.code);
    formData.append("nom_local", this.formData.nom_local || "");
    formData.append("denomination", this.formData.denomination);
    formData.append("type", this.formData.type);
    formData.append("milieu", this.formData.milieu);
    formData.append("latitude", this.formData.latitude.toString());
    formData.append("longitude", this.formData.longitude.toString());
    formData.append("province", this.formData.province);
    formData.append("departement", this.formData.departement || "");
    formData.append("localite", this.formData.localite || "");
    formData.append("description", this.formData.description || "");
    formData.append(
      "capacite_accueil",
      this.formData.capacite_accueil?.toString() || "0",
    );
    formData.append(
      "agent_responsable_nom",
      this.formData.agent_responsable_nom || "",
    );
    formData.append(
      "agent_responsable_matricule",
      this.formData.agent_responsable_matricule || "",
    );
    formData.append(
      "agent_responsable_telephone",
      this.formData.agent_responsable_telephone || "",
    );
    formData.append(
      "statut_operationnel",
      this.formData.statut_operationnel || "Actif",
    );
    formData.append(
      "infrastructure_quai",
      this.formData.infrastructure_quai ? "true" : "false",
    );
    formData.append(
      "infrastructure_chambre_froide",
      this.formData.infrastructure_chambre_froide ? "true" : "false",
    );
    formData.append(
      "infrastructure_glace",
      this.formData.infrastructure_glace ? "true" : "false",
    );
    formData.append(
      "infrastructure_marche",
      this.formData.infrastructure_marche ? "true" : "false",
    );
    formData.append(
      "infrastructure_carburant",
      this.formData.infrastructure_carburant ? "true" : "false",
    );
    formData.append(
      "infrastructure_eau",
      this.formData.infrastructure_eau ? "true" : "false",
    );
    formData.append(
      "infrastructure_electricite",
      this.formData.infrastructure_electricite ? "true" : "false",
    );

    if (this.formData.photo) {
      formData.append("photo", this.formData.photo);
    }
    if (this.isEditMode && this.debarcadereId) {
      return this.debarcadereService
        .updateDebarcadereWithPhoto(this.debarcadereId, formData)
        .subscribe({
          next: (response) => {
            M.toast({
              html: "Débarcadère mis à jour avec succès",
              classes: "green",
            });
            this.router.navigate(["/debarcaderes", response.id]);
          },
          error: (error) => {
            console.error("Erreur lors de la mise à jour:", error);
            M.toast({ html: "Erreur lors de la mise à jour", classes: "red" });
          },
        });
    } else {
      return this.debarcadereService
        .createDebarcadereWithPhoto(formData)
        .subscribe({
          next: (response) => {
            M.toast({
              html: "Débarcadère créé avec succès",
              classes: "green",
            });
            this.router.navigate(["/debarcaderes", response.id]);
          },
          error: (error) => {
            console.error("Erreur lors de la création:", error);
            M.toast({ html: "Erreur lors de la création", classes: "red" });
          },
        });
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

  onPhotoSelected(file: File) {
    this.formData.photo = file;
    console.log("Photo sélectionnée:", file.name, file.size);
  }

  onPhotoRemoved() {
    this.formData.photo = null;
    console.log("Photo supprimée");
  }
}
