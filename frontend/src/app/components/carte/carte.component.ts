import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  NgZone,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import * as L from "leaflet";
import "leaflet.markercluster";
import { DebarcadereService } from "../../services/debarcadere.service";
import {
  Debarcadere,
  DebarcadereType,
  Milieu,
  StatutOperationnel,
} from "../../models/debarcadere.model";
import { environment } from "../../../environments/environment";
import { FormsModule } from "@angular/forms";
import { Chart, registerables } from "chart.js";
declare var M: any;

Chart.register(...registerables);

interface CustomMarker extends L.Marker {
  myData: any;
}

@Component({
  selector: "app-carte",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./carte.component.html",
  styleUrl: "./carte.component.css",
})
export class CarteComponent implements OnInit, AfterViewInit, OnDestroy {
  private map?: L.Map;
  debarcaderes: Debarcadere[] = [];

  top_5_especes: any = null;

  sidebarOpen = false;
  selectedDebarcadere: Debarcadere | null = null;
  instanceModal: any;
  positionToUpdate: any;
  infrastructures: any;
  statistiques: any[] = [];
  payload: any = {};
  filters = {
    milieu: "",
    province: "",
    type: "",
    statut: "",
  };

  types: DebarcadereType[] = [
    DebarcadereType.OFFICIEL,
    DebarcadereType.INFORMEL,
    DebarcadereType.SAISONNIER,
    DebarcadereType.CAPA,
  ];

  milieux: Milieu[] = [Milieu.MARITIME, Milieu.CONTINENTAL, Milieu.LAGUNAIRE];
  statuts: StatutOperationnel[] = [
    StatutOperationnel.ACTIF,
    StatutOperationnel.INACTIF,
    StatutOperationnel.EN_TRAVAUX,
  ];

  provinces: string[] = [
    "ESTUAIRE",
    "OGOOUE MARITIME",
    "HAUT OGOOUE",
    "NYANGA",
    "NGOUNIE",
    "MOYEN OGOOUE",
    "OGOOUE IVINDO",
    "OGOOUE LOLO",
    "WOLEU-NTEM",
  ];
  // markerClusterGroup is provided by the leaflet.markercluster plugin and may not
  // be present in the @types/leaflet definitions. Cast L to any to access it.
  private markers: any = (L as any).markerClusterGroup();
  private markersCAPA: L.Marker[] = [];

  url: any = `${environment.apiUrl}/uploads/debarcaderes/`;

  constructor(
    private debarcadereService: DebarcadereService,
    private ngZone: NgZone,
  ) {}

  ngOnInit() {
    this.loadDebarcaderes();
  }

