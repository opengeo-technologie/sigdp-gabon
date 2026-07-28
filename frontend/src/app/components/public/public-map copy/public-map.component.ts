import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { DecimalPipe } from "@angular/common";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import * as L from "leaflet";
import type * as LeafletNS from "leaflet";
import type { Feature, MultiPolygon } from "geojson";
import "leaflet.markercluster";

import { ZoneGeographiqueService } from "../../../services/zone-geographique.service";

import {
  COUCHES,
  type ConfigCouche,
  type ProprietesZone,
  type TypeZone,
  type ZoneLocalisee,
} from "../../../models/zone.model";

declare var M: any;

@Component({
  selector: "app-public-map",
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./public-map.component.html",
  styleUrl: "./public-map.component.scss",
})
export class PublicMapComponent {
  private map?: L.Map;
  currentRoute: string = "";
  stats = {
    debarcaderes: 0,
    pecheurs: 0,
    bateaux: 0,
    captures: 0,
  };

  private readonly zonesService = inject(ZoneGeographiqueService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private maxBounds = L.latLngBounds(L.latLng(-4.2, 8.5), L.latLng(2.3, 14.6));

  ngOnInit(): void {
    //Called after the constructor, initializing input properties, and the first call to ngOnChanges.
    //Add 'implements OnInit' to the class.
    setTimeout(() => {
      if (typeof M !== "undefined") {
        M.Sidenav.init(document.querySelectorAll(".sidenav"), {});
      }
    }, 100);
    this.initializeMap();
  }

  private initializeMap() {
    // Centre du Gabon (approximatif)
    const gabonCenter: L.LatLngExpression = [-0.8, 11.6];

    // Initialiser la carte
    this.map = L.map("map", {
      zoom: 7,
      minZoom: 7,
      zoomControl: true, // Disable default zoom control
      maxBounds: this.maxBounds,
    }).setView(gabonCenter, 7);

    /*
     * OpenStreetMap
     */
    const osm = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 18,
      },
    );

    /*
     * Satellite ESRI
     */
    const esriSatellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/" +
        "World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles © Esri",
        maxZoom: 21,
      },
    );

    /*
     * Carto Dark
     */
    const cartoDark = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        attribution: "&copy; CARTO",
      },
    );

    /*
     * OpenTopoMap
     */
    const topo = L.tileLayer(
      "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      {
        attribution: "&copy; OpenTopoMap",
      },
    );

    /*
     * Fond par défaut
     */
    osm.addTo(this.map);

    /*
     * Contrôle des couches
     */
    const baseMaps = {
      OpenStreetMap: osm,
      Satellite: esriSatellite,
      Dark: cartoDark,
      Topo: topo,
    };

    L.control.layers(baseMaps).addTo(this.map);

    // Ajouter les marqueurs si les débarcadères sont déjà chargés
    // if (this.debarcaderes.length > 0) {
    //   this.addMarkers();
    // }
  }

  toggleSidebar() {
    const layout = document.getElementById("layout");
    const toggle = document.getElementById("panel-toggle");
    const petitEcran = window.matchMedia("(max-width: 992px)");
    const sidePanel = document.getElementById("side-panel");

    if (!layout || !toggle || !sidePanel) {
      return;
    }

    var collapsed = layout.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute(
      "aria-label",
      collapsed
        ? "Afficher le panneau de statistiques"
        : "Replier le panneau de statistiques",
    );
    toggle.setAttribute(
      "title",
      collapsed ? "Afficher le panneau" : "Replier le panneau",
    );

    // En mobile le panneau s'ouvre au-dessus de la carte : on l'amène à l'écran,
    // sinon le bouton est en bas et le contenu révélé passe inaperçu.
    if (petitEcran.matches && !collapsed) {
      sidePanel.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }
  }
}
