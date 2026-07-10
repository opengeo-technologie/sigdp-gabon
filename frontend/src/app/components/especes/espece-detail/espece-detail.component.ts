import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, ActivatedRoute, Router } from "@angular/router";
import { EspeceService } from "../../../services/espece.service";
import { Espece } from "../../../models/espece.model";
import { environment } from "../../../../environments/environment";
import { Chart, registerables } from "chart.js";
import { FormsModule } from "@angular/forms";
declare var M: any;

Chart.register(...registerables);

@Component({
  selector: "app-espece-detail",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./espece-detail.component.html",
  styleUrls: ["./espece-detail.component.css"],
})
export class EspeceDetailComponent implements OnInit {
  espece?: Espece;
  especeId?: number;
  url: any = `${environment.apiUrl}/uploads/especes/`;

  loading: boolean = true;
  years: number[] = [];
  evolutionData: any = null;
  captureZoneData: any = null;
  selectedYear: any;
  selectedYearCapture: any;

  pieChartCaptureZone: Chart | null = null;

  constructor(
    private especeService: EspeceService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    const currentYear = new Date().getFullYear();
    const startYear = 2024; // année de début pour les licences
    this.selectedYear = startYear;
    this.selectedYearCapture = startYear;
    this.years = Array.from(
      { length: currentYear - startYear + 1 },
      (_, i) => currentYear - i, // ordre décroissant
    );
  }

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.especeId = +params["id"];
      this.loadEspece();
      this.getStatistiquesEspece();
    });
  }

  loadEspece() {
    if (this.especeId) {
      this.especeService.getEspece(this.especeId).subscribe({
        next: (d) => {
          this.espece = d;
        },
        error: (e) => {
          console.error(e);
          M.toast({ html: "Erreur", classes: "red" });
          this.router.navigate(["/especes"]);
        },
      });
    }
  }

  getStatistiquesEspece() {
    if (this.especeId) {
      this.especeService
        .getStatistiquesEspece(this.especeId, this.selectedYear)
        .subscribe({
          next: (d) => {
            // console.log("Données du bateau chargées:", d);
            this.loading = false;

            this.captureZoneData = d.par_zone;

            setTimeout(() => this.initPieCaptureParzone(), 300);
          },
          error: (e) => {
            console.error(e);
            M.toast({ html: "Erreur", classes: "red" });
            this.router.navigate(["/bateaux"]);
          },
        });
    }
  }

  deleteEspece() {
    if (
      this.espece &&
      confirm(`Supprimer "${this.espece.nom_commun_francais}" ?`)
    ) {
      this.especeService.deleteEspece(this.espece.id).subscribe({
        next: () => {
          M.toast({ html: "Supprimé", classes: "green" });
          this.router.navigate(["/especes"]);
        },
        error: (e) => {
          console.error(e);
          M.toast({ html: "Erreur", classes: "red" });
        },
      });
    }
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

  getStatutClass(): string {
    return (
      this.espece?.statut_reglementaire.replace(" ", "-").replace("é", "e") ||
      ""
    );
  }

  getPhotoUrl(): string {
    return this.espece ? this.especeService.getPhotoUrl(this.espece.id) : "";
  }

  refreshPieChart() {
    if (this.pieChartCaptureZone) {
      this.pieChartCaptureZone.destroy();
      this.pieChartCaptureZone = null;
    }
    // this.getStatistiquesBateau();
  }
}
