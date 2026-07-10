import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ArmementCooperativeService } from "../../../services/armement-cooperative.service";
import { ActivatedRoute, RouterModule } from "@angular/router";
import { Chart, registerables } from "chart.js";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../../environments/environment";
declare var M: any;

Chart.register(...registerables);

@Component({
  selector: "app-armement-cooperative-detail",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: "./armement-cooperative-detail.component.html",
  styleUrl: "./armement-cooperative-detail.component.scss",
})
export class ArmementCooperativeDetailComponent {
  armementCooperative: any = null;
  bateaux: any[] = [];
  repartition_par_type: any[] = [];
  loading = true;

  captures: any;

  currentPage = 1;
  rowsPerPage = 5;

  pieChart: Chart | null = null;

  constructor(
    private armementService: ArmementCooperativeService,
    private route: ActivatedRoute,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    // Ici, vous pouvez récupérer les détails de l'armement/coopérative à partir d'un service
    // Par exemple, en utilisant un ID passé via la route
    this.route.params.subscribe((params) => {
      const id = params["id"];
      this.armementService.getArmementCooperative(id).subscribe((data) => {
        this.armementCooperative = data;
      });
      this.loadBateaux(id);
      this.loadCaptureParZone(id);
    });
  }

  loadBateaux(id: number) {
    this.armementService.getBateauxArmementCooperative(id).subscribe((data) => {
      console.log(data);
      this.bateaux = data;
    });
  }

  get paginatedData() {
    const start = (this.currentPage - 1) * this.rowsPerPage;
    return this.bateaux.slice(start, start + this.rowsPerPage);
  }

  totalPages() {
    return Math.ceil(this.bateaux.length / this.rowsPerPage);
  }

  nextPage() {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  getStatutClass(statut: string): string {
    return statut.replace(" ", "-");
  }

  loadCaptureParZone(id: number) {
    this.loading = true;
    this.http
      .get(
        `${environment.apiUrl}/api/armements-cooperatives/statistiques/${id}`,
      )
      .subscribe({
        next: (response: any) => {
          // console.log(response);
          this.repartition_par_type = response.repartition.sort(
            (a: any, b: any) => b.total - a.total,
          );
          this.captures = response.captures;
          // console.log(this.captureZoneData);
          // this.autorisationData = response;
          this.loading = false;

          setTimeout(() => this.initPieCaptureParzone(), 300);
        },
        error: (err) => console.error("Erreur top débarcadères:", err),
      });
  }

  initPieCaptureParzone() {
    const canvas = document.getElementById("pieChart") as HTMLCanvasElement;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // ✅ Extraire données
      const labels = this.repartition_par_type.map((d: any) => d.type);
      const values = this.repartition_par_type.map((d: any) => d.total);

      // ✅ AJOUTER CECI
      const total = values.reduce((a: any, b: any) => a + b, 0);
      const percentages = values.map((v: any) =>
        ((v / total) * 100).toFixed(1),
      );

      const labelsWithPercent = labels.map(
        (label: any, i: any) => `${label} (${percentages[i]}%)`,
      );

      this.pieChart = new Chart(ctx, {
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
            // title: {
            //   display: true,
            //   text: "Distribution des Captures par Zone",
            //   font: { size: 16, weight: "bold" },
            // },
          },
        },
      });
    } else {
      return;
    }

    //
  }
}
