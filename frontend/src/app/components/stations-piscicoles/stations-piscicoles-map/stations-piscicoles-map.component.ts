// station-piscicole-map.component.ts
import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import * as L from "leaflet";

import { StationPiscicoleService } from "../../../services/stations-piscicole.service";
import {
  StationPiscicole,
  TYPE_STATION_LABELS,
  STATUT_STATION_LABELS,
} from "../../../models/stations-piscicole.model";

declare const M: any;

// Couleurs des marqueurs par statut (hex, pour les divIcons)
const COULEURS_STATUT: Record<string, string> = {
  EN_CONSTRUCTION: "#fb8c00", // orange
  ACTIVE: "#43a047", // vert
  SUSPENDUE: "#f9a825", // ambre
  FERMEE: "#e53935", // rouge
};

@Component({
  selector: "app-stations-piscicoles-map",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./stations-piscicoles-map.component.html",
  styleUrl: "./stations-piscicoles-map.component.scss",
})
export class StationsPiscicolesMapComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  private service = inject(StationPiscicoleService);
  private router = inject(Router);

  private carte: L.Map | null = null;
  private groupeMarqueurs: L.LayerGroup = L.layerGroup();
  private marqueurs = new Map<number, L.Marker>(); // station.id -> marqueur

  stations: StationPiscicole[] = [];
  nbSansCoordonnees = 0;

  statuts = Object.keys(STATUT_STATION_LABELS);
  statutLabels = STATUT_STATION_LABELS;
  statutsVisibles = new Set<string>(Object.keys(STATUT_STATION_LABELS));

  ngOnInit(): void {
    // Charger toutes les stations (page unique large — ajuster si > 100 stations)
    this.service.lister({ page: 1, page_size: 100 }).subscribe({
      next: (res) => {
        this.stations = res.items;
        this.afficherMarqueurs();
      },
      error: () =>
        M.toast({ html: "Erreur lors du chargement", classes: "red" }),
    });
  }

  ngAfterViewInit(): void {
    this.carte = L.map("carte-stations").setView([-0.6, 11.6], 7); // centre Gabon

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(this.carte);

    this.groupeMarqueurs.addTo(this.carte);
    this.afficherMarqueurs();
  }

  ngOnDestroy(): void {
    // Nettoyage : détruire la carte pour éviter les fuites au retour sur la page
    if (this.carte) {
      this.carte.remove();
      this.carte = null;
    }
    this.marqueurs.clear();
  }

  private creerIcone(statut: string): L.DivIcon {
    const couleur = COULEURS_STATUT[statut] || "#607d8b";
    return L.divIcon({
      className: "",
      html: `<div style="
        width: 18px; height: 18px; border-radius: 50%;
        background: ${couleur}; border: 2px solid white;
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  private afficherMarqueurs(): void {
    if (!this.carte || this.stations.length === 0) return;

    this.groupeMarqueurs.clearLayers();
    this.marqueurs.clear();
    this.nbSansCoordonnees = 0;

    const positions: L.LatLngExpression[] = [];

    for (const station of this.stations) {
      // Filtrer les coordonnées nulles/invalides — évite le cluster à (0,0)
      if (
        station.latitude == null ||
        station.longitude == null ||
        (station.latitude === 0 && station.longitude === 0)
      ) {
        this.nbSansCoordonnees++;
        continue;
      }
      if (!this.statutsVisibles.has(station.statut)) continue;

      const marqueur = L.marker([station.latitude, station.longitude], {
        icon: this.creerIcone(station.statut),
      });

      const especes = station.especes_elevees
        ? station.especes_elevees.split(",").join(", ")
        : "—";

      marqueur.bindPopup(`
        <strong>${station.nom}</strong><br>
        <small>${station.code_station} — ${TYPE_STATION_LABELS[station.type_station]}</small><br>
        <small>${station.province}${station.localite ? " / " + station.localite : ""}</small><br>
        Espèces : ${especes}<br>
        Statut : <strong>${STATUT_STATION_LABELS[station.statut]}</strong><br>
        <a href="#" data-station-id="${station.id}" class="lien-fiche-station">
          Voir la fiche</a>
      `);

      // Navigation Angular depuis le popup (les href classiques rechargeraient l'app)
      marqueur.on("popupopen", () => {
        const lien = document.querySelector(
          `.lien-fiche-station[data-station-id="${station.id}"]`,
        );
        lien?.addEventListener("click", (e) => {
          e.preventDefault();
          this.router.navigate(["/stations-piscicoles", station.id, "details"]);
        });
      });

      marqueur.addTo(this.groupeMarqueurs);
      this.marqueurs.set(station.id, marqueur);
      positions.push([station.latitude, station.longitude]);
    }

    // Ajuster la vue sur l'ensemble des marqueurs visibles
    if (positions.length > 0) {
      this.carte.fitBounds(L.latLngBounds(positions), {
        padding: [40, 40],
        maxZoom: 10,
      });
    }
  }

  basculerStatut(statut: string): void {
    if (this.statutsVisibles.has(statut)) {
      this.statutsVisibles.delete(statut);
    } else {
      this.statutsVisibles.add(statut);
    }
    this.afficherMarqueurs();
  }
}
