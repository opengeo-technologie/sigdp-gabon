import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
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
  @ViewChild("selectSite") selectSite!: ElementRef;
  @ViewChild("selectPecheur") selectPecheur!: ElementRef;
  @ViewChild("selectBateau") selectBateau!: ElementRef;
  submitting = false;
  debarcaderes: Debarcadere[] = [];
  pecheurs: Pecheur[] = [];
  bateaux: Bateau[] = [];
  filterdPecheurs: Pecheur[] = [];
  filteredBateax: Bateau[] = [];
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
  ngAfterViewInit(): void {
    //Called after ngAfterContentInit when the component's view has been initialized. Applies to components only.
    //Add 'implements AfterViewInit' to the class.
    if (!this.selectSite?.nativeElement) return;
    if (!this.selectPecheur?.nativeElement) return;

    const element = this.selectSite.nativeElement;
    const element1 = this.selectPecheur.nativeElement;

    // ✅ 1. Vérifier Materialize chargé
    if (!M?.FormSelect) {
      console.error("Materialize not loaded");
      return;
    }

    // ✅ 2. Initialiser
    M.FormSelect.init(element);
    M.FormSelect.init(element1);

    // ✅ 3. Délai important!
    setTimeout(() => {
      const instance = M.FormSelect.getInstance(element);
      const instance1 = M.FormSelect.getInstance(element1);
    }, 100); // ✅ 100ms est important!
  }

  loadData() {
    this.debarcadereService.getDebarcaderes().subscribe((data) => {
      // console.log("Debarcaderes:", data);
      this.debarcaderes = data.result;
      // setTimeout(() => this.initMaterialize(), 500);
      setTimeout(() => {
        M.FormSelect.init(this.selectSite?.nativeElement);
        this.addSearchBox(this.selectSite?.nativeElement, "select_debarcadere");
      }, 500);
    });
    this.pecheurService.getPecheurs().subscribe((data) => {
      // console.log("Pecheurs:", data);
      this.pecheurs = data;
      this.filterdPecheurs = data;
      // setTimeout(() => this.initMaterialize(), 500);
      setTimeout(() => {
        M.FormSelect.init(this.selectPecheur?.nativeElement);
        this.addSearchBox(this.selectPecheur?.nativeElement, "select_pecheur");
      }, 500);
    });
    this.bateauService.getBateaux().subscribe((data) => {
      // console.log("Bateaux:", data);
      this.bateaux = data;
      this.bateauxFiltered = data;
      // setTimeout(() => this.initMaterialize(), 500);
      setTimeout(() => {
        M.FormSelect.init(this.selectBateau?.nativeElement);
        this.addSearchBox(this.selectBateau?.nativeElement, "select_pecheur");
      }, 500);
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
            setTimeout(() => {
              M.FormSelect.init(this.selectBateau?.nativeElement);
              this.addSearchBox(
                this.selectBateau?.nativeElement,
                "select_pecheur",
              );
            }, 500);
            // setTimeout(() => this.initMaterialize(), 50);
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

  // addSearchBox(element: any, id_select: any) {
  //   const dropdownContent = document.querySelector(
  //     ".select-dropdown.dropdown-content",
  //   ) as HTMLElement;
  //   if (!dropdownContent) return;

  //   const searchInput = document.createElement("input");
  //   searchInput.type = "text";
  //   searchInput.placeholder = "Rechercher...";
  //   searchInput.classList.add("browser-default", "search-input");
  //   searchInput.style.margin = "8px";
  //   searchInput.style.width = "90%";

  //   //// --- Prevent dropdown from closing ---
  //   // Handle both mousedown and click (Materialize listens to both)
  //   ["mousedown", "click"].forEach((evt) => {
  //     searchInput.addEventListener(evt, (event) => {
  //       event.stopPropagation();
  //       event.preventDefault();
  //     });
  //   });

  //   dropdownContent.insertBefore(searchInput, dropdownContent.firstChild);

  //   // Filter options
  //   searchInput.addEventListener("keyup", () => {
  //     const filter = searchInput.value.toLowerCase();
  //     const items = dropdownContent.querySelectorAll("li > span");
  //     items.forEach((item: any) => {
  //       const text = item.textContent.toLowerCase();
  //       (item.parentElement as HTMLElement).style.display = text.includes(
  //         filter,
  //       )
  //         ? ""
  //         : "none";
  //     });
  //   });
  //   // --- Focus automatically when dropdown opens ---
  //   const selectInput = element;
  //   const instance = M.FormSelect.getInstance(selectInput);

  //   if (instance && instance.dropdown) {
  //     instance.dropdown.options.onOpenStart = () => {
  //       setTimeout(() => searchInput.focus(), 200);
  //     };
  //   }
  // }
}
