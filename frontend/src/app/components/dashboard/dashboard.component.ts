import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import { FormsModule } from "@angular/forms";
import { Chart, registerables } from "chart.js";
import { ConnectedUsersComponent } from "../user/connected-users/connected-users.component";
declare var M: any;

Chart.register(...registerables);

export interface LigneMensuelle {
  mois: number; // 1 à 12
  libelle: string; // "Mai"
  volume_captures_kg: number;
  volume_transactions_kg: number;
  montant_transactions_fcfa: number;
  taux_absorption: number;
}

export interface StatistiquesMensuelles {
  annee: number;
  total_captures_kg: number;
  total_transactions_kg: number;
  total_montant_fcfa: number;
  taux_absorption_global: number;
  series: LigneMensuelle[];
}

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ConnectedUsersComponent],
  templateUrl: "./dashboard.component.html",
  styleUrls: ["./dashboard.component.scss"],
})
export class DashboardComponent implements OnInit {
  @ViewChild("chartCanvas") chartCanvas!: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  stats: any = {
    globaux: {},
    captures_mois: {},
    alertes: {},
  };
  topEspeces: any[] = [];
  topDebarcaderes: any[] = [];

  years: number[] = [];
  evolutionData: any = null;
  autorisationData: any = null;
  captureZoneData: any = null;
  statsCapturesMareyeurs: StatistiquesMensuelles | null = null;

  filtresAutorisation: any[] = [
    { id: 1, valeur: "Province (Strate majeure)" },
    { id: 2, valeur: "Localité (Strate mineure)" },
    { id: 3, valeur: "Site de pêche" },
    { id: 4, valeur: "Coopérative" },
    { id: 5, valeur: "Type de métier" },
    { id: 6, valeur: "Nationalité" },
  ];

  listeMois: any[] = [
    { id: 1, valeur: "Janvier" },
    { id: 2, valeur: "Février" },
    { id: 3, valeur: "Mars" },
    { id: 4, valeur: "Avril" },
    { id: 5, valeur: "Mai" },
    { id: 6, valeur: "Juin" },
    { id: 6, valeur: "Juillet" },
    { id: 6, valeur: "Août" },
    { id: 6, valeur: "Septembre" },
    { id: 6, valeur: "Octobre" },
    { id: 6, valeur: "Novembre" },
    { id: 6, valeur: "Decembre" },
  ];

  filtreAutorisationSelected: any = 1;
  selectedYear: any;
  selectedYearAutorisation: any;
  selectedYearCapture: any;
  selectedMonth: any = 12;

  // Chart references
  lineChart: Chart | null = null;
  barChart: Chart | null = null;
  pieChartCaptureZone: Chart | null = null;
  private charts: Chart[] = [];

  // UI
  loading = false;
  activeChart = "line-chart";

  constructor(private http: HttpClient) {
    const currentYear = new Date().getFullYear();
    const startYear = 2024; // année de début pour les licences
    this.selectedYear = startYear;
    this.selectedYearAutorisation = startYear;
    this.selectedYearCapture = startYear;
    this.years = Array.from(
      { length: currentYear - startYear + 1 },
      (_, i) => currentYear - i, // ordre décroissant
    );
  }

  ngOnInit() {
    this.loadDashboardStats();
    // this.loadTopEspeces();
    // this.loadTopDebarcaderes();
    setTimeout(() => this.loadTopEspeces(), 300);
    setTimeout(() => this.loadTopDebarcaderes(), 600);
    setTimeout(() => this.loadCaptureParAn(), 900);
    setTimeout(() => this.chargerCaptureTransaction(), 900);
    // setTimeout(() => this.loadAutorisationParProvince(), 1200);
    setTimeout(() => this.loadCaptureParZone(), 1500);
    setTimeout(() => this.initMaterialize(), 100);
  }

  // ngAfterViewInit() {
  //   this.chart = new Chart(this.chartCanvas.nativeElement, {
  //     type: "bar",
  //     data: {
  //       labels: ["Thon", "Sardine", "Crevette", "Maquereau"],
  //       datasets: [
  //         {
  //           label: "Captures (tonnes)",
  //           data: [120, 90, 45, 70],
  //           backgroundColor: ["#0277bd", "#00897b", "#fb8c00", "#7b1fa2"],
  //         },
  //       ],
  //     },
  //     options: {
  //       responsive: true,
  //       plugins: {
  //         title: { display: true, text: "Captures par espèce" },
  //       },
  //     },
  //   });
  // }

