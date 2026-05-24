import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { RouterModule, Router, ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { PecheurService } from "../../../services/pecheur.service";
import {
  Pecheur,
  PecheurCreate,
  CategoriePecheur,
  TypePeche,
  StatutPecheur,
} from "../../../models/pecheur.model";
import { PhotoUploaderComponent } from "../photo-uploader/photo-uploader.component";

declare var M: any;

@Component({
  selector: "app-pecheur-form",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, PhotoUploaderComponent],
  templateUrl: "./pecheur-form.component.html",
  styleUrls: ["./pecheur-form.component.css"],
})
export class PecheurFormComponent implements OnInit {
  @ViewChild(PhotoUploaderComponent) photoUploader!: PhotoUploaderComponent;
  isEditMode = false;
  pecheurId?: number;

  // formData: PecheurCreate = {
  //   numero_carte: "",
  //   nom: "",
  //   prenom: "",
  //   date_naissance: "",
  //   nationalite: "Gabonaise",
  //   categorie: "" as CategoriePecheur,
  //   type_peche: "" as TypePeche,
  //   statut: "Actif" as StatutPecheur,
  //   photo: null as File | null,
  // };

  formData: PecheurCreate = {
    nom: "",
    prenom: "",
    date_naissance: "",
    telephone: "",
    nationalite: "Gabonaise",
    email: "",
    adresse: "",
    type_carte: "",
    numero_piece_identite: "",
    lieu_naissance: "",
    debarcadere_habituel_code: "",
    contact_urgence_nom: "",
    contact_urgence_telephone: "",
    contact_urgence_relation: "",
    categorie: CategoriePecheur.ARTISANAL,
    statut: StatutPecheur.ACTIF,
    photo: null,
  };

  constructor(
    private pecheurService: PecheurService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      if (params["id"]) {
        this.isEditMode = true;
        this.pecheurId = +params["id"];
        this.loadPecheur();
      }
    });

    setTimeout(() => this.initializeMaterialize(), 100);
  }

  loadPecheur() {
    if (this.pecheurId) {
      this.pecheurService.getPecheur(this.pecheurId).subscribe({
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
            html: "Erreur lors du chargement du pêcheur",
            classes: "red",
          });
        },
      });
    }
  }

  // onSubmit() {
  //   if (this.isEditMode && this.pecheurId) {
  //     this.pecheurService
  //       .updatePecheur(this.pecheurId, this.formData)
  //       .subscribe({
  //         next: () => {
  //           M.toast({
  //             html: "Pêcheur mis à jour avec succès",
  //             classes: "green",
  //           });
  //           this.router.navigate(["/pecheurs"]);
  //         },
  //         error: (error) => {
  //           console.error("Erreur lors de la mise à jour:", error);
  //           M.toast({ html: "Erreur lors de la mise à jour", classes: "red" });
  //         },
  //       });
  //   } else {
  //     const cleanData = new FormData();
  //     this.pecheurService.createPecheur(this.formData).subscribe({
  //       next: () => {
  //         M.toast({ html: "Pêcheur créé avec succès", classes: "green" });
  //         this.router.navigate(["/pecheurs"]);
  //       },
  //       error: (error) => {
  //         console.error("Erreur lors de la création:", error);
  //         M.toast({ html: "Erreur lors de la création", classes: "red" });
  //       },
  //     });
  //   }
  // }

  async savePecheur() {
    // Créer FormData pour l'upload
    const formData = new FormData();
    formData.append("numero_carte", "");
    formData.append("nom", this.formData.nom);
    formData.append("prenom", this.formData.prenom);
    formData.append(
      "date_naissance",
      this.formData.date_naissance || "2026-05-20",
    );
    formData.append("nationalite", this.formData.nationalite || "Gabonaise");
    formData.append("categorie", this.formData.categorie);
    formData.append("statut", this.formData.statut || "Actif");
    formData.append("lieu_naissance", this.formData.lieu_naissance || "");
    formData.append("telephone", this.formData.telephone || "");
    formData.append("email", this.formData.email || "");
    formData.append("adresse", this.formData.adresse || "");
    formData.append("type_carte", this.formData.type_carte || "");
    formData.append(
      "numero_piece_identite",
      this.formData.numero_piece_identite || "",
    );
    formData.append(
      "debarcadere_habituel_code",
      this.formData.debarcadere_habituel_code || "",
    );
    formData.append(
      "contact_urgence_nom",
      this.formData.contact_urgence_nom || "",
    );
    formData.append(
      "contact_urgence_telephone",
      this.formData.contact_urgence_telephone || "",
    );
    formData.append(
      "contact_urgence_relation",
      this.formData.contact_urgence_relation || "",
    );

    // Ajouter la photo si présente
    if (this.formData.photo) {
      formData.append("photo", this.formData.photo);
    }

    if (this.isEditMode && this.pecheurId) {
      this.pecheurService
        .updatePecheurWithPhoto(this.pecheurId, formData)
        .subscribe({
          next: (response) => {
            M.toast({
              html: "Pêcheur mis à jour avec succès",
              classes: "green",
            });
            this.router.navigate(["/pecheurs"]);
          },
          error: (error) => {
            console.error("Erreur lors de la mis a jour:", error);
            M.toast({ html: "Erreur lors de la  mis à jour", classes: "red" });
          },
        });
    } else {
      // Envoyer au backend
      this.pecheurService.createPecheurWithPhoto(formData).subscribe({
        next: (response) => {
          console.log("Pêcheur créé:", response);
          M.toast({ html: "Pêcheur créé avec succès", classes: "green" });
          this.router.navigate(["/pecheurs"]);
        },
        error: (error) => {
          console.error("Erreur lors de la création:", error);
          M.toast({ html: "Erreur lors de la création", classes: "red" });
        },
      });
    }
  }

  private initializeMaterialize() {
    if (typeof M !== "undefined") {
      const selects = document.querySelectorAll("select");
      M.FormSelect.init(selects, {});
    }
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
