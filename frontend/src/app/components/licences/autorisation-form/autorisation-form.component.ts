import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { BateauService } from "../../../services/bateau.service";
import { EspeceService } from "../../../services/espece.service";
import { LicencesAutorisationsService } from "../../../services/licences-autorisations.service";
import { AutorisationPechePdfService } from "../../../services/autorisation-pdf.service";
import { ImageHelperService } from "../../../services/image-helper.service";
import { Router, RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
declare var M: any;

@Component({
  selector: "app-autorisation-form",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./autorisation-form.component.html",
  styleUrl: "./autorisation-form.component.scss",
})
export class AutorisationFormComponent {
  @Input() type_peche: any | undefined;
  @Input() data: any | undefined;
  @Input() isEdit: boolean = false;
  @Output() formChange = new EventEmitter<any>();
  @ViewChild("selectPirogue") selectPirogue!: ElementRef;
  @ViewChild("selectEspece1") selectEspece1!: ElementRef;
  @ViewChild("selectEspece2") selectEspece2!: ElementRef;
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
    autres_especes: null,
    pour_ordre: false,
    signataire: {
      contact_email: "",
      contact_telephone: "",
      id: null,
      is_actif: true,
      nom_complet: "",
      organisme: "",
      role: { nom_role: "", abbreviation: "", description: "", id: null },
      role_id: null,
    },
    signataire_id: null,
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
    this.loadEspeces();
    this.loadPirogues();
    this.loadSignataires();
  }

  ngOnInit() {
    this.loadPirogues();
    this.loadEspeces();
    this.loadSignataires();

    setTimeout(() => {
      if (this.isEdit) {
        // console.log(this.data);
        this.autorisation = { ...this.data };
        this.autorisation.signataire = { ...this.data.signataire_info };
        this.autorisation.signataire_id = this.data.signataire_id;
        this.emit();
        // console.log(this.autorisation);
        // this.emit();
      } else {
        this.getMainSignataire();
      }
    }, 500);

    // setTimeout(() => {
    //   this.initializeMaterialize();
    // }, 500);
  }

  ngAfterViewInit(): void {
    //Called after ngAfterContentInit when the component's view has been initialized. Applies to components only.
    //Add 'implements AfterViewInit' to the class.

    if (!this.selectPirogue?.nativeElement) return;
    // if (!this.selectPecheur?.nativeElement) return;

    const element = this.selectPirogue.nativeElement;
    // const element1 = this.selectPecheur.nativeElement;

    // ✅ 1. Vérifier Materialize chargé
    if (!M?.FormSelect) {
      console.error("Materialize not loaded");
      return;
    }

    // ✅ 2. Initialiser
    M.FormSelect.init(element);
    // M.FormSelect.init(element1);

    // ✅ 3. Délai important!
    setTimeout(() => {
      const instance = M.FormSelect.getInstance(element);
      // const instance1 = M.FormSelect.getInstance(element1);
      if (instance) {
        console.log("✅ instance 1 initialise");
      }
    }, 100); // ✅ 100ms est important!
  }

  initSignataireObject() {
    return {
      contact_email: "",
      contact_telephone: "",
      id: null,
      is_actif: true,
      nom_complet: "",
      organisme: "",
      role: { nom_role: "", abbreviation: "", description: "", id: null },
      role_id: null,
    };
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

  getMainSignataire() {
    const filter = {
      status: true,
      role: "Ministre",
    };
    this.licencesAutorisationsService.getSignataireByRole(filter).subscribe({
      next: (data) => {
        this.autorisation.signataire = data;
        this.autorisation.signataire_id = data.id;
        this.emit();
      },
      error: (error) => {
        M.toast({ html: "Signataire non trouvé", classes: "red" });
      },
    });
  }

  loadPirogues() {
    this.pirogueService.getBateauxDropdown().subscribe(
      (data) => {
        this.pirogues = data;
        setTimeout(() => {
          M.FormSelect.init(this.selectPirogue?.nativeElement);
          this.addSearchBox(
            this.selectPirogue?.nativeElement,
            "select_pirogue",
          );
        }, 1500);
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
          M.FormSelect.init(this.selectEspece1?.nativeElement);
          this.addSearchBox(
            this.selectEspece1?.nativeElement,
            "select_espece1",
          );
        }, 1500);
        setTimeout(() => {
          M.FormSelect.init(this.selectEspece2?.nativeElement);
          this.addSearchBox(
            this.selectEspece2?.nativeElement,
            "select_espece2",
          );
        }, 1500);
      },
      (error) => {
        console.error("Error fetching species:", error);
      },
    );
  }

  loadSignataires() {
    const filter = {
      status: true,
      exclure_ministre: true,
    };
    this.licencesAutorisationsService.getSignataires(filter).subscribe(
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

  onSelectDateExpiration(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    // console.log(value);
    const arrayDate = value.split("-");
    this.autorisation.annee_validite = arrayDate[0];
    this.emit();
  }

  onChangeEmbarcation(e: Event) {
    const value = (e.target as HTMLSelectElement).value;

    this.pirogueService.getBateau(+value).subscribe(
      (data) => {
        // this.bateau = data;

        this.autorisation.pecheur_id = data.proprietaire_pecheur_id || null;
        // console.log(this.autorisation);
        this.emit();
        this.loadEspeces();
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
      this.autorisation.signataire = this.initSignataireObject();
      this.emit();
      // setTimeout(() => {
      //   this.initializeMaterialize();
      // }, 500);
    } else {
      this.autorisation.pour_ordre = false;
      this.getMainSignataire();
    }
  }

  selectedSignataire(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    this.licencesAutorisationsService.getSignataire(+value).subscribe({
      next: (data) => {
        // console.log(data);
        this.autorisation.signataire = data;
        this.emit();
      },
      error: (error) => {
        M.toast({ html: "Signataire non trouvé", classes: "red" });
      },
    });
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

  addSearchBox(element: HTMLSelectElement, id_select: string) {
    if (!element) return;

    const instance2 = M.FormSelect.getInstance(element);
    if (!instance2) return;

    // Get the dropdown UL directly from the instance — version-safe-ish
    const dropdownContent: HTMLElement =
      instance2.dropdown?.dropdownEl ||
      instance2.dropdownEl || // some versions expose it directly on the instance
      null;

    if (!dropdownContent) {
      console.warn("Could not resolve dropdownEl for", id_select);
      return;
    }

    // Avoid inserting duplicate search inputs on repeated calls
    const existing = dropdownContent.querySelector(".search-input");
    if (existing) existing.remove();

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Rechercher...";
    searchInput.classList.add("browser-default", "search-input");
    searchInput.style.margin = "8px";
    searchInput.style.width = "90%";
    searchInput.style.boxSizing = "border-box";

    ["mousedown", "click"].forEach((evt) => {
      searchInput.addEventListener(evt, (event) => {
        event.stopPropagation();
        event.preventDefault();
      });
    });

    dropdownContent.insertBefore(searchInput, dropdownContent.firstChild);

    searchInput.addEventListener("keyup", () => {
      const filter = searchInput.value.toLowerCase();
      const items = dropdownContent.querySelectorAll("li > span");
      items.forEach((item: any) => {
        const text = item.textContent.toLowerCase();
        (item.parentElement as HTMLElement).style.display = text.includes(
          filter,
        )
          ? ""
          : "none";
      });
    });

    const instance = M.FormSelect.getInstance(element);
    if (instance && instance.dropdown) {
      instance.dropdown.options.onOpenStart = () => {
        searchInput.value = "";
        dropdownContent.querySelectorAll("li").forEach((li: HTMLElement) => {
          li.style.display = "";
        });
        setTimeout(() => searchInput.focus(), 200);
      };
    }
  }

  // ✅ Get today as string YYYY-MM-DD
  private getTodayString(): string {
    const today = new Date();
    return today.toISOString().split("T")[0]; // ✅ Returns "2025-06-28"
  }

  async onSubmit() {
    // console.log("Autorisation soumise:", this.autorisation);
    const logoBase64 = await this.imageHelper.getBase64ImageFromURL(
      "../../../assets/logo.jpg",
    );

    let signataire = {
      licence_id: null,
      signataire_id: null,
      date_signature: "",
      remarques: "",
    };

    if (this.isEdit) {
      // console.log("Mise à jour de l'autorisation:", this.autorisation);
      this.licencesAutorisationsService
        .updateLicence(this.data.id, this.autorisation)
        .subscribe({
          next: (data) => {
            // console.log(data);
            signataire.licence_id = data.id;
            signataire.signataire_id = this.autorisation.signataire.id;
            signataire.date_signature = this.dateGabon();
            signataire.remarques = "Document signé en PO";

            if (data) {
              this.licencesAutorisationsService
                .setSignataireLicence(signataire)
                .subscribe({
                  next: (data) => {
                    // console.log(data);
                    M.toast({
                      html: "Autorisation mise à jour avec succès",
                      classes: "green",
                    });
                    this.router.navigate(["/licences"]);
                  },
                  error: (error) => {
                    console.error(error);
                    M.toast({
                      html: "Erreur lors de la mise à jour de l'autorisation",
                      classes: "red",
                    });
                  },
                });
            }
          },
          error: (error) => {
            console.error(error);
            M.toast({
              html: "Erreur lors de la mise à jour de l'autorisation",
              classes: "red",
            });
          },
        });
    } else {
      this.licencesAutorisationsService
        .createLicence(this.autorisation)
        .subscribe({
          next: (data) => {
            console.log(data);
            signataire.licence_id = data.id;
            signataire.signataire_id = this.autorisation.signataire.id;
            signataire.date_signature = this.dateGabon();
            signataire.remarques = "Document signé en PO";

            if (data) {
              this.licencesAutorisationsService
                .setSignataireLicence(signataire)
                .subscribe({
                  next: (response) => {
                    // console.log("Réponse du serveur:", response);
                    M.toast({
                      html: `L'autorisation de peche créé avec succès`,
                      classes: "green",
                    });
                    this.router.navigate(["/licences"]);
                    this.pdf.open({
                      numero: data.numero_licence,
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
                        debarcadereAttache:
                          data.bateau_info.site_port_attache.nom,
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
                        typePiece:
                          data.proprietaire_info.type_piece_identite || "N/A",
                        numeroPiece:
                          data.proprietaire_info.numero_piece_identite || "N/A",
                        residence: data.proprietaire_info.adresse || "N/A",
                        telephone: data.proprietaire_info.telephone || "N/A",
                        cooperative:
                          data.bateau_info.cooperative.denomination || "N/A",
                      },
                      engins: {
                        engin1: data.bateau_info.engin_peche_principal
                          ? data.bateau_info.engin_peche_principal.libelle
                          : "N/A",
                        especes1:
                          Array.isArray(data.espece1) && data.espece1.length
                            ? data.espece1
                                .map((e: any) => e.nom_commun)
                                .join(", ")
                            : "N/A",

                        engin2: data.bateau_info.engin_peche_secondaire
                          ? data.bateau_info.engin_peche_secondaire
                              .map((e: any) => e.libelle)
                              .join(", ")
                          : "N/A",
                        especes2:
                          Array.isArray(data.espece2) && data.espece2.length
                            ? data.espece2
                                .map((e: any) => e.nom_commun)
                                .join(", ")
                            : "N/A",
                        codeBarre: "SIGDP-AUTH-452-2026",
                      },
                      periodeDebut: data.date_debut
                        ? new Date(data.date_debut).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            },
                          )
                        : "N/A",
                      periodeFin: data.date_expiration
                        ? new Date(data.date_expiration).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            },
                          )
                        : "N/A",
                      montantFcfa: data.montant_paye,
                      quittanceTresor: data.reference_paiement,
                      faitA: "Libreville",
                      dateFait: data.date_emission
                        ? new Date(data.date_emission).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            },
                          )
                        : "N/A",
                      signataire: data.signataire_info.nom_complet,
                      role_signataire: data.signataire_info.role.nom_role,
                      pour_ordre: data.pour_ordre,
                      logoBase64: logoBase64,
                    });
                  },
                  error: (error) => {
                    console.error("Erreur:", error.error.detail || error);

                    M.toast({
                      html: `Erreur d'attribution de la signature`,
                      classes: "red",
                    });
                  },
                });
            }
          },
          error: (error) => {
            console.error("Error saving data:", error);
            M.toast({
              html: `Echec d'enregistrement de l'autorisation de peche`,
              classes: "red",
            });
          },
        });
    }
  }
}
