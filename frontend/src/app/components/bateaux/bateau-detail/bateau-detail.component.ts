import { TypeCooperative } from "./../../../models/armement-cooperative.model";
import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CommonModule } from "@angular/common";
import { RouterModule, ActivatedRoute, Router } from "@angular/router";
import { BateauService } from "../../../services/bateau.service";
import { Bateau } from "../../../models/bateau.model";
import { environment } from "../../../../environments/environment";
import { HasPermissionDirective } from "../../../directives/has-permission.directive";
import { LicencesAutorisationsService } from "../../../services/licences-autorisations.service";
import { AutorisationPechePdfService } from "../../../services/autorisation-pdf.service";
import { PrintBateauInfoService } from "../../../services/print-bateau-info.service";
import { ImageHelperService } from "../../../services/image-helper.service";
import { Chart, registerables } from "chart.js";
declare var M: any;

Chart.register(...registerables);

@Component({
  selector: "app-bateau-detail",
  standalone: true,
  imports: [CommonModule, RouterModule, HasPermissionDirective, FormsModule],
  templateUrl: "./bateau-detail.component.html",
  styleUrls: ["./bateau-detail.component.css"],
})
export class BateauDetailComponent implements OnInit {
  bateau?: Bateau;
  bateauId?: number;
  listEnginsPeche: any[] = [];
  licences: any[] = [];
  loading = false;

  years: number[] = [];
  evolutionData: any = null;
  captureZoneData: any = null;
  selectedYear: any;
  selectedYearCapture: any;

  lineChart: Chart | null = null;
  pieChartCaptureZone: Chart | null = null;

  url: any = `${environment.apiUrl}/uploads/bateaux/`;

