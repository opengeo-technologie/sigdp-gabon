import { ChangeDetectorRef, Component } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { ArmementCooperativeService } from "../../../services/armement-cooperative.service";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

declare var M: any;

@Component({
  selector: "app-armement-cooperative-form",
  imports: [CommonModule, FormsModule],
  templateUrl: "./armement-cooperative-form.component.html",
  styleUrl: "./armement-cooperative-form.component.scss",
})
export class ArmementCooperativeFormComponent {
  data: any = {
    code: "GA-ARM-001",
    denomination: "",
    type_association: "",
    sigle: "",
    siege: "",
    date_creation: "",
    adresse: "",
    telephone: "",
    email: "",
    province: "",
    departement: "",
    localite: "",
  };
  isEditMode = false;
  dataId: number | null = null;
  loading = false;

  constructor(
    private armementCooperativeService: ArmementCooperativeService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    // Vérifier si mode édition
    this.route.params.subscribe((params) => {
      if (params["id"]) {
        this.isEditMode = true;
        this.dataId = +params["id"];
        this.loadArmementCooperative(this.dataId);
      }
    });

    // Initialiser Materialize
    setTimeout(() => {
      this.initializeMaterialize();
    }, 100);
  }

  initializeMaterialize() {
    if (typeof M !== "undefined") {
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.Datepicker.init(document.querySelectorAll(".datepicker"), {
        format: "yyyy-mm-dd",
        autoClose: true,
      });
      M.updateTextFields();
    }
  }

  loadArmementCooperative(id: number) {
    this.loading = true;
    this.armementCooperativeService.getArmementCooperative(id).subscribe({
      next: (data) => {
        // Pré-remplir le formulaire avec les données récupérées
        // console.log("Données récupérées:", data);
        data.date_creation = data.date_creation
          ? data.date_creation.split("T")[0]
          : ""; // Formater la date pour le datepicker
        this.data = data;
        this.cdr.detectChanges(); // Forcer la détection de changement pour mettre à jour le formulaire
      },
      error: (error) => {
        console.error(
          "Erreur lors du chargement de l'armement/coopérative:",
          error,
        );
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  onSubmit() {
    // Préparer les données à envoyer
    const payload = {
      // code: this.formData.code,
      // denomination: this.formData.denomination,
    };

    if (this.isEditMode && this.dataId) {
      // Mettre à jour
      this.armementCooperativeService
        .updateArmementCooperative(this.dataId, this.data)
        .subscribe({
          next: (response) => {
            M.toast({
              html: "Armement/coopérative mis à jour avec succès",
              classes: "green",
            });
            this.router.navigate(["/armements-cooperatives", response.id]);
          },
          error: (error) => {
            console.error("Erreur lors de la mise à jour:", error);
            M.toast({ html: "Erreur lors de la mise à jour", classes: "red" });
          },
        });
    } else {
      // Créer
      this.armementCooperativeService
        .createArmementCooperative(this.data)
        .subscribe({
          next: (result) => {
            M.toast({
              html: "Armement/coopérative créé avec succès",
              classes: "green",
            });
            this.router.navigate(["/armements-cooperatives", result.id]);
          },
          error: (error) => {
            console.error("Erreur lors de la création:", error);
            M.toast({ html: "Erreur lors de la création", classes: "red" });
          },
        });
    }
  }
}
