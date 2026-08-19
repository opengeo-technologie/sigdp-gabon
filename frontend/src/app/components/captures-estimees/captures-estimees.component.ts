// SIGPA — Module « Captures estimées »
// Composant standalone Angular 19 : liste filtrable + CRUD (modale Materialize)
//   + import Excel + export multi-format.
// Prérequis : Materialize CSS/JS chargés globalement (M.*).

import { CommonModule } from "@angular/common";
import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import {
  CaptureCreate,
  CaptureEstimee,
  CaptureFiltre,
  Engin,
  Espece,
  FormatExport,
  ImportResultat,
  MOIS_LIBELLES,
} from "../../models/capture-estimee.model";
import { CapturesEstimeeService } from "../../services/captures-estimee.service";
import { RouterLink, RouterModule } from "@angular/router";
import { AuthService } from "../../services/auth.service";
import { StratesService } from "../../services/strates.service";

declare const M: any;

@Component({
  selector: "app-captures-estimees",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterModule],
  templateUrl: "./captures-estimees.component.html",
  styleUrl: "./captures-estimees.component.scss",
})
export class CapturesEstimeesComponent {
  @ViewChild("selEngin") selEngin!: ElementRef;
  @ViewChild("selEspece") selEspece!: ElementRef;
  @ViewChild("selStrateMineure") selStrateMineure!: ElementRef;
  @ViewChild("mEngin") mEngin!: ElementRef;
  @ViewChild("mEspece") mEspece!: ElementRef;
  @ViewChild("mStrateMineure") mStrateMineure!: ElementRef;

  private svc = inject(CapturesEstimeeService);
  private permissionService = inject(AuthService);
  private strateService = inject(StratesService);

  mois = MOIS_LIBELLES;
  engins: Engin[] = [];
  especes: any[] = [];
  provinces: any[] = [];
  localite: any[] = [];
  filteredlocalites: any[] = [];

  elements: CaptureEstimee[] = [];
  efforts: any[] = [];
  total = 0;
  chargement = false;

  filtre: CaptureFiltre = {
    annee: new Date().getFullYear() - 2,
    mois: null,
    engin_id: null,
    espece_id: null,
    strate_mineure_id: null,
    groupe: null,
    inclure_agrege: false,
    page: 1,
    taille_page: 25,
    tri: "annee,mois",
  };

  filtreEffort: CaptureFiltre = {
    annee: new Date().getFullYear() - 2,
    mois: null,
    engin_id: null,
    strate_mineure_id: null,
    page: 1,
    taille_page: 25,
    tri: "annee,mois",
  };

  strate_majeure_id: number | null = null;
  strate_mineure_id: number | null = null;

  form: CaptureCreate = this.formVide();
  enEdition = false;
  editionId: number | null = null;
  erreur = "";
  resultatImport: ImportResultat | null = null;

  isLoadingModal: any = false;

  showListCaptures = true;

  private modaleInst: any;

  ngOnInit(): void {
    this.svc.listerEngins().subscribe((e) => {
      this.engins = e;
      setTimeout(() => {
        M.FormSelect.init(this.selEngin?.nativeElement);
        this.addSearchBox(this.selEngin?.nativeElement, "engin_id");
      }, 1000);
      // this.majSelects();
    });
    this.svc.listerEspeces().subscribe((s) => {
      // console.log("Espèces chargées :", s);
      this.especes = s;
      setTimeout(() => {
        M.FormSelect.init(this.selEspece?.nativeElement);
        this.addSearchBox(this.selEspece?.nativeElement, "espece_id");
      }, 1000);
      // this.majSelects();
    });
    this.strateService.getStratesMajeures().subscribe((s) => {
      // console.log("Espèces chargées :", s);
      this.provinces = s;
      // this.majSelects();
    });
    this.strateService.getStratesMineures().subscribe((s) => {
      // console.log("Espèces chargées :", s);
      this.localite = s;
      setTimeout(() => {
        M.FormSelect.init(this.selStrateMineure?.nativeElement);
        this.addSearchBox(
          this.selStrateMineure?.nativeElement,
          "strate_mineure_id",
        );
      }, 1000);
      // this.majSelects();
    });
    this.recharger();
    this.rechargerEfforts();
    setTimeout(() => this.initModale(), 0);
  }

