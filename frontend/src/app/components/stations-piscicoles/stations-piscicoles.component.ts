// stations-piscicoles.component.ts
import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";

import { StationPiscicoleService } from "../../services/stations-piscicole.service";
import {
  StationPiscicole,
  StationListRequest,
  TYPE_STATION_LABELS,
  STATUT_STATION_LABELS,
  STATUT_STATION_COLORS,
  PROVINCES_GABON,
  ESPECES_DISPONIBLES,
} from "../../models/stations-piscicole.model";
import { HasPermissionDirective } from "../../directives/has-permission.directive";
import { PermissionsRolesService } from "../../services/permissions-roles.service";
import { AuthService } from "../../services/auth.service";

declare const M: any;

@Component({
  selector: "app-stations-piscicoles",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./stations-piscicoles.component.html",
  styleUrl: "./stations-piscicoles.component.scss",
})
export class StationsPiscicolesComponent {
  private service = inject(StationPiscicoleService);
  private permissionService = inject(AuthService);
  private router = inject(Router);

  stations: StationPiscicole[] = [];
  total = 0;
  chargement = false;

  filtres: StationListRequest = {
    search: "",
    province: "",
    type_station: "",
    statut: "",
    espece: "",
    page: 1,
    page_size: 10,
  };

  provinces = PROVINCES_GABON;
  especes = ESPECES_DISPONIBLES;
  typesStation = Object.keys(TYPE_STATION_LABELS);
  statuts = Object.keys(STATUT_STATION_LABELS);
  typeLabels = TYPE_STATION_LABELS;
  statutLabels = STATUT_STATION_LABELS;
  statutColors = STATUT_STATION_COLORS;

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement = true;
    // Ne transmettre que les filtres renseignés (le backend attend null/absent, pas '')
    const payload: StationListRequest = {
      ...this.filtres,
      search: this.filtres.search || undefined,
      province: this.filtres.province || undefined,
      type_station: this.filtres.type_station || undefined,
      statut: this.filtres.statut || undefined,
      espece: this.filtres.espece || undefined,
    };

    this.service.lister(payload).subscribe({
      next: (res) => {
        this.stations = res.items;
        this.total = res.total;
        this.chargement = false;
        // Réinitialiser les selects Materialize après rendu du DOM
        setTimeout(
          () => M.FormSelect.init(document.querySelectorAll("select")),
          0,
        );
      },
      error: () => {
        this.chargement = false;
        M.toast({
          html: "Erreur lors du chargement des stations",
          classes: "red",
        });
      },
    });
  }

  rechercher(): void {
    this.filtres.page = 1;
    this.charger();
  }

  hasPermission(permission: string): boolean {
    return this.permissionService.hasPermission(permission);
  }

  changerPage(page: number): void {
    if (page < 1 || page > this.nbPages()) return;
    this.filtres.page = page;
    this.charger();
  }

  nbPages(): number {
    return Math.max(1, Math.ceil(this.total / this.filtres.page_size));
  }

  pages(): number[] {
    return Array.from({ length: this.nbPages() }, (_, i) => i + 1);
  }

  splitEspeces(especes?: string): string[] {
    return especes ? especes.split(",").filter((e) => e.trim()) : [];
  }

  supprimer(station: StationPiscicole): void {
    if (
      !confirm(
        `Supprimer la station ${station.code_station} — ${station.nom} ?\n` +
          `Tous ses cycles de production seront également supprimés.`,
      )
    ) {
      return;
    }
    this.service.supprimer(station.id).subscribe({
      next: (res) => {
        M.toast({ html: res.message, classes: "green" });
        this.charger();
      },
      error: (err) => {
        M.toast({
          html: err?.error?.detail || "Erreur lors de la suppression",
          classes: "red",
        });
      },
    });
  }
}
