import { Component, OnInit, AfterViewInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import * as L from "leaflet";
import { DebarcadereService } from "../../services/debarcadere.service";
import { Debarcadere } from "../../models/debarcadere.model";
import { environment } from "../../../environments/environment";

@Component({
  selector: "app-carte",
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1><i class="material-icons left">map</i> Carte des débarcadères</h1>
        <p>Visualisation géographique des débarcadères du Gabon</p>
      </div>
    </div>

    <div class="container-fluid">
      <!-- Légende et filtres -->
      <div class="card">
        <div class="card-content">
          <div class="row">
            <div class="col s12 m8">
              <span class="card-title">Légende</span>
              <div class="legend-items">
                <span class="legend-item">
                  <span class="marker-icon maritime"></span>
                  Maritime
                </span>
                <span class="legend-item">
                  <span class="marker-icon fluvial"></span>
                  Fluvial
                </span>
                <span class="legend-item">
                  <span class="marker-icon lagunaire"></span>
                  Lagunaire
                </span>
              </div>
            </div>
            <div class="col s12 m4 right-align">
              <p>
                <strong>Total:</strong> {{ debarcaderes.length }} débarcadère(s)
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Carte -->
      <div class="card">
        <div class="card-content">
          <div id="map" class="map-container"></div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .map-container {
        height: 600px;
        border-radius: 8px;
      }

      .legend-items {
        display: flex;
        gap: 2rem;
        flex-wrap: wrap;
        margin-top: 1rem;
      }

      .legend-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .marker-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .marker-icon.maritime {
        background-color: #2196f3;
      }

      .marker-icon.fluvial {
        background-color: #4caf50;
      }

      .marker-icon.lagunaire {
        background-color: #00bcd4;
      }

      :host ::ng-deep .leaflet-popup-content-wrapper {
        border-radius: 8px;
      }

      :host ::ng-deep .leaflet-popup-content h6 {
        margin: 0 0 0.5rem 0;
        color: #0d47a1;
        font-weight: 500;
      }

      :host ::ng-deep .leaflet-popup-content p {
        margin: 0.25rem 0;
        font-size: 0.9rem;
      }
    `,
  ],
})
export class CarteComponent implements OnInit, AfterViewInit, OnDestroy {
  private map?: L.Map;
  debarcaderes: Debarcadere[] = [];
  private markers: L.Marker[] = [];

  url: any = `${environment.apiUrl}/uploads/debarcaderes/`;

  constructor(private debarcadereService: DebarcadereService) {}

  ngOnInit() {
    this.loadDebarcaderes();
  }

  ngAfterViewInit() {
    this.initializeMap();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  private initializeMap() {
    // Centre du Gabon (approximatif)
    const gabonCenter: L.LatLngExpression = [0.4162, 9.4673];

    // Initialiser la carte
    this.map = L.map("map").setView(gabonCenter, 6);

    // Ajouter le layer OpenStreetMap
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(this.map);

    // Ajouter les marqueurs si les débarcadères sont déjà chargés
    if (this.debarcaderes.length > 0) {
      this.addMarkers();
    }
  }

  private loadDebarcaderes() {
    this.debarcadereService.getDebarcaderes().subscribe({
      next: (data) => {
        console.log("Débarcadères chargés:", data);
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
    this.markers.forEach((marker) => marker.remove());
    this.markers = [];

    // Ajouter un marqueur pour chaque débarcadère
    this.debarcaderes.forEach((deb) => {
      const icon = this.getMarkerIcon(deb.milieu);

      const marker = L.marker([deb.latitude, deb.longitude], { icon })
        .addTo(this.map!)
        .bindPopup(this.createPopupContent(deb));

      this.markers.push(marker);
    });

    // Ajuster la vue pour inclure tous les marqueurs
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  private getMarkerIcon(milieu: string): L.DivIcon {
    let color = "#2196f3"; // Maritime par défaut

    if (milieu === "Fluvial") {
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
}
