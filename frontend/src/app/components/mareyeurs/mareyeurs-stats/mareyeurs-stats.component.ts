// mareyeur-stats.component.ts
import { CommonModule } from "@angular/common";
import { Component, OnInit, inject } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ChartCanvasComponent } from "../chart-canvas/chart-canvas.component";
import {
  FiltreStatistiques,
  StatistiquesMareyeurs,
} from "../../../models/mareyeur-stats.model";
import { MareyeurStatsService } from "../../../services/mareyeur-stats.service";

@Component({
  selector: "app-mareyeur-stats",
  standalone: true,
  imports: [CommonModule, FormsModule, ChartCanvasComponent],
  templateUrl: "./mareyeurs-stats.component.html",
  styleUrl: "./mareyeurs-stats.component.scss",
})
export class MareyeurStatsComponent implements OnInit {
  private service = inject(MareyeurStatsService);

  filtre: FiltreStatistiques = { date_debut: null, date_fin: null, top_n: 10 };
  stats?: StatistiquesMareyeurs;

  chargement = false;
  export = false;
  erreur: string | null = null;

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement = true;
    this.erreur = null;
    this.service.getStatistiques(this.nettoyerFiltre()).subscribe({
      next: (s) => {
        this.stats = s;
        this.chargement = false;
      },
      error: () => {
        this.erreur = "Impossible de charger les statistiques.";
        this.chargement = false;
      },
    });
  }

  reinitialiser(): void {
    this.filtre = { date_debut: null, date_fin: null, top_n: 10 };
    this.charger();
  }

  telecharger(): void {
    this.export = true;
    this.erreur = null;
    this.service.exporterPdf(this.nettoyerFiltre()).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rapport_statistique_mareyeurs_${this.horodatage()}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.export = false;
      },
      error: () => {
        this.erreur = "Échec de la génération du PDF.";
        this.export = false;
      },
    });
  }

  /** N'envoie que les champs renseignés. */
  private nettoyerFiltre(): FiltreStatistiques {
    const f: FiltreStatistiques = { top_n: this.filtre.top_n ?? 10 };
    if (this.filtre.date_debut) f.date_debut = this.filtre.date_debut;
    if (this.filtre.date_fin) f.date_fin = this.filtre.date_fin;
    return f;
  }

  private horodatage(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  // ---- Formatage pour l'affichage ----
  fmt(v: number | null | undefined): string {
    return new Intl.NumberFormat("fr-FR").format(Number(v ?? 0));
  }

  fcfa(v: number | null | undefined): string {
    return `${this.fmt(v)} FCFA`;
  }
}
