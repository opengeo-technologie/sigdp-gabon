import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Chart } from "chart.js/auto";
import { environment } from "../../../../environments/environment";

declare const M: any; // Materialize (toast)

interface Debarcadere {
  id: number;
  nom_local: string;
}
interface LabelValeur {
  label: string;
  valeur: number;
}
interface EspeceStat {
  nom: string;
  quantite_kg: number;
  valeur_fcfa: number;
}
interface PointTemporel {
  jour: string;
  quantite_kg: number;
}

interface StatsResponse {
  date_debut: string;
  date_fin: string;
  debarcadere_nom: string | null;
  nb_debarquements: number;
  quantite_totale_kg: number;
  valeur_totale_fcfa: number;
  nb_pecheurs: number;
  duree_moyenne_h: number;
  nb_especes: number;
  par_debarcadere: LabelValeur[];
  top_especes: EspeceStat[];
  evolution: PointTemporel[];
  par_destination: LabelValeur[];
  alertes: Record<string, number>;
}

const OCEAN = "#0B4F6C";
const TEAL = "#0F7C8A";
const PALETTE = [
  "#0B4F6C",
  "#0F7C8A",
  "#2A9D8F",
  "#E9C46A",
  "#F4A261",
  "#E76F51",
  "#8AB17D",
];

@Component({
  selector: "app-debarquement-stats",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./debarquement-stats.component.html",
})
export class DebarquementStatsComponent implements OnInit, OnDestroy {
  @ViewChild("selectSite") selectSite!: ElementRef;
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl; // '/api' en production

  // --- Formulaire (signals) ------------------------------------------------
  readonly dateDebut = signal<string>(this.premierJourDuMois());
  readonly dateFin = signal<string>(this.aujourdHui());
  readonly debarcadereId = signal<number | null>(null);
  readonly topN = signal<number>(10);

  readonly debarcaderes = signal<any[]>([]);
  readonly stats = signal<StatsResponse | null>(null);
  readonly loadingApercu = signal<boolean>(false);
  readonly loadingPdf = signal<boolean>(false);

  readonly periodeInvalide = computed(
    () =>
      !!this.dateDebut() &&
      !!this.dateFin() &&
      this.dateFin() < this.dateDebut(),
  );
  readonly aDesDonnees = computed(
    () => (this.stats()?.nb_debarquements ?? 0) > 0,
  );
  readonly totalAlertes = computed(() =>
    Object.values(this.stats()?.alertes ?? {}).reduce((a, b) => a + b, 0),
  );

  private charts: Record<string, Chart> = {};

  ngOnInit(): void {
    this.chargerDebarcaderes();
  }
  ngOnDestroy(): void {
    this.detruireCharts();
  }

  private chargerDebarcaderes(): void {
    this.http
      .get<any[]>(`${this.api}/api/debarcaderes/dropdown/list`)
      .subscribe({
        next: (data) => {
          // console.log(data);
          this.debarcaderes.set(data ?? []);
          setTimeout(() => {
            M.FormSelect.init(this.selectSite?.nativeElement);
            this.addSearchBox(
              this.selectSite?.nativeElement,
              "select_debarcadere",
            );
          }, 500);
        },
        error: () => this.debarcaderes.set([]),
      });
  }

  private corpsRequete() {
    return {
      date_debut: this.dateDebut(),
      date_fin: this.dateFin(),
      debarcadere_id: this.debarcadereId(),
      top_n: this.topN(),
    };
  }

  // --- 1) Aperçu HTML ------------------------------------------------------
  previsualiser(): void {
    if (this.periodeInvalide()) {
      M?.toast?.({
        html: "La date de fin doit suivre la date de début.",
        classes: "red darken-1",
      });
      return;
    }
    this.loadingApercu.set(true);
    this.http
      .post<StatsResponse>(
        `${this.api}/api/debarquements/rapports/statistiques/donnees`,
        this.corpsRequete(),
      )
      .subscribe({
        next: (data) => {
          this.stats.set(data);
          this.loadingApercu.set(false);
          // les canvases n'existent qu'après le rendu du bloc @if → micro-délai
          setTimeout(() => this.dessinerCharts(data), 0);
        },
        error: (err: HttpErrorResponse) => {
          this.loadingApercu.set(false);
          M?.toast?.({
            html: err?.error?.detail ?? "Échec du calcul des statistiques.",
            classes: "red darken-1",
          });
        },
      });
  }

