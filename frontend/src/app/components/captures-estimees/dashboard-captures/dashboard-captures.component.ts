// SIGPA — Module « Captures estimées »
// Tableau de bord statistique (Chart.js). Composant standalone Angular 19.
// Prérequis : chart.js installé (npm i chart.js).

import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Chart, registerables } from "chart.js";
import { Engin, Stats } from "../../../models/capture-estimee.model";
import { CapturesEstimeeService } from "../../../services/captures-estimee.service";

declare const M: any;
Chart.register(...registerables);

const BLEU = "#1565c0";
const TEAL = "#00897b";
const ORANGE = "#ef6c00";

@Component({
  selector: "app-dashboard-captures",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./dashboard-captures.component.html",
  styleUrl: "./dashboard-captures.component.scss",
})
export class DashboardCapturesComponent implements AfterViewInit, OnDestroy {
  private svc = inject(CapturesEstimeeService);

  @ViewChild("cMensuel") cMensuel!: ElementRef<HTMLCanvasElement>;
  @ViewChild("cGroupe") cGroupe!: ElementRef<HTMLCanvasElement>;
  @ViewChild("cEngin") cEngin!: ElementRef<HTMLCanvasElement>;
  @ViewChild("cCpue") cCpue!: ElementRef<HTMLCanvasElement>;
  @ViewChild("cTop") cTop!: ElementRef<HTMLCanvasElement>;

  annee = new Date().getFullYear() - 2;
  enginId: number | null = null;
  engins: Engin[] = [];
  stats: Stats | null = null;
  private charts: Chart[] = [];

  ngAfterViewInit(): void {
    this.svc.listerEngins().subscribe((e) => {
      this.engins = e;
      setTimeout(
        () => M.FormSelect.init(document.querySelectorAll("select")),
        0,
      );
    });
    this.charger();
  }
  ngOnDestroy(): void {
    this.detruireCharts();
  }

  charger(): void {
    this.svc.stats(this.annee, this.enginId).subscribe((s) => {
      this.stats = s;
      console.log("Stats reçues :", s);
      this.dessiner(s);
    });
  }

  private detruireCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }

  private dessiner(s: Stats): void {
    this.detruireCharts();

    this.charts.push(
      new Chart(this.cMensuel.nativeElement, {
        data: {
          labels: s.mensuel.labels,
          datasets: [
            {
              type: "bar",
              label: "Captures (t)",
              data: s.mensuel.captures_tonnes,
              backgroundColor: BLEU,
              yAxisID: "y",
            },
            {
              type: "line",
              label: "Valeur (Millions FCFA)",
              data: s.mensuel.valeur_millions_fcfa,
              borderColor: ORANGE,
              backgroundColor: ORANGE,
              tension: 0.3,
              yAxisID: "y1",
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          scales: {
            y: { position: "left", title: { display: true, text: "Tonnes" } },
            y1: {
              position: "right",
              grid: { drawOnChartArea: false },
              title: { display: true, text: "Millions FCFA" },
            },
          },
        },
      }),
    );

    this.charts.push(
      new Chart(this.cGroupe.nativeElement, {
        type: "doughnut",
        data: {
          labels: s.par_groupe.labels,
          datasets: [
            {
              data: s.par_groupe.tonnes,
              backgroundColor: [BLEU, TEAL, ORANGE, "#9e9e9e"],
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
        },
      }),
    );

    this.charts.push(
      new Chart(this.cEngin.nativeElement, {
        type: "bar",
        data: {
          labels: s.par_engin.labels,
          datasets: [
            {
              label: "Tonnes",
              data: s.par_engin.tonnes,
              backgroundColor: TEAL,
            },
          ],
        },
        options: {
          indexAxis: "y",
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      }),
    );

    this.charts.push(
      new Chart(this.cCpue.nativeElement, {
        type: "line",
        data: {
          labels: s.cpue_mensuel.labels,
          datasets: [
            {
              label: "CPUE (kg/jr)",
              data: s.cpue_mensuel.cpue_kg_jour,
              borderColor: BLEU,
              backgroundColor: "rgba(21,101,192,.15)",
              fill: true,
              tension: 0.3,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      }),
    );

    this.charts.push(
      new Chart(this.cTop.nativeElement, {
        type: "bar",
        data: {
          labels: s.top_especes.labels,
          datasets: [
            {
              label: "Tonnes",
              data: s.top_especes.tonnes,
              backgroundColor: BLEU,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      }),
    );
  }
}
