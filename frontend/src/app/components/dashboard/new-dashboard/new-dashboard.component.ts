// evolution-captures.component.ts

import { Component, OnInit } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Chart, registerables } from "chart.js";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { environment } from "../../../../environments/environment";

Chart.register(...registerables);

interface EvolutionData {
  periode: string;
  nombre_debarquements: number;
  quantite_kg: number;
  quantite_tonnes: number;
}

@Component({
  selector: "app-new-dashboard",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./new-dashboard.component.html",
  styleUrl: "./new-dashboard.component.scss",
})
export class NewDashboardComponent {
  // Filters
  periodeSelected = "mois";
  limiteSelected = 12;
  dimensionSelected = "globale";
  filterProvince = "";
  filterLocalite = "";
  filterDebarcadere = "";

  // Data
  evolutionData: any = null;
  debarcaderesOptions: any[] = [];
  localitesOptions: any[] = [];
  provincesOptions: any[] = [];

  // UI
  loading = false;
  activeChart = "line-chart";

  // Chart references
  lineChart: Chart | null = null;
  barChart: Chart | null = null;
  comparisonChart: Chart | null = null;

  periodeOptions = [
    { value: "jour", label: "Par jour" },
    { value: "semaine", label: "Par semaine" },
    { value: "mois", label: "Par mois" },
    { value: "annee", label: "Par année" },
  ];

  dimensionOptions = [
    { value: "globale", label: "Vue Globale" },
    { value: "debarcadere", label: "Par Débarcadère" },
    { value: "localite", label: "Par Localité" },
    { value: "province", label: "Par Province" },
    { value: "comparaison", label: "Comparaison Top 5" },
  ];

