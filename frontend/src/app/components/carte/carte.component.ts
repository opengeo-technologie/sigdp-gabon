import { Component, OnInit, AfterViewInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import * as L from "leaflet";
import "leaflet.markercluster";
import { DebarcadereService } from "../../services/debarcadere.service";
import { Debarcadere } from "../../models/debarcadere.model";
import { environment } from "../../../environments/environment";
declare var M: any;

interface CustomMarker extends L.Marker {
  myData: any;
}

@Component({
  selector: "app-carte",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./carte.component.html",
  styleUrl: "./carte.component.css",
})
export class CarteComponent implements OnInit, AfterViewInit, OnDestroy {
  private map?: L.Map;
  debarcaderes: Debarcadere[] = [];
  instanceModal: any;
  positionToUpdate: any;
  payload: any = {};
  // markerClusterGroup is provided by the leaflet.markercluster plugin and may not
  // be present in the @types/leaflet definitions. Cast L to any to access it.
  private markers: any = (L as any).markerClusterGroup();

  url: any = `${environment.apiUrl}/uploads/debarcaderes/`;

  constructor(private debarcadereService: DebarcadereService) {}

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
        this.debarcaderes = data;
        if (this.map) {
          this.addMarkers();
        }
      },
      error: (error) => {
        console.error("Erreur lors du chargement des débarcadères:", error);
      },
    });
  }

  private addMarkers() {
    if (!this.map) return;

    // Nettoyer les marqueurs existants
    this.markers.clearLayers();
    // this.markers = [];

    // Ajouter un marqueur pour chaque débarcadère
    this.debarcaderes.forEach((deb) => {
      const icon = this.getMarkerIcon(deb.milieu);

      const marker = L.marker([deb.latitude, deb.longitude], {
        icon,
        draggable: true,
      }).bindPopup(this.createPopupContent(deb)) as CustomMarker;

      marker.myData = deb;

      marker.on("dragend", (event: any) => {
        const position = event.target.getLatLng();

        // console.log(event.target);

        this.payload = {
          latitude: position.lat,
          longitude: position.lng,
        };

        console.log(event.target.myData);

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

      this.markers.addLayer(marker);
    });

    this.map.addLayer(this.markers);

    // Ajuster la vue pour inclure tous les marqueurs
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  private getMarkerIcon(milieu: string): L.DivIcon {
    let color = "#2196f3"; // Maritime par défaut

    if (milieu === "Continental") {
      color = "#4caf50";
    } else if (milieu === "Lagunaire") {
      color = "#00bcd4";
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
        <h6>${deb.denomination}</h6>
        <p><strong>Code:</strong> ${deb.code}</p>
        <p><strong>Type:</strong> ${deb.type}</p>
        <p><strong>Milieu:</strong> ${deb.milieu}</p>
        <p><strong>Province:</strong> ${deb.province}</p>
        ${infrastructures ? `<p><strong>Infrastructures:</strong><br>${infrastructures}</p>` : ""}
        <img src="${this.url + deb.photo_url}" alt="Photo de ${deb.denomination}" style="width: 100%; border-radius: 4px; margin-top: 0.5rem;" />
        <p style="margin-top: 1rem;">
          <a href="/debarcaderes/${deb.id}" style="color: #0d47a1; text-decoration: underline;">
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
}