  ngOnDestroy() {
    this.chart?.destroy(); // ÉVITE les fuites mémoire / canvas réutilisé
  }

  private initMaterialize() {
    if (typeof M !== "undefined")
      M.FormSelect.init(document.querySelectorAll("select"), {});
  }

  loadDashboardStats() {
    this.http
      .get(`${environment.apiUrl}/api/statistiques/dashboard`)
      .subscribe({
        next: (data: any) => {
          // console.log(data);
          this.stats = data;
        },
        error: (err) => console.error("Erreur chargement stats:", err),
      });
  }

  loadTopEspeces() {
    this.http
      .get(`${environment.apiUrl}/api/statistiques/especes/top?limite=5`)
      .subscribe({
        next: (data: any) => {
          this.topEspeces = data;
        },
        error: (err) => console.error("Erreur top espèces:", err),
      });
  }

  loadTopDebarcaderes() {
    this.http
      .get(
        `${environment.apiUrl}/api/statistiques/debarcaderes/activite?limite=5`,
      )
      .subscribe({
        next: (data: any) => {
          // console.log(data);
          this.topDebarcaderes = data;
        },
        error: (err) => console.error("Erreur top débarcadères:", err),
      });
  }

  loadCaptureParAn() {
    this.http
      .get(
        `${environment.apiUrl}/api/statistiques/captures/yearly?filtre=province&annee=${this.selectedYear}`,
      )
      .subscribe({
        next: (response: any) => {
          // console.log(response);
          this.evolutionData = response;
          this.loading = false;

          setTimeout(() => this.initLineChartGlobale(), 300);
        },
        error: (err) => console.error("Erreur top débarcadères:", err),
      });
  }

  loadAutorisationParProvince() {
    this.http
      .get(
        `${environment.apiUrl}/api/statistiques/autorisations/province?annee=${this.selectedYearAutorisation}`,
      )
      .subscribe({
        next: (response: any) => {
          // console.log(response);
          this.autorisationData = response.data.sort(
            (a: any, b: any) => b.nombre_autorisations - a.nombre_autorisations,
          );
          // console.log(this.autorisationData);
          // this.autorisationData = response;
          this.loading = false;

          setTimeout(() => this.initBarChartAutorisation(), 300);
        },
        error: (err) => console.error("Erreur top débarcadères:", err),
      });
  }

  loadCaptureParZone() {
    this.http
      .get(
        `${environment.apiUrl}/api/statistiques/captures/zone?annee=${this.selectedYearCapture}`,
      )
      .subscribe({
        next: (response: any) => {
          // console.log(response);
          this.captureZoneData = response.evolution.sort(
            (a: any, b: any) => b.quantite_tonnes - a.quantite_tonnes,
          );
          // console.log(this.captureZoneData);
          // this.autorisationData = response;
          // this.loading = false;

          setTimeout(() => this.initPieCaptureParzone(), 300);
        },
        error: (err) => console.error("Erreur top débarcadères:", err),
      });
  }

  chargerCaptureTransaction(): void {
    this.http
      .get(
        `${environment.apiUrl}/api/statistiques/captures-mareyeurs/yearly?annee=${this.selectedYearAutorisation}`,
      )
      .subscribe({
        next: (data: any) => {
          // console.log(data);
          this.statsCapturesMareyeurs = data;
          setTimeout(() => this.dessinerGraphes(), 300);
        },
        error: () => {
          // this.chargement = false;
          M.toast({
            html: "Erreur lors du chargement des statistiques",
            classes: "red",
          });
        },
      });
  }