  // --- 2) Téléchargement PDF ----------------------------------------------
  telechargerPdf(): void {
    this.loadingPdf.set(true);
    this.http
      .post(
        `${this.api}/api/debarquements/rapports/statistiques`,
        this.corpsRequete(),
        {
          responseType: "blob",
          observe: "response",
        },
      )
      .subscribe({
        next: (resp) => {
          const blob = resp.body as Blob;
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `rapport_debarquements_${this.dateDebut()}_${this.dateFin()}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.loadingPdf.set(false);
          M?.toast?.({ html: "Rapport téléchargé.", classes: "teal darken-1" });
        },
        error: (err: HttpErrorResponse) => {
          this.loadingPdf.set(false);
          if (err.error instanceof Blob) {
            err.error.text().then((t) => {
              let msg = "Échec de la génération du PDF.";
              try {
                msg = JSON.parse(t)?.detail ?? msg;
              } catch {
                /* fallback */
              }
              M?.toast?.({ html: msg, classes: "red darken-1" });
            });
          } else {
            M?.toast?.({
              html: "Échec de la génération du PDF.",
              classes: "red darken-1",
            });
          }
        },
      });
  }

  // --- Formatage -----------------------------------------------------------
  fmt(n: number): string {
    return (n ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  }

  // --- Chart.js ------------------------------------------------------------
  private detruireCharts(): void {
    Object.values(this.charts).forEach((c) => c.destroy());
    this.charts = {};
  }

  private dessinerCharts(s: StatsResponse): void {
    this.detruireCharts();
    if (!this.aDesDonnees()) return;

    const get = (id: string) =>
      document.getElementById(id) as HTMLCanvasElement | null;
    const baseOpts = { responsive: true, maintainAspectRatio: false }; // évite la croissance du canvas

    const cDeb = get("chartDebarcadere");
    if (cDeb) {
      this.charts["deb"] = new Chart(cDeb, {
        type: "bar",
        data: {
          labels: s.par_debarcadere.map((d) => d.label),
          datasets: [
            {
              label: "Débarquements",
              data: s.par_debarcadere.map((d) => d.valeur),
              backgroundColor: TEAL,
            },
          ],
        },
        options: {
          ...baseOpts,
          indexAxis: "y",
          plugins: { legend: { display: false } },
        },
      });
    }

    const cEsp = get("chartEspeces");
    if (cEsp) {
      this.charts["esp"] = new Chart(cEsp, {
        type: "bar",
        data: {
          labels: s.top_especes.map((e) => e.nom),
          datasets: [
            {
              label: "kg",
              data: s.top_especes.map((e) => e.quantite_kg),
              backgroundColor: OCEAN,
            },
          ],
        },
        options: {
          ...baseOpts,
          indexAxis: "y",
          plugins: { legend: { display: false } },
        },
      });
    }

    const cEvo = get("chartEvolution");
    if (cEvo) {
      this.charts["evo"] = new Chart(cEvo, {
        type: "line",
        data: {
          labels: s.evolution.map((p) => p.jour),
          datasets: [
            {
              label: "Quantité (kg)",
              data: s.evolution.map((p) => p.quantite_kg),
              borderColor: TEAL,
              backgroundColor: "rgba(15,124,138,0.12)",
              fill: true,
              tension: 0.25,
              pointRadius: 2,
            },
          ],
        },
        options: { ...baseOpts, plugins: { legend: { display: false } } },
      });
    }

    const cDest = get("chartDestination");
    if (cDest) {
      this.charts["dest"] = new Chart(cDest, {
        type: "doughnut",
        data: {
          labels: s.par_destination.map((d) => d.label),
          datasets: [
            {
              data: s.par_destination.map((d) => d.valeur),
              backgroundColor: PALETTE,
            },
          ],
        },
        options: {
          ...baseOpts,
          cutout: "55%",
          plugins: { legend: { position: "right" } },
        },
      });
    }
  }

  // --- Dates ---------------------------------------------------------------
  private aujourdHui(): string {
    return new Date().toISOString().slice(0, 10);
  }
  private premierJourDuMois(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
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
}
