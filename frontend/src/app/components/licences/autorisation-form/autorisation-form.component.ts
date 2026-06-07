import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BateauService } from "../../../services/bateau.service";
import { EspeceService } from "../../../services/espece.service";
import { LicencesAutorisationsService } from "../../../services/licences-autorisations.service";
import { AutorisationPechePdfService } from "../../../services/autorisation-pdf.service";
import { ImageHelperService } from "../../../services/image-helper.service";
import { Router } from "@angular/router";
declare var M: any;

@Component({
  selector: "app-autorisation-form",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./autorisation-form.component.html",
  styleUrl: "./autorisation-form.component.scss",
})
export class AutorisationFormComponent {
  @Input() type_peche: any | undefined;
  @Output() formChange = new EventEmitter<any>();
  pirogues: any[] = [];
  especes: any[] = [];
  signataires: any[] = [];
  years: number[] = [];

  espece_cible1: any = "";
  espece_cible2: any = "";

  visa1: any = "";
  visa2: any = "";
  signataire: any = "";
  isGeneratingPdf: boolean = false;

  autorisation = {
    // numero_licence: "1200",
    type_licence: "Artisanale",
    annee_validite: "",
    pecheur_id: null as number | null,
    date_debut: null,
    date_expiration: null,
    date_emission: this.dateGabon(),
    bateau_id: "",
    montant_paye: 0,
    mode_paiement: "Quittance trésor",
    reference_paiement: null,
    types_peche_autorises: null,
    especes_autorisees: null,
    pour_ordre: false,
    signataire: null,
    espece_cible1: null,
    espece_cible2: null,
    visa1: null,
    visa2: null,
    autorite_emission:
      "Ministère de la Mer, de la Pêche et de l'Économie Bleue",
  };

  constructor(
    private pirogueService: BateauService,
    private especeService: EspeceService,
    private licencesAutorisationsService: LicencesAutorisationsService,
    private pdf: AutorisationPechePdfService,
    private imageHelper: ImageHelperService,
    private router: Router,
  ) {
    const currentYear = new Date().getFullYear();
    const startYear = 2020; // année de début pour les licences
    this.years = Array.from(
      { length: currentYear - startYear + 1 },
      (_, i) => currentYear - i, // ordre décroissant
    );
  }

  dateGabon(): string {
    return new Intl.DateTimeFormat("fr-CA", {
      timeZone: "Africa/Libreville",
    }).format(new Date()); // "2026-06-06" (fr-CA donne le format ISO)
  }

  emit() {
    // emit a copy so the parent can't mutate the child's state
    this.formChange.emit({ ...this.autorisation });
  }

  ngOnInit() {
    this.loadPirogues();
    this.loadEspeces();
    this.loadSignataires();
    this.initializeMaterialize();
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

  loadPirogues() {
    this.pirogueService.getBateaux().subscribe(
      (data) => {
        this.pirogues = data;
        setTimeout(() => {
          this.initializeMaterialize();
        }, 500);
      },
      (error) => {
        console.error("Error fetching pirogues:", error);
      },
    );
  }

  loadEspeces() {
    this.especeService.getEspeces().subscribe(
      (data) => {
        // Traitez les données des espèces ici
        // console.log("Espèces chargées:", data);
        this.especes = data;
        setTimeout(() => {
          this.initializeMaterialize();
        }, 500);
      },
      (error) => {
        console.error("Error fetching species:", error);
      },
    );
  }

  loadSignataires() {
    this.licencesAutorisationsService.getSignataires().subscribe(
      (data) => {
        // Traitez les données des signataires ici
        // console.log("Signataires chargés:", data);
        this.signataires = data;
        setTimeout(() => {
          this.initializeMaterialize();
        }, 500);
      },
      (error) => {
        console.error("Error fetching signataires:", error);
      },
    );
  }

  onChangeEmbarcation(e: Event) {
    const value = (e.target as HTMLSelectElement).value;

    this.pirogueService.getBateau(+value).subscribe(
      (data) => {
        // this.bateau = data;

        this.autorisation.pecheur_id = data.proprietaire_pecheur_id || null;
        // console.log(this.autorisation);
        this.emit();
        setTimeout(() => {
          this.initializeMaterialize();
        }, 500);
      },
      (error) => {
        console.error("Error fetching pirogues:", error);
      },
    );
  }

  onCheckedPourOrdre(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.checked) {
      this.autorisation.pour_ordre = true;
      setTimeout(() => {
        this.initializeMaterialize();
      }, 500);
    } else {
      this.autorisation.pour_ordre = false;
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

  async onSubmit() {
    // console.log("Autorisation soumise:", this.autorisation);
    const logoBase64 = await this.imageHelper.getBase64ImageFromURL(
      "../../../assets/logo.jpg",
    );
    this.licencesAutorisationsService
      .createLicence(this.autorisation)
      .subscribe(
        (data) => {
          console.log(data);
          M.toast({
            html: `L'autorisation de peche créé avec succès`,
            classes: "green",
          });
          this.router.navigate(["/licences"]);
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
                data.proprietaire_info.nom +
                " " +
                data.proprietaire_info.prenom,
              nationalite: data.proprietaire_info.nationalite,
              typePiece: data.proprietaire_info.type_piece_identite || "N/A",
              numeroPiece:
                data.proprietaire_info.numero_piece_identite || "N/A",
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
        (error) => {
          console.error("Error saving data:", error);
          M.toast({
            html: `Echec d'enregistrement de l'autorisation de peche`,
            classes: "red",
          });
        },
      );
  }
}