  /**
   * ✅ Line chart évolution capture par année
   */
  initLineChartGlobale() {
    const ctx = document.getElementById("lineChart") as HTMLCanvasElement;
    if (!ctx) return;

    const data = this.evolutionData.evolution || [];

    this.lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map((d: any) => d.mois),
        datasets: [
          {
            label: "Tonnage (t)",
            data: data.map((d: any) => d.quantite_tonnes),
            borderColor: "#2196F3",
            backgroundColor: "rgba(33, 150, 243, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            yAxisID: "y",
          },
          {
            label: "Nombre captures (débarquements)",
            data: data.map((d: any) => d.nombre_debarquements),
            borderColor: "#FF9800",
            backgroundColor: "rgba(255, 152, 0, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: true, position: "top" },
        },
        scales: {
          x: {
            type: "category",
            display: true,
            title: {
              display: true,
              text: `Mois (${this.selectedYear})`,
            },
            ticks: {
              color: "#333",
              font: { size: 12 },
              maxRotation: 45,
              minRotation: 0,
            },
            grid: {
              display: true,
              color: "rgba(0, 0, 0, 0.05)",
            },
          },
          y: {
            type: "linear",
            display: true,
            position: "left",
            title: { display: true, text: "Tonnage (t)" },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            title: { display: true, text: "Nombre captures (débarquements)" },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }

  /**
   * ✅ Bar chart comparaison Top 5
   */
  initBarChartAutorisation() {
    const ctx = document.getElementById("barChart") as HTMLCanvasElement;
    if (!ctx) return;

    const provinceData = this.autorisationData || [];

    this.barChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: [...provinceData.map((p: any) => p.province)],
        datasets: [
          {
            label: "Nombre d'autorisations",
            data: [...provinceData.map((p: any) => p.nombre_autorisations)],
            backgroundColor: "#2196F3",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
        },
      },
    });
  }

  initPieCaptureParzone() {
    const canvas = document.getElementById("pieChart") as HTMLCanvasElement;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // ✅ Extraire données
      const labels = this.captureZoneData.map((d: any) => d.zone_peche);
      const values = this.captureZoneData.map((d: any) => d.quantite_tonnes);

      // ✅ AJOUTER CECI
      const total = values.reduce((a: any, b: any) => a + b, 0);
      const percentages = values.map((v: any) =>
        ((v / total) * 100).toFixed(1),
      );

      const labelsWithPercent = labels.map(
        (label: any, i: any) => `${label} (${percentages[i]}%)`,
      );

      this.pieChartCaptureZone = new Chart(ctx, {
        type: "pie",
        data: {
          labels: labelsWithPercent,
          datasets: [
            {
              data: values,
              backgroundColor: [
                "#2196F3", // Bleu
                "#FF9800", // Orange
                "#4CAF50", // Vert
                "#F44336", // Rouge
                "#9C27B0", // Mauve
                "#00BCD4", // Cyan
                "#8BC34A", // Light Green
                "#FF5722", // Deep Orange
              ],
              borderColor: "#fff",
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "right", // right, top, bottom, left
            },
            title: {
              display: true,
              text: "Distribution des Captures par Zone",
              font: { size: 16, weight: "bold" },
            },
          },
        },
      });
    } else {
      return;
    }

    //
  }

  /**
   * ✅ Line chart évolution capture + transactions mareyeurs par année
   */
  dessinerGraphes() {
    if (!this.statsCapturesMareyeurs) {
      return;
    }

    const ctx = document.getElementById("barChart") as HTMLCanvasElement;
    if (!ctx) return;

    const labels = this.statsCapturesMareyeurs.series.map((l) => l.libelle);

    this.barChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Captures déclarées",
            data: this.statsCapturesMareyeurs.series.map(
              (l: any) => l.volume_captures_kg,
            ),
            backgroundColor: "rgba(30, 136, 229, 0.7)",
            borderColor: "#1e88e5",
            borderWidth: 1,
          },
          {
            label: "Achats mareyeurs",
            data: this.statsCapturesMareyeurs.series.map(
              (l: any) => l.volume_transactions_kg,
            ),
            backgroundColor: "rgba(0, 158, 96, 0.7)",
            borderColor: "#009e60",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "kg" } },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = ctx.parsed?.y ?? 0;
                return `${ctx.dataset.label}: ${value.toLocaleString("fr-FR")} kg`;
              },
            },
          },
        },
      },
    });
  }

  refreshLineChart() {
    if (this.lineChart) {
      this.lineChart.destroy();
      this.lineChart = null;
    }
    this.loadCaptureParAn();
  }

  refreshBarChart() {
    if (this.barChart) {
      this.barChart.destroy();
      this.barChart = null;
    }
    this.chargerCaptureTransaction();
  }

  refreshPieChart() {
    if (this.pieChartCaptureZone) {
      this.pieChartCaptureZone.destroy();
      this.pieChartCaptureZone = null;
    }
    this.loadCaptureParZone();
  }
}