  limiteOptions = [7, 12, 30, 52, 365];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadEvolution();
  }

  /**
   * ✅ Charger les données d'évolution
   */
  loadEvolution() {
    this.loading = true;

    let endpoint = `${environment.apiUrl}/api/stats/evolution/${this.dimensionSelected}`;

    let params = new HttpParams()
      .set("periode", this.periodeSelected)
      .set("limite", this.limiteSelected.toString());

    // Ajouter filtres optionnels
    if (this.filterProvince) {
      params = params.set("province", this.filterProvince);
    }
    if (this.filterLocalite) {
      params = params.set("localite", this.filterLocalite);
    }
    if (this.filterDebarcadere) {
      params = params.set("debarcadere_id", this.filterDebarcadere);
    }

    console.log("📥 Chargement évolution:", {
      endpoint,
      periode: this.periodeSelected,
      limite: this.limiteSelected,
      dimension: this.dimensionSelected,
    });

    this.http.get(endpoint, { params }).subscribe({
      next: (response: any) => {
        console.log("✅ Evolution chargée:", response);
        this.evolutionData = response;
        this.loading = false;

        // Initialiser graphiques après chargement
        setTimeout(() => this.initCharts(), 300);
      },
      error: (err) => {
        console.error("❌ Erreur chargement évolution:", err);
        this.loading = false;
        alert("Erreur lors du chargement des données");
      },
    });
  }

  /**
   * ✅ Initialiser les graphiques
   */
  initCharts() {
    this.destroyCharts();

    if (this.dimensionSelected === "globale") {
      this.initLineChartGlobale();
    } else if (this.dimensionSelected === "debarcadere") {
      this.initLineChartDebarcadere();
    } else if (this.dimensionSelected === "localite") {
      this.initLineChartLocalite();
    } else if (this.dimensionSelected === "province") {
      this.initLineChartProvince();
    } else if (this.dimensionSelected === "comparaison") {
      this.initBarChartComparaison();
    }
  }

  /**
   * ✅ Line chart évolution globale
   */
  initLineChartGlobale() {
    const ctx = document.getElementById("lineChart") as HTMLCanvasElement;
    if (!ctx) return;

    const data = this.evolutionData.evolution_globale || [];

    this.lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map((d: any) => d.periode),
        datasets: [
          {
            label: "Tonnage (T)",
            data: data.map((d: any) => d.quantite_tonnes),
            borderColor: "#2196F3",
            backgroundColor: "rgba(33, 150, 243, 0.1)",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            yAxisID: "y",
          },
          {
            label: "Nombre débarquements",
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
          y: {
            type: "linear",
            display: true,
            position: "left",
            title: { display: true, text: "Tonnage (T)" },
          },
          y1: {
            type: "linear",
            display: true,
            position: "right",
            title: { display: true, text: "Nombre débarquements" },
            grid: { drawOnChartArea: false },
          },
        },
      },
    });
  }

  /**
   * ✅ Line chart par débarcadère
   */
  initLineChartDebarcadere() {
    const ctx = document.getElementById("lineChart") as HTMLCanvasElement;
    if (!ctx) return;

    const debarcaderes = this.evolutionData.debarcaderes || [];

    if (debarcaderes.length === 0) {
      console.warn("Aucun débarcadère trouvé");
      return;
    }

    // Récupérer toutes les périodes uniques
    const allPeriodes = new Set<string>();
    debarcaderes.forEach((d: any) => {
      d.evolution.forEach((e: EvolutionData) => {
        allPeriodes.add(e.periode);
      });
    });

    const labels = Array.from(allPeriodes).sort();

    // Créer un dataset par débarcadère
    const colors = [
      "#2196F3",
      "#FF9800",
      "#4CAF50",
      "#F44336",
      "#9C27B0",
      "#00BCD4",
      "#8BC34A",
      "#FF5722",
      "#CDDC39",
      "#673AB7",
    ];

    const datasets = debarcaderes.map((deb: any, index: number) => {
      const color = colors[index % colors.length];
      const dataMap: { [key: string]: number } = {};

      deb.evolution.forEach((e: EvolutionData) => {
        dataMap[e.periode] = e.quantite_tonnes;
      });

      return {
        label: deb.debarcadere,
        data: labels.map((p) => dataMap[p] || 0),
        borderColor: color,
        backgroundColor: color + "20",
        borderWidth: 2,
        tension: 0.3,
        fill: false,
      };
    });

    this.lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: "top" },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: "Tonnage (T)" },
          },
        },
      },
    });
  }

  /**
   * ✅ Line chart par localité
   */
  initLineChartLocalite() {
    const ctx = document.getElementById("lineChart") as HTMLCanvasElement;
    if (!ctx) return;

    const localites = this.evolutionData.localites || [];

    if (localites.length === 0) {
      console.warn("Aucune localité trouvée");
      return;
    }

    // Même logique que débarcadère
    const allPeriodes = new Set<string>();
    localites.forEach((l: any) => {
      l.evolution.forEach((e: EvolutionData) => {
        allPeriodes.add(e.periode);
      });
    });

    const labels = Array.from(allPeriodes).sort();
    const colors = [
      "#2196F3",
      "#FF9800",
      "#4CAF50",
      "#F44336",
      "#9C27B0",
      "#00BCD4",
      "#8BC34A",
      "#FF5722",
      "#CDDC39",
      "#673AB7",
    ];

    const datasets = localites.map((loc: any, index: number) => {
      const color = colors[index % colors.length];
      const dataMap: { [key: string]: number } = {};

      loc.evolution.forEach((e: EvolutionData) => {
        dataMap[e.periode] = e.quantite_tonnes;
      });

      return {
        label: loc.localite,
        data: labels.map((p) => dataMap[p] || 0),
        borderColor: color,
        backgroundColor: color + "20",
        borderWidth: 2,
        tension: 0.3,
        fill: false,
      };
    });

    this.lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: "top" },
        },
      },
    });
  }

  /**
   * ✅ Bar chart comparaison Top 5
   */
  initBarChartComparaison() {
    const ctx = document.getElementById("barChart") as HTMLCanvasElement;
    if (!ctx) return;

    const provinceData = this.evolutionData.top_provinces || [];
    const localiteData = this.evolutionData.top_localites || [];
    const debarcadereData = this.evolutionData.top_debarcaderes || [];

    this.barChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: [
          ...provinceData.map((p: any) => p.nom),
          ...localiteData.map((l: any) => l.nom),
          ...debarcadereData.map((d: any) => d.nom),
        ],
        datasets: [
          {
            label: "Provinces",
            data: [
              ...provinceData.map((p: any) => p.quantite_tonnes),
              ...new Array(localiteData.length + debarcadereData.length).fill(
                null,
              ),
            ],
            backgroundColor: "#2196F3",
          },
          {
            label: "Localités",
            data: [
              ...new Array(provinceData.length).fill(null),
              ...localiteData.map((l: any) => l.quantite_tonnes),
              ...new Array(debarcadereData.length).fill(null),
            ],
            backgroundColor: "#FF9800",
          },
          {
            label: "Débarcadères",
            data: [
              ...new Array(provinceData.length + localiteData.length).fill(
                null,
              ),
              ...debarcadereData.map((d: any) => d.quantite_tonnes),
            ],
            backgroundColor: "#4CAF50",
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

  /**
   * ✅ Line chart par province
   */
  initLineChartProvince() {
    const ctx = document.getElementById("lineChart") as HTMLCanvasElement;
    if (!ctx) return;

    const provinces = this.evolutionData.provinces || [];

    if (provinces.length === 0) {
      console.warn("Aucune province trouvée");
      return;
    }

    const allPeriodes = new Set<string>();
    provinces.forEach((p: any) => {
      p.evolution.forEach((e: EvolutionData) => {
        allPeriodes.add(e.periode);
      });
    });

    const labels = Array.from(allPeriodes).sort();
    const colors = [
      "#2196F3",
      "#FF9800",
      "#4CAF50",
      "#F44336",
      "#9C27B0",
      "#00BCD4",
      "#8BC34A",
      "#FF5722",
      "#CDDC39",
      "#673AB7",
    ];

    const datasets = provinces.map((prov: any, index: number) => {
      const color = colors[index % colors.length];
      const dataMap: { [key: string]: number } = {};

      prov.evolution.forEach((e: EvolutionData) => {
        dataMap[e.periode] = e.quantite_tonnes;
      });

      return {
        label: prov.province,
        data: labels.map((p) => dataMap[p] || 0),
        borderColor: color,
        backgroundColor: color + "20",
        borderWidth: 2,
        tension: 0.3,
        fill: false,
      };
    });

    this.lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true, position: "top" },
        },
      },
    });
  }

  /**
   * Détruire les graphiques avant recréation
   */
  destroyCharts() {
    if (this.lineChart) {
      this.lineChart.destroy();
      this.lineChart = null;
    }
    if (this.barChart) {
      this.barChart.destroy();
      this.barChart = null;
    }
  }

  /**
   * Changer de dimension
   */
  onDimensionChange(dimension: string) {
    this.dimensionSelected = dimension;
    this.loadEvolution();
  }

  /**
   * Changer de période
   */
  onPeriodeChange(periode: string) {
    this.periodeSelected = periode;
    this.loadEvolution();
  }

  /**
   * Exporter données
   */
  exportData() {
    const json = JSON.stringify(this.evolutionData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `evolution-${this.dimensionSelected}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  }
}
