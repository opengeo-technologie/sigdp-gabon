// station-piscicole-rapport.component.ts
// Page rapport : KPI + 5 graphiques Chart.js branchés sur /stats,
// analyses IA par graphique (lecture/tendance/prédiction + projection),
// et génération du rapport PDF backend.
//
// Route à ajouter dans station-piscicole.routes.ts AVANT le path ':id' :
//   {
//     path: 'rapport',
//     loadComponent: () =>
//       import('./station-piscicole-rapport.component')
//         .then(m => m.StationPiscicoleRapportComponent),
//     title: 'Rapport analytique — Stations piscicoles — SIGDP-GABON',
//   },
import { Component, OnInit, OnDestroy, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { RouterLink } from "@angular/router";
import { Chart, registerables } from "chart.js";

import { environment } from "../../../../environments/environment";
import { PROVINCES_GABON } from "../../../models/stations-piscicole.model";

declare const M: any;

Chart.register(...registerables);

interface AnalyseGraphique {
  lecture: string;
  tendance: string;
  prediction: string;
}

interface Projection {
  methode: string;
  mois_projetes_index: Record<string, number>;
  tonnage_annuel_projete_t: number;
}

const VERT = "#1b5e20";
const PALETTE = [
  "#1b5e20",
  "#43a047",
  "#7cb342",
  "#c0ca33",
  "#fdd835",
  "#fb8c00",
  "#6d4c41",
  "#00897b",
  "#546e7a",
];
const COULEURS_STATUT: Record<string, string> = {
  EN_CONSTRUCTION: "#fb8c00",
  ACTIVE: "#43a047",
  SUSPENDUE: "#f9a825",
  FERMEE: "#e53935",
};

@Component({
  selector: "app-station-piscicole-rapport",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./station-piscicole-rapport.component.html",
  styleUrls: ["./station-piscicole-rapport.component.scss"],
})
export class StationPiscicoleRapportComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private baseUrl = `${environment.apiUrl}/api/stations-piscicoles`;

  provinces = PROVINCES_GABON;
  annees = [2024, 2025, 2026];
  province = "";
  annee = new Date().getFullYear();
  avecAnalyseIA = true;

  chargement = false;
  pdfEnCours = false;
  iaEnCours = false;

  indicateurs: any = null;
  kpis: { libelle: string; valeur: string; icone: string; couleur: string }[] =
    [];
  analyses: Record<string, AnalyseGraphique> | null = null;
  projection: Projection | null = null;

  private charts = new Map<string, Chart>();
  private statsCourantes: any = null;

  ngOnInit(): void {
    setTimeout(() => M.FormSelect.init(document.querySelectorAll("select")), 0);
    this.recharger();
  }

  ngOnDestroy(): void {
    // Détruire chaque instance Chart.js — sinon fuite mémoire et
    // erreur "Canvas is already in use" au retour sur la page
    this.charts.forEach((chart) => chart.destroy());
    this.charts.clear();
  }

  recharger(): void {
    this.chargement = true;
    this.analyses = null;
    this.projection = null;

    this.http
      .post<any>(`${this.baseUrl}/rapport/analytique`, {
        province: this.province || undefined,
      })
      .subscribe({
        next: (stats) => {
          // console.log(stats);
          this.chargement = false;
          this.statsCourantes = stats;
          this.indicateurs = stats.indicateurs;
          this.kpis = [
            {
              libelle: "Stations recensées",
              icone: "waves",
              couleur: "green",
              valeur: String(stats.indicateurs.total_stations),
            },
            {
              libelle: "Stations actives",
              icone: "check_circle",
              couleur: "teal",
              valeur: String(stats.indicateurs.stations_actives),
            },
            {
              libelle: "Cycles en cours",
              icone: "autorenew",
              couleur: "blue",
              valeur: String(stats.indicateurs.cycles_en_cours),
            },
            {
              libelle: "Tonnage récolté",
              icone: "scale",
              couleur: "orange",
              valeur: `${stats.indicateurs.tonnage_total_recolte.toFixed(1)} t`,
            },
          ];
          // Construire les graphiques APRÈS le rendu des canvas
          setTimeout(() => this.construireGraphiques(stats), 0);
        },
        error: () => {
          this.chargement = false;
          M.toast({
            html: "Erreur lors du chargement des statistiques",
            classes: "red",
          });
        },
      });
  }

  // -------------------------------------------------------------------------
  // Graphiques Chart.js
  // -------------------------------------------------------------------------

  private creerChart(id: string, config: any): void {
    const canvas = document.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas) return;
    this.charts.get(id)?.destroy(); // détruire l'existant avant recréation
    this.charts.set(id, new Chart(canvas, config));
  }

  private construireGraphiques(stats: any): void {
    const optionsBase = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
    };

    this.creerChart("graph-provinces", {
      type: "bar",
      data: {
        labels: stats.par_province.labels,
        datasets: [
          {
            data: stats.par_province.data,
            backgroundColor: VERT,
            borderRadius: 3,
          },
        ],
      },
      options: {
        ...optionsBase,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });

    this.creerChart("graph-statut", {
      type: "doughnut",
      data: {
        labels: stats.par_statut.labels,
        datasets: [
          {
            data: stats.par_statut.data,
            backgroundColor: stats.par_statut.labels.map(
              (l: string) => COULEURS_STATUT[l] || "#999",
            ),
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        ...optionsBase,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { font: { size: 10 } },
          },
        },
      },
    });

    this.creerChart("graph-type", {
      type: "pie",
      data: {
        labels: stats.par_type.labels,
        datasets: [
          {
            data: stats.par_type.data,
            backgroundColor: PALETTE,
            borderWidth: 2,
            borderColor: "#fff",
          },
        ],
      },
      options: {
        ...optionsBase,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { font: { size: 10 } },
          },
        },
      },
    });

    this.creerChart("graph-especes", {
      type: "bar",
      data: {
        labels: stats.production_par_espece.labels,
        datasets: [
          {
            data: stats.production_par_espece.data,
            backgroundColor: "#00897b",
            borderRadius: 3,
          },
        ],
      },
      options: {
        ...optionsBase,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Tonnes" } },
        },
      },
    });

    this.construireGraphiqueMensuel(stats);
  }

  private construireGraphiqueMensuel(stats: any): void {
    // Deux datasets empilés visuellement : observé (plein) + projeté (clair)
    const observes = [...stats.production_mensuelle.data];
    const projetes = new Array(12).fill(0);
    this.projection = stats.projection;
    if (this.projection) {
      for (const [mois, valeur] of Object.entries(
        this.projection.mois_projetes_index,
      )) {
        projetes[+mois - 1] = valeur;
        observes[+mois - 1] = 0;
      }
    }

    const datasets: any[] = [
      {
        label: "Observé",
        data: observes,
        backgroundColor: "#7cb342",
        borderRadius: 3,
      },
    ];
    if (this.projection) {
      datasets.push({
        label: "Projeté (régression linéaire)",
        data: projetes,
        backgroundColor: "#dcedc8",
        borderColor: "#7cb342",
        borderWidth: 1.5,
        borderRadius: 3,
      });
    }

    this.creerChart("graph-mensuel", {
      type: "bar",
      data: { labels: stats.production_mensuelle.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: !!this.projection,
            position: "top",
            labels: { font: { size: 10 } },
          },
        },
        scales: {
          x: { stacked: true },
          y: {
            stacked: true,
            beginAtZero: true,
            title: { display: true, text: "Tonnes" },
          },
        },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Analyse IA
  // -------------------------------------------------------------------------

  analyserGraphiques(): void {
    this.iaEnCours = true;
    this.http
      .post<any>(`${this.baseUrl}/rapport/analyse-graphiques`, {
        province: this.province || undefined,
        annee: this.annee,
      })
      .subscribe({
        next: (res) => {
          this.iaEnCours = false;
          this.analyses = res.analyses.graphiques;
          this.projection = res.projection;
          // Redessiner le graphique mensuel avec la projection
          if (this.statsCourantes) {
            this.construireGraphiqueMensuel(this.statsCourantes);
          }
          M.toast({ html: "Analyse IA générée", classes: "green" });
        },
        error: (err) => {
          this.iaEnCours = false;
          M.toast({
            html: err?.error?.detail || "L'analyse IA est indisponible",
            classes: "red",
          });
        },
      });
  }

  // -------------------------------------------------------------------------
  // PDF
  // -------------------------------------------------------------------------

  telechargerPDF(): void {
    this.pdfEnCours = true;
    this.http
      .post(
        `${this.baseUrl}/rapport/generer`,
        {
          province: this.province || undefined,
          annee: this.annee,
          avec_analyse_ia: this.avecAnalyseIA,
        },
        { responseType: "blob" },
      )
      .subscribe({
        next: (blob) => {
          this.pdfEnCours = false;
          const d = new Date();
          const horodatage =
            `${d.getFullYear()}` +
            `${String(d.getMonth() + 1).padStart(2, "0")}` +
            `${String(d.getDate()).padStart(2, "0")}`;
          const url = URL.createObjectURL(blob);
          const lien = document.createElement("a");
          lien.href = url;
          lien.download = `rapport_stations_piscicoles_${horodatage}.pdf`;
          lien.click();
          URL.revokeObjectURL(url);
          M.toast({ html: "Rapport PDF téléchargé", classes: "green" });
        },
        error: () => {
          this.pdfEnCours = false;
          M.toast({
            html: "Erreur lors de la génération du rapport",
            classes: "red",
          });
        },
      });
  }
}