  ngAfterViewInit() {
    this.initializeMap();
    this.initModals();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  openSidebar(d: Debarcadere): void {
    this.selectedDebarcadere = d;
    this.sidebarOpen = true;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  initModals() {
    const elem = document.getElementById("changeLocalisation");
    // console.log(elem);
    const options = {
      dismissible: false,
    };
    this.instanceModal = M.Modal.init(elem, options);
  }

  private initializeMap() {
    // Centre du Gabon (approximatif)
    const gabonCenter: L.LatLngExpression = [0.4162, 9.4673];

    // Initialiser la carte
    this.map = L.map("map").setView(gabonCenter, 6);

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
    if (this.debarcaderes.length > 0) {
      this.addMarkers();
    }
  }

  private loadDebarcaderes() {
    this.debarcadereService.getDebarcaderes().subscribe({
      next: (data) => {
        // console.log("Débarcadères chargés:", data);
        this.debarcaderes = data.result;
        if (this.map) {
          this.addMarkers();
        }
      },
      error: (error) => {
        console.error("Erreur lors du chargement des débarcadères:", error);
      },
    });
  }

  loadStatistiques(debarcadereId: number) {
    if (debarcadereId) {
      this.debarcadereService
        .getStatistiquesDebarcadere(debarcadereId)
        .subscribe({
          next: (data) => {
            // console.log(data);
            // this.statistiques = data;
            this.statistiques = data.top_5_especes;
          },
          error: (error) => {
            console.error("Erreur lors du chargement:", error);
            M.toast({
              html: "Erreur lors du chargement du débarcadère",
              classes: "red",
            });
            // this.router.navigate(["/debarcaderes"]);
          },
        });
    }
  }

  private addMarkers() {
    if (!this.map) return;

    // Nettoyer les marqueurs existants
    this.markers.clearLayers();
    this.markersCAPA = [];

    // Ajouter un marqueur pour chaque débarcadère
    this.debarcaderes.forEach((deb) => {
      const icon = this.getMarkerIcon(deb.milieu, deb.type);

      // const marker = L.marker([deb.latitude, deb.longitude], {
      //   icon,
      //   draggable: true,
      // }).bindPopup(this.createPopupContent(deb)) as CustomMarker;

      const marker = L.marker([deb.latitude, deb.longitude], {
        icon,
        draggable: true,
      }) as CustomMarker;

      marker.myData = deb;

      marker.on("click", () => {
        // Attention : on est hors de la zone Angular ici
        this.infrastructures = this.getInfrastructures(deb);
        this.loadStatistiques(deb.id);
        setTimeout(() => {
          this.initPieCaptureParzone();
        }, 500);

        this.ngZone.run(() => this.openSidebar(deb));
      });

      marker.on("dragend", (event: any) => {
        const position = event.target.getLatLng();

        // console.log(event.target);

        this.payload = {
          latitude: position.lat,
          longitude: position.lng,
        };

        // console.log(event.target.myData);

        this.positionToUpdate = event.target.myData;

        this.instanceModal.open();

        // this.http
        //   .put(`http://localhost:8000/points/${data.id}`, payload)
        //   .subscribe({
        //     next: () => {
        //       console.log("Coordinates updated");
        //     },
        //     error: (err) => {
        //       console.error(err);
        //     },
        //   });
      });

      if (deb.type === "Centre d'Appui à la Pêche Artisanale") {
        // this.map?.addLayer(marker);
        this.markersCAPA.push(marker);
      } else {
        this.markers.addLayer(marker);
      }

      // this.markers.addLayer(marker);
    });

    this.map.addLayer(this.markers);
    // this.map.addLayer(this.markersCAPA);
    this.markersCAPA.forEach((marker) => {
      this.map?.addLayer(marker);
    });

    // Ajuster la vue pour inclure tous les marqueurs
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  private getMarkerIcon(milieu: string, type: string = "none"): L.DivIcon {
    let color = "#2196f3"; // Maritime par défaut

    if (milieu === "Continental") {
      color = "#4caf50";
    } else if (milieu === "Lagunaire") {
      color = "#00bcd4";
    }

    if (type === "Centre d'Appui à la Pêche Artisanale") {
      color = "#ff0000";
    }

    return L.divIcon({
      className: "custom-marker",
      html: `
        <div style="
          width: 20px;
          height: 20px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -12],
    });
  }

  private createPopupContent(deb: Debarcadere): string {
    const infrastructures = this.getInfrastructures(deb);

    return `
      <div style="min-width: 200px;">
        <div style="text-align: center; margin-bottom: 0.5rem;" class="popup-header">
          <h6>${deb.denomination}</h6>
        </div>
        <p><strong>Code:</strong> ${deb.code}</p>
        <p><strong>Type:</strong> ${deb.type}</p>
        <p><strong>Milieu:</strong> ${deb.milieu}</p>
        <p><strong>Province:</strong> ${deb.province}</p>
        ${infrastructures ? `<p><strong>Infrastructures:</strong><br>${infrastructures}</p>` : ""}
  ${deb.photo_url ? `<img src="${this.url + deb.photo_url}" alt="Photo de ${deb.denomination}" style="width: 100%; border-radius: 4px; margin-top: 0.5rem;" />` : ""}
        <p style="margin-top: 1rem; text-align: center;">
          <a href="/debarcaderes/${deb.id}" class="btn btn-small blue accent-3
 white-text" style="color: #0d47a1; text-decoration: none;">
            Voir les détails
          </a>
        </p>
      </div>
    `;
  }

  private getInfrastructures(deb: Debarcadere): string {
    const infras: string[] = [];
    if (deb.infrastructure_quai) infras.push("Quai");
    if (deb.infrastructure_chambre_froide) infras.push("Chambre froide");
    if (deb.infrastructure_glace) infras.push("Glace");
    if (deb.infrastructure_marche) infras.push("Marché");
    if (deb.infrastructure_carburant) infras.push("Carburant");
    if (deb.infrastructure_eau) infras.push("Eau");
    if (deb.infrastructure_electricite) infras.push("Électricité");

    return infras.join(", ");
  }

  validateChange() {
    const formData = new FormData();
    formData.append("latitude", this.payload.latitude);
    formData.append("longitude", this.payload.longitude);
    this.debarcadereService
      .updateDebarcadere(this.positionToUpdate.id, this.payload)
      .subscribe({
        next: (response) => {
          M.toast({
            html: `Localisation du site modifiée`,
            classes: "green",
          });
        },
        error: (error) => {
          // console.error("Erreur lors de la création:", error);
          M.toast({ html: "Erreur lors de la modification", classes: "red" });
        },
      });
  }

  applyFilters() {
    // Filtrer les débarcadères en fonction des filtres sélectionnés
    const filteredDebarcaderes = this.debarcaderes.filter((deb) => {
      return (
        (this.filters.milieu === "" || deb.milieu === this.filters.milieu) &&
        (this.filters.province === "" ||
          deb.province === this.filters.province) &&
        (this.filters.type === "" || deb.type === this.filters.type) &&
        (this.filters.statut === "" ||
          deb.statut_operationnel === this.filters.statut)
      );
    });

    // Mettre à jour les marqueurs sur la carte
    this.markers.clearLayers();
    this.markersCAPA.forEach((marker) => {
      this.map?.removeLayer(marker);
    });
    this.markersCAPA = [];
    filteredDebarcaderes.forEach((deb) => {
      const icon = this.getMarkerIcon(deb.milieu, deb.type);
      // const marker = L.marker([deb.latitude, deb.longitude], {
      //   icon,
      //   draggable: true,
      // }).bindPopup(this.createPopupContent(deb)) as CustomMarker;

      const marker = L.marker([deb.latitude, deb.longitude], {
        icon,
        draggable: true,
      }) as CustomMarker;

      marker.myData = deb;

      marker.on("click", () => {
        // Attention : on est hors de la zone Angular ici
        this.infrastructures = this.getInfrastructures(deb);
        this.loadStatistiques(deb.id);
        setTimeout(() => {
          this.initPieCaptureParzone();
        }, 500);
        this.ngZone.run(() => this.openSidebar(deb));
      });

      marker.on("dragend", (event: any) => {
        const position = event.target.getLatLng();
        this.payload = {
          latitude: position.lat,
          longitude: position.lng,
        };
        this.positionToUpdate = event.target.myData;
        this.instanceModal.open();
      });

      if (deb.type === "Centre d'Appui à la Pêche Artisanale") {
        this.markersCAPA.push(marker);
      } else {
        this.markers.addLayer(marker);
      }
    });

    this.markersCAPA.forEach((marker) => {
      this.map?.addLayer(marker);
    });

    // Ajuster la vue pour inclure tous les marqueurs filtrés
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map?.fitBounds(group.getBounds().pad(0.1));
    }
  }

  initPieCaptureParzone() {
    const canvas = document.getElementById("pieChart") as HTMLCanvasElement;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      // ✅ Extraire données
      const labels = this.statistiques.map((d: any) => d.nom_commun_francais);
      const values = this.statistiques.map((d: any) => d.quantite_tonnes);

      // ✅ AJOUTER CECI
      const total = values.reduce((a: any, b: any) => a + b, 0);
      const percentages = values.map((v: any) =>
        ((v / total) * 100).toFixed(1),
      );

      const labelsWithPercent = labels.map(
        (label: any, i: any) => `${label} (${percentages[i]}%)`,
      );

      this.top_5_especes = new Chart(ctx, {
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
              position: "bottom", // right, top, bottom, left
            },
            title: {
              display: true,
              text: "Top 5 espèces du débarcadère",
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
}
