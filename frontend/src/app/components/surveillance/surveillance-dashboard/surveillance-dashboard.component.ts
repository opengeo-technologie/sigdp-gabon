import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import Chart from "chart.js/auto";

import { OperationsService } from "../../../services/operations.service";
import { DashboardData } from "../../../models/operations.model";

@Component({
  selector: "app-surveillance-dashboard",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./surveillance-dashboard.component.html",
  styleUrls: ["./surveillance-dashboard.component.scss"],
})
export class SurveillanceDashboardComponent implements OnInit, AfterViewInit {
  private srv = inject(OperationsService);

  chargement = false;
  data: DashboardData | null = null;
  filtre = { date_debut: "", date_fin: "" };

  @ViewChild("cType") cType?: ElementRef<HTMLCanvasElement>;
  @ViewChild("cResultat") cResultat?: ElementRef<HTMLCanvasElement>;
  @ViewChild("cGravite") cGravite?: ElementRef<HTMLCanvasElement>;
  @ViewChild("cInfType") cInfType?: ElementRef<HTMLCanvasElement>;
  @ViewChild("cMois") cMois?: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];

  private readonly palette = [
    "#1565c0",
    "#ef6c00",
    "#c62828",
    "#2e7d32",
    "#6a1b9a",
    "#00838f",
    "#4e342e",
    "#455a64",
  ];

  ngOnInit(): void {
    this.charger();
  }
  ngAfterViewInit(): void {}

  charger(): void {
    this.chargement = true;
    this.srv
      .dashboard({
        date_debut: this.filtre.date_debut || null,
        date_fin: this.filtre.date_fin || null,
      })
      .subscribe({
        next: (d) => {
          this.data = d;
          this.chargement = false;
          setTimeout(() => this.dessiner(), 60);
        },
        error: () => {
          this.chargement = false;
        },
      });
  }

  reinitialiser(): void {
    this.filtre = { date_debut: "", date_fin: "" };
    this.charger();
  }

  apercuRapport(): void {
    window.open(
      this.srv.rapportUrl({
        date_debut: this.filtre.date_debut || null,
        date_fin: this.filtre.date_fin || null,
      }),
      "_blank",
    );
  }

  telechargerRapport(): void {
    this.srv
      .telechargerRapport({
        date_debut: this.filtre.date_debut || null,
        date_fin: this.filtre.date_fin || null,
      })
      .subscribe((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "rapport_surveillance.pdf";
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  private dessiner(): void {
    if (!this.data) return;
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
    const d = this.data;

    if (this.cType) {
      this.charts.push(
        new Chart(this.cType.nativeElement, {
          type: "bar",
          data: {
            labels: d.operations_par_type.labels,
            datasets: [
              {
                label: "Opérations",
                data: d.operations_par_type.data,
                backgroundColor: this.palette,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
          },
        }),
      );
    }
    if (this.cResultat) {
      this.charts.push(
        new Chart(this.cResultat.nativeElement, {
          type: "doughnut",
          data: {
            labels: d.operations_par_resultat.labels,
            datasets: [
              {
                data: d.operations_par_resultat.data,
                backgroundColor: ["#2e7d32", "#c62828", "#9e9e9e"],
              },
            ],
          },
          options: { responsive: true, maintainAspectRatio: false },
        }),
      );
    }
    if (this.cGravite) {
      this.charts.push(
        new Chart(this.cGravite.nativeElement, {
          type: "bar",
          data: {
            labels: d.infractions_par_gravite.labels,
            datasets: [
              {
                label: "Infractions",
                data: d.infractions_par_gravite.data,
                backgroundColor: ["#2e7d32", "#ef6c00", "#c62828"],
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
          },
        }),
      );
    }
    if (this.cInfType) {
      this.charts.push(
        new Chart(this.cInfType.nativeElement, {
          type: "bar",
          data: {
            labels: d.infractions_par_type.labels,
            datasets: [
              {
                label: "Infractions",
                data: d.infractions_par_type.data,
                backgroundColor: "#ef6c00",
              },
            ],
          },
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
          },
        }),
      );
    }
    if (this.cMois) {
      this.charts.push(
        new Chart(this.cMois.nativeElement, {
          type: "line",
          data: {
            labels: d.activite_par_mois.labels,
            datasets: [
              {
                label: "Opérations",
                data: d.activite_par_mois.operations,
                borderColor: "#1565c0",
                backgroundColor: "rgba(21,101,192,.12)",
                fill: true,
                tension: 0.3,
              },
              {
                label: "Infractions",
                data: d.activite_par_mois.infractions,
                borderColor: "#c62828",
                backgroundColor: "rgba(198,40,40,.10)",
                fill: true,
                tension: 0.3,
              },
            ],
          },
          options: { responsive: true, maintainAspectRatio: false },
        }),
      );
    }
  }
}