  constructor(
    private bateauService: BateauService,
    private licenceService: LicencesAutorisationsService,
    private pdf: AutorisationPechePdfService,
    private pdfBateau: PrintBateauInfoService,
    private imageHelper: ImageHelperService,
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
      this.bateauId = +params["id"];
      this.loadBateau();
      this.getLicencesByBateau();
      this.getEnginsPeche();
      this.getStatistiquesBateau();
    });
  }

  loadBateau() {
    if (this.bateauId) {
      this.bateauService.getBateau(this.bateauId).subscribe({
        next: (d) => {
          // console.log("Données du bateau chargées:", d);
          this.bateau = d;
          // console.log("Données du bateau chargées:", this.bateau);
          // this.listEnginsPeche = d.engins_peche
          //   ? d.engins_peche.split(",").map((e) => e.trim())
          //   : [];
        },
        error: (e) => {
          console.error(e);
          M.toast({ html: "Erreur", classes: "red" });
          this.router.navigate(["/bateaux"]);
        },
      });
    }
  }

  getLicencesByBateau() {
    if (this.bateauId) {
      this.licenceService.getLicencesByBateauId(this.bateauId).subscribe({
        next: (d) => {
          // console.log("Données du bateau chargées:", d);
          this.licences = d;
        },
        error: (e) => {
          console.error(e);
          M.toast({ html: "Erreur", classes: "red" });
          this.router.navigate(["/bateaux"]);
        },
      });
    }
  }

  getStatistiquesBateau() {
    if (this.bateauId) {
      this.bateauService
        .getStatistiquesBateau(this.bateauId, this.selectedYear)
        .subscribe({
          next: (d) => {
            // console.log("Données du bateau chargées:", d);
            this.evolutionData = d;
            this.loading = false;

            this.captureZoneData = d.par_zone;

            setTimeout(() => this.initLineChartGlobale(), 300);
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

  getEnginsPeche() {
    this.bateauService.getEngins().subscribe({
      next: (d) => {
        // console.log("Données du bateau chargées:", d);
        this.listEnginsPeche = d;
      },
      error: (e) => {
        console.error(e);
        M.toast({ html: "Erreur", classes: "red" });
        this.router.navigate(["/bateaux"]);
      },
    });
  }

  deleteBateau() {
    if (
      this.bateau &&
      confirm(
        `Supprimer "${this.bateau.nom_bateau || this.bateau.numero_immatriculation}" ?`,
      )
    ) {
      this.bateauService.deleteBateau(this.bateau.id).subscribe({
        next: () => {
          M.toast({ html: "Supprimé", classes: "green" });
          this.router.navigate(["/bateaux"]);
        },
        error: (e) => {
          console.error(e);
          M.toast({ html: "Erreur", classes: "red" });
        },
      });
    }
  }

  listSiteDebarquement(site_obligatoire: any[]): string {
    if (!site_obligatoire || site_obligatoire.length === 0) {
      return "N/A";
    }
    return site_obligatoire.map((s) => s.nom).join(", ");
  }

  checkProprietaireType(type: string): "NATIONAL" | "ETRANGER" {
    return type === "Gabonaise" ? "NATIONAL" : "ETRANGER";
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

  refreshLineChart() {
    if (this.lineChart) {
      this.lineChart.destroy();
      this.lineChart = null;
    }
    this.getStatistiquesBateau();
  }

  refreshPieChart() {
    if (this.pieChartCaptureZone) {
      this.pieChartCaptureZone.destroy();
      this.pieChartCaptureZone = null;
    }
    this.getStatistiquesBateau();
  }

  async generatePDf(licenceId: number) {
    const logoBase64 = await this.imageHelper.getBase64ImageFromURL(
      "../../../assets/logo.jpg",
    );

    this.licenceService.getLicence(licenceId).subscribe({
      next: (data) => {
        // console.log("Données de la licence:", data);
        // this.pdfService.generateLicencePDF(data);
        this.pdf.open({
          numero: data.numero_licence.padStart(3, "0"),
          anneeValidite: data.annee_validite,
          proprietaireType: this.checkProprietaireType(
            data.proprietaire_info.nationalite,
          ),
          embarcation: {
            nom: data.bateau_info.nom,
            immatriculation: data.bateau_info.immatriculation,
            typePirogue: data.bateau_info.type_bateau,
            marqueMoteur: data.bateau_info.moteur_marque || "N/A",
            puissanceCv: data.bateau_info.moteur_puissance_cv,
            debarcadereAttache: data.bateau_info.site_port_attache.nom,
            siteDebarquement: this.listSiteDebarquement(
              data.bateau_info.site_obligatoire,
            ),
          },
          proprietaire: {
            nom:
              data.proprietaire_info.nom + " " + data.proprietaire_info.prenom,
            nationalite: data.proprietaire_info.nationalite,
            typePiece: data.proprietaire_info.type_piece_identite || "N/A",
            numeroPiece: data.proprietaire_info.numero_piece_identite || "N/A",
            residence: data.proprietaire_info.adresse || "N/A",
            telephone: data.proprietaire_info.telephone || "N/A",
            cooperative: data.bateau_info.cooperative.denomination || "N/A",
          },
          engins: {
            engin1: data.bateau_info.engin_peche_principal
              ? data.bateau_info.engin_peche_principal.libelle
              : "N/A",
            especes1:
              Array.isArray(data.espece1) && data.espece1.length
                ? data.espece1.map((e: any) => e.nom_commun).join(", ")
                : "N/A",

            engin2: data.bateau_info.engin_peche_secondaire
              ? data.bateau_info.engin_peche_secondaire
                  .map((e: any) => e.libelle)
                  .join(", ")
              : "N/A",
            especes2:
              Array.isArray(data.espece2) && data.espece2.length
                ? data.espece2.map((e: any) => e.nom_commun).join(", ")
                : "N/A",
            codeBarre: "SIGDP-AUTH-452-2026",
          },
          periodeDebut: data.date_debut
            ? new Date(data.date_debut).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "N/A",
          periodeFin: data.date_expiration
            ? new Date(data.date_expiration).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "N/A",
          montantFcfa: 200000,
          quittanceTresor: "2419",
          faitA: "Libreville",
          dateFait: data.date_emission
            ? new Date(data.date_emission).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "N/A",
          signataire: data.signataire_info.nom_complet,
          role_signataire: data.signataire_info.role.nom_role,
          pour_ordre: data.pour_ordre,
          logoBase64: logoBase64,
        });
      },
      error: (error) => {
        console.error("Erreur lors de la récupération de la licence:", error);
        M.toast({
          html: "Erreur lors de la récupération de la licence",
          classes: "red",
        });
      },
    });
  }

  async printInfoBateau() {
    const logoBase64 = await this.imageHelper.getBase64ImageFromURL(
      "../../../assets/logo.jpg",
    );

    this.pdfBateau.open({
      bateau: this.bateau,
      licences: this.licences,
      logoBase64: logoBase64,
    });
  }
}