  // ngAfterViewInit(): void {
  //   if (!this.selEngin?.nativeElement) return;

  //   const element = this.selEngin.nativeElement;

  //   // ✅ 1. Vérifier Materialize chargé
  //   if (!M?.FormSelect) {
  //     console.error("Materialize not loaded");
  //     return;
  //   }

  //   // ✅ 2. Initialiser
  //   M.FormSelect.init(element);

  //   // ✅ 3. Délai important!
  //   setTimeout(() => {
  //     const instance = M.FormSelect.getInstance(element);

  //     if (instance) {
  //       console.log("✅ Ready!");
  //       // Utiliser instance
  //     }
  //   }, 100); // ✅ 100ms est important!
  // }

  hasPermission(permission: string): boolean {
    return this.permissionService.hasPermission(permission);
  }

  get nbPages(): number {
    return Math.max(1, Math.ceil(this.total / this.filtre.taille_page));
  }

  recharger(): void {
    this.chargement = true;
    this.filtre.page = 1;
    this.charger();
  }

  rechargerEfforts(): void {
    this.chargerEfforts();
  }

  private charger(): void {
    this.svc.lister(this.filtre).subscribe({
      next: (r) => {
        // console.log("Captures chargées :", r.elements.length, "éléments");
        // console.log("Captures chargées :", r.elements);
        this.elements = r.elements;
        this.total = r.total;
        this.chargement = false;
      },
      error: () => {
        this.chargement = false;
        this.toast("Erreur de chargement.", true);
      },
    });
  }

  private chargerEfforts(): void {
    this.svc.listerEfforts(this.filtreEffort).subscribe({
      next: (r) => {
        // console.log("Efforts chargés :", r);
        this.efforts = r;
      },
      error: () => {
        this.toast("Erreur de chargement.", true);
      },
    });
  }

  trier(col: string): void {
    this.filtre.tri =
      this.filtre.tri.startsWith(col) && !this.filtre.tri.startsWith("-" + col)
        ? "-" + col
        : col;
    this.charger();
  }
  pagePrec(): void {
    if (this.filtre.page > 1) {
      this.filtre.page--;
      this.charger();
    }
  }
  pageSuiv(): void {
    if (this.filtre.page < this.nbPages) {
      this.filtre.page++;
      this.charger();
    }
  }

  // -- Ajouter la recherche rapide dans les dropdowns Materialize (ex. engins, espèces, strates)
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

  // -- CRUD
  ouvrirCreation(): void {
    this.enEdition = false;
    this.editionId = null;
    this.erreur = "";
    this.form = this.formVide();
    this.isLoadingModal = true;
    this.ouvrirModale();
  }
  ouvrirEdition(c: CaptureEstimee): void {
    this.enEdition = true;
    this.editionId = c.id;
    this.erreur = "";
    this.filteredlocalites = this.localite;
    this.strate_majeure_id =
      this.localite.find((l) => l.id === c.strate_mineure_id)
        ?.strate_majeure_id ?? null;
    this.form = {
      annee: c.annee,
      mois: c.mois,
      engin_id: c.engin_id,
      espece_id: c.espece_id,
      strate_mineure_id: c.strate_mineure_id ?? 0,
      capture_kg: c.capture_kg.toFixed(3) as unknown as number,
      valeur_fcfa: (c.valeur_fcfa / c.capture_kg).toFixed(
        3,
      ) as unknown as number, // valeur unitaire
    };
    this.ouvrirModale();
  }
  enregistrer(): void {
    this.erreur = "";
    this.form.valeur_fcfa = this.form.valeur_fcfa * this.form.capture_kg; // calculer la valeur totale
    const obs =
      this.enEdition && this.editionId != null
        ? this.svc.modifier(this.editionId, {
            capture_kg: this.form.capture_kg,
            valeur_fcfa: this.form.valeur_fcfa,
          })
        : this.svc.creer(this.form);
    obs.subscribe({
      next: () => {
        this.modaleInst?.close();
        this.charger();
        this.toast("Capture de peche estimée enregistrée.");
        this.form = this.formVide();
      },
      error: (err) => {
        this.erreur = err?.error?.detail ?? "Enregistrement impossible.";
      },
    });
  }
  supprimer(c: CaptureEstimee): void {
    if (
      !confirm(
        `Supprimer la capture ${c.espece_nom} — ${c.engin_libelle} — ${c.mois_libelle} ${c.annee} ?`,
      )
    )
      return;
    this.svc.supprimer(c.id).subscribe(() => {
      this.charger();
      this.toast("Supprimé.");
    });
  }

