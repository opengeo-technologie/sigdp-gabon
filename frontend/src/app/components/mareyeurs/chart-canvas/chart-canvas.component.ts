// chart-canvas.component.ts
// Wrapper Chart.js réutilisable (standalone). Se (re)dessine automatiquement
// quand ses entrées changent, et se détruit proprement.

import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
} from "@angular/core";
import { Chart, ChartConfiguration, ChartType, registerables } from "chart.js";

Chart.register(...registerables);

// Palette « institutionnelle » réutilisée pour pie/doughnut/bar
const PALETTE = [
  "#1565c0",
  "#00897b",
  "#ef6c00",
  "#5e35b1",
  "#c62828",
  "#2e7d32",
  "#00838f",
  "#6d4c41",
  "#ad1457",
  "#455a64",
];

@Component({
  selector: "app-chart-canvas",
  standalone: true,
  template: `<canvas #cv></canvas>`,
  styles: [
    `
      :host {
        display: block;
        position: relative;
        height: 280px;
        width: 100%;
      }
    `,
  ],
})
export class ChartCanvasComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() type: ChartType = "bar";
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  @Input() label = "";
  @Input() horizontal = false; // barres horizontales
  @Input() unite = ""; // suffixe d'axe/tooltip (ex. 'kg', 'FCFA')

  @ViewChild("cv") canvas!: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private pret = false;

  ngAfterViewInit(): void {
    this.pret = true;
    this.dessiner();
  }

  ngOnChanges(): void {
    if (this.pret) {
      this.dessiner();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private couleurs(): string[] {
    const n = this.labels.length || 1;
    return Array.from({ length: n }, (_, i) => PALETTE[i % PALETTE.length]);
  }

  private dessiner(): void {
    if (!this.canvas) {
      return;
    }
    this.chart?.destroy();

    const estCirculaire = this.type === "pie" || this.type === "doughnut";
    const couleurs = this.couleurs();

    const config: ChartConfiguration = {
      type: this.type,
      data: {
        labels: this.labels,
        datasets: [
          {
            label: this.label,
            data: this.data,
            backgroundColor: estCirculaire ? couleurs : couleurs[0] + "cc",
            borderColor: estCirculaire ? "#ffffff" : couleurs[0],
            borderWidth: estCirculaire ? 2 : 1,
            tension: this.type === "line" ? 0.3 : 0,
            fill: this.type === "line",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: this.horizontal ? "y" : "x",
        plugins: {
          legend: {
            display: estCirculaire,
            position: "bottom",
            labels: { boxWidth: 12, font: { size: 11 } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = ctx.parsed as { x?: number; y?: number } | number;
                const val =
                  typeof v === "number"
                    ? v
                    : ((this.horizontal ? v.x : v.y) ?? 0);
                const txt = new Intl.NumberFormat("fr-FR").format(Number(val));
                return this.unite ? `${txt} ${this.unite}` : txt;
              },
            },
          },
        },
        scales: estCirculaire
          ? {}
          : {
              x: { ticks: { font: { size: 10 } }, grid: { display: false } },
              y: { ticks: { font: { size: 10 } }, beginAtZero: true },
            },
      },
    };

    this.chart = new Chart(this.canvas.nativeElement, config);
  }
}
