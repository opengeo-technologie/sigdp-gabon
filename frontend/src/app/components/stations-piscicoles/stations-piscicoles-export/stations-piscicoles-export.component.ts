// station-piscicole-export.component.ts
// Route à ajouter dans station-piscicole.routes.ts AVANT le path ':id' :
//   {
//     path: 'exporter',
//     loadComponent: () =>
//       import('./station-piscicole-export.component')
//         .then(m => m.StationPiscicoleExportComponent),
//     title: 'Exporter les stations — SIGDP-GABON',
//   },
import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { RouterLink } from "@angular/router";

import { environment } from "../../../../environments/environment";
import { StationPiscicoleService } from "../../../services/stations-piscicole.service";
import {
  TYPE_STATION_LABELS,
  STATUT_STATION_LABELS,
  PROVINCES_GABON,
  ESPECES_DISPONIBLES,
} from "../../../models/stations-piscicole.model";

declare const M: any;

interface FormatExport {
  id: "excel" | "csv" | "json" | "pdf";
  extension: string;
  titre: string;
  description: string;
  icone: string;
  couleur: string;
}

@Component({
  selector: "app-stations-piscicoles-export",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./stations-piscicoles-export.component.html",
  styleUrl: "./stations-piscicoles-export.component.scss",
})
export class StationsPiscicolesExportComponent {
  private http = inject(HttpClient);
  private service = inject(StationPiscicoleService);
  private baseUrl = `${environment.apiUrl}/api/stations-piscicoles/export`;

  filtres = {
    search: "",
    province: "",
    type_station: "",
    statut: "",
    espece: "",
  };
  comptage: number | null = null;
  enCours: string | null = null;

  provinces = PROVINCES_GABON;
  especes = ESPECES_DISPONIBLES;
  typesStation = Object.keys(TYPE_STATION_LABELS);
  statuts = Object.keys(STATUT_STATION_LABELS);
  typeLabels = TYPE_STATION_LABELS;
  statutLabels = STATUT_STATION_LABELS;

  formats: FormatExport[] = [
    {
      id: "excel",
      extension: "xlsx",
      titre: "Excel",
      icone: "grid_on",
      couleur: "green",
      description:
        "Classeur avec filtres automatiques et en-têtes figés. " +
        "Réimportable dans SIGDP.",
    },
    {
      id: "csv",
      extension: "csv",
      titre: "CSV / Texte",
      icone: "notes",
      couleur: "blue-grey",
      description:
        "Texte séparé par « ; », encodage compatible Excel français. " +
        "Pour les traitements externes.",
    },
    {
      id: "json",
      extension: "json",
      titre: "JSON",
      icone: "data_object",
      couleur: "indigo",
      description:
        "Données brutes avec valeurs techniques, pour les échanges " +
        "entre systèmes et sauvegardes.",
    },
    {
      id: "pdf",
      extension: "pdf",
      titre: "PDF",
      icone: "picture_as_pdf",
      couleur: "red",
      description:
        "Registre officiel avec en-tête du Ministère, pour " +
        "impression et diffusion.",
    },
  ];

  ngOnInit(): void {
    setTimeout(() => M.FormSelect.init(document.querySelectorAll("select")), 0);
    this.compter();
  }

  private filtresNettoyes() {
    return {
      search: this.filtres.search || undefined,
      province: this.filtres.province || undefined,
      type_station: this.filtres.type_station || undefined,
      statut: this.filtres.statut || undefined,
      espece: this.filtres.espece || undefined,
    };
  }

  filtresActifs(): boolean {
    return !!(
      this.filtres.search ||
      this.filtres.province ||
      this.filtres.type_station ||
      this.filtres.statut ||
      this.filtres.espece
    );
  }

  reinitialiserFiltres(): void {
    this.filtres = {
      search: "",
      province: "",
      type_station: "",
      statut: "",
      espece: "",
    };
    setTimeout(() => M.FormSelect.init(document.querySelectorAll("select")), 0);
    this.compter();
  }

  compter(): void {
    this.comptage = null;
    // Le total de /list avec page_size=1 donne le comptage sans charger les données
    this.service
      .lister({ ...this.filtresNettoyes(), page: 1, page_size: 1 })
      .subscribe({
        next: (res) => (this.comptage = res.total),
        error: () => {
          this.comptage = 0;
          M.toast({ html: "Erreur lors du comptage", classes: "red" });
        },
      });
  }

  exporter(format: FormatExport): void {
    this.enCours = format.id;
    this.http
      .post(`${this.baseUrl}/${format.id}`, this.filtresNettoyes(), {
        responseType: "blob",
      })
      .subscribe({
        next: (blob) => {
          this.enCours = null;
          const d = new Date();
          const horodatage =
            `${d.getFullYear()}` +
            `${String(d.getMonth() + 1).padStart(2, "0")}` +
            `${String(d.getDate()).padStart(2, "0")}`;
          const url = URL.createObjectURL(blob);
          const lien = document.createElement("a");
          lien.href = url;
          lien.download = `stations_piscicoles_${horodatage}.${format.extension}`;
          lien.click();
          URL.revokeObjectURL(url);
          M.toast({
            html: `Export ${format.titre} téléchargé (${this.comptage} station(s))`,
            classes: "green",
          });
        },
        error: () => {
          this.enCours = null;
          M.toast({
            html: `Erreur lors de l'export ${format.titre}`,
            classes: "red",
          });
        },
      });
  }
}