  // -- Import / Export
  declencherImport(): void {
    (document.querySelector("input[type=file]") as HTMLInputElement)?.click();
  }

  importer(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    if (!f) return;
    const annee = this.filtre.annee ?? new Date().getFullYear();
    this.toast("Import en cours…");
    this.svc.importerExcel(f, annee).subscribe({
      next: (r) => {
        this.resultatImport = r;
        this.charger();
        input.value = "";
      },
      error: (err) => {
        this.toast(err?.error?.detail ?? "Import impossible.", true);
        input.value = "";
      },
    });
  }
  exporter(format: FormatExport): void {
    this.svc.exporter(format, this.filtre).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `captures_estimees.${format === "excel" ? "xlsx" : format}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // -- Helpers UI
  libelleGroupe(g?: string | null): string {
    return (
      {
        PELAGIQUE: "Pélagiques",
        DEMERSAL: "Démersaux",
        CRUSTACE: "Crustacés",
      }[g ?? ""] ?? "—"
    );
  }
  couleurGroupe(g?: string | null): string {
    return (
      {
        PELAGIQUE: "blue lighten-4",
        DEMERSAL: "teal lighten-4",
        CRUSTACE: "orange lighten-4",
      }[g ?? ""] ?? "grey lighten-3"
    );
  }

  private formVide(): CaptureCreate {
    return {
      annee: this.filtre.annee ?? new Date().getFullYear(),
      mois: 1,
      engin_id: this.engins[0]?.id ?? 0,
      espece_id: this.especes[0]?.id ?? 0,
      strate_mineure_id: this.filteredlocalites[0]?.id ?? 0,
      capture_kg: 0,
      valeur_fcfa: 0,
    };
  }
  private initModale(): void {
    const el = document.getElementById("modaleCapture");
    if (el && el.parentElement !== document.body) document.body.appendChild(el); // fix z-index
    this.modaleInst = M.Modal.init(el, { dismissible: true });
  }
  private ouvrirModale(): void {
    setTimeout(() => {
      // this.majSelects();
      setTimeout(() => {
        M.FormSelect.init(this.mEspece?.nativeElement);
        this.addSearchBox(this.mEspece?.nativeElement, "mEspece");
      }, 500);
      setTimeout(() => {
        M.FormSelect.init(this.mEngin?.nativeElement);
        this.addSearchBox(this.mEngin?.nativeElement, "mEngin");
      }, 500);
      setTimeout(() => {
        M.FormSelect.init(this.mStrateMineure?.nativeElement);
        this.addSearchBox(this.mStrateMineure?.nativeElement, "mStrateMineure");
      }, 500);
      setTimeout(() => {
        this.modaleInst?.open();
        this.isLoadingModal = false;
      }, 1000);
    }, 0);
  }

  selectStrateMajeure(): void {
    this.filteredlocalites = this.localite.filter(
      (l) => l.strate_majeure_id === this.strate_majeure_id,
    );
    setTimeout(() => {
      M.FormSelect.init(this.mStrateMineure?.nativeElement);
      this.addSearchBox(this.mStrateMineure?.nativeElement, "mStrateMineure");
    }, 500);
  }

  private majSelects(): void {
    setTimeout(() => M.FormSelect.init(document.querySelectorAll("select")), 0);
  }
  private toast(msg: string, erreur = false): void {
    M.toast({ html: msg, classes: erreur ? "red" : "green" });
  }

  changeTab() {
    this.showListCaptures = !this.showListCaptures;
  }
}
