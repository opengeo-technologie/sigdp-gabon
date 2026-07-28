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
// import * as L from "leaflet";
import type * as LeafletNS from "leaflet";
import type { Feature, MultiPolygon } from "geojson";
// import "leaflet.markercluster";

import { ZoneGeographiqueService } from "../../../services/zone-geographique.service";

import {
  COUCHES,
  type ConfigCouche,
  type ProprietesZone,
  type TypeZone,
  type ZoneLocalisee,
} from "../../../models/zone.model";

/** Cadrage initial : Gabon continental + emprise maritime de la ZEE. */
const CENTRE: [number, number] = [-0.8, 10.2];
const ZOOM_INITIAL = 6;

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
  /** Passer l'état du panneau latéral : la carte se redimensionne toute seule. */
  readonly panneauReplie = input(false);

  private readonly conteneur =
    viewChild.required<ElementRef<HTMLDivElement>>("conteneurCarte");

  private readonly zonesService = inject(ZoneGeographiqueService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private L!: typeof LeafletNS;
  private carte?: LeafletNS.Map;
  private readonly groupes = new Map<TypeZone, LeafletNS.GeoJSON>();
  private marqueurClic?: LeafletNS.CircleMarker;
  private observateurTaille?: ResizeObserver;

  readonly couches = COUCHES;
  readonly visibilite = signal<Record<TypeZone, boolean>>(
    Object.fromEntries(
      COUCHES.map((c) => [c.type, c.visibleParDefaut]),
    ) as Record<TypeZone, boolean>,
  );

  readonly chargement = signal<TypeZone[]>([]);
  readonly erreur = signal<string | null>(null);
  readonly zonesAuPoint = signal<ZoneLocalisee[] | null>(null);
  readonly pointInterroge = signal<{ lat: number; lon: number } | null>(null);
  readonly fondSatellite = signal(false);

  readonly enChargement = computed(() => this.chargement().length > 0);

  private fondOSM?: LeafletNS.TileLayer;
  private fondSat?: LeafletNS.TileLayer;

  stats = {
    debarcaderes: 0,
    pecheurs: 0,
    bateaux: 0,
    captures: 0,
  };

  constructor() {
    afterNextRender(() => void this.initialiserCarte());

    // Le repli du panneau latéral change la largeur du conteneur : sans
    // invalidateSize(), Leaflet garde l'ancienne taille et les tuiles se
    // décalent. Le ResizeObserver couvre aussi le redimensionnement fenêtre.
    effect(() => {
      this.panneauReplie();
      queueMicrotask(() => this.carte?.invalidateSize({ animate: false }));
    });

    effect(() => {
      const etats = this.visibilite();
      if (!this.carte) {
        return;
      }
      for (const config of COUCHES) {
        etats[config.type]
          ? this.afficherCouche(config)
          : this.masquerCouche(config.type);
      }
    });

    effect(() => {
      const satellite = this.fondSatellite();
      if (!this.carte || !this.fondOSM || !this.fondSat) {
        return;
      }
      this.carte.removeLayer(satellite ? this.fondOSM : this.fondSat);
      this.carte.addLayer(satellite ? this.fondSat : this.fondOSM);
    });

    this.destroyRef.onDestroy(() => {
      this.observateurTaille?.disconnect();
      this.carte?.remove();
    });
  }

  // ------------------------------------------------------------------
  // Initialisation
  // ------------------------------------------------------------------
  private async initialiserCarte(): Promise<void> {
    // Import dynamique : Leaflet touche au DOM et casserait un rendu SSR.
    this.L = await import("leaflet");

    // Hors zone Angular : les événements de déplacement/zoom déclencheraient
    // une détection de changement à chaque frame.
    this.zone.runOutsideAngular(() => {
      const carte = this.L.map(this.conteneur().nativeElement, {
        center: CENTRE,
        zoom: ZOOM_INITIAL,
        minZoom: 4,
        maxZoom: 18,
        zoomControl: false,
        // Rendu canvas : indispensable avec des polygones à plusieurs
        // dizaines de milliers de sommets (ZEE, frontières).
        preferCanvas: true,
        attributionControl: true,
      });

      this.fondOSM = this.L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap", maxZoom: 19 },
      );
      this.fondSat = this.L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "© Esri", maxZoom: 18 },
      );
      this.fondOSM.addTo(carte);

      this.L.control.zoom({ position: "bottomright" }).addTo(carte);
      this.L.control
        .scale({ imperial: false, position: "bottomleft" })
        .addTo(carte);

      // Un pane par couche : l'ordre d'empilement devient déterministe,
      // quel que soit l'ordre de chargement des requêtes HTTP.
      for (const config of COUCHES) {
        const pane = carte.createPane(`pane-${config.type}`);
        pane.style.zIndex = String(config.zIndex);
      }

      carte.on("click", (evt: LeafletNS.LeafletMouseEvent) => {
        this.zone.run(() =>
          this.interrogerPoint(evt.latlng.lat, evt.latlng.lng),
        );
      });

      this.carte = carte;

      this.observateurTaille = new ResizeObserver(() =>
        carte.invalidateSize({ animate: false }),
      );
      this.observateurTaille.observe(this.conteneur().nativeElement);
    });

    // Chargement initial des couches visibles par défaut.
    for (const config of COUCHES.filter((c) => this.visibilite()[c.type])) {
      this.afficherCouche(config);
    }
  }

  // ------------------------------------------------------------------
  // Couches
  // ------------------------------------------------------------------
  private afficherCouche(config: ConfigCouche): void {
    const existante = this.groupes.get(config.type);
    if (existante) {
      if (this.carte && !this.carte.hasLayer(existante)) {
        existante.addTo(this.carte);
      }
      return;
    }
    if (this.chargement().includes(config.type)) {
      return;
    }

    this.chargement.update((liste) => [...liste, config.type]);

    this.zonesService
      .chargerCouche(config.type, config.tolerance)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (collection) => {
          this.chargement.update((l) => l.filter((t) => t !== config.type));
          if (!this.carte || !collection.features?.length) {
            return;
          }

          // PolylineOptions étend PathOptions : smoothFactor y est admis.
          const styleCouche: LeafletNS.PolylineOptions = {
            color: config.couleur,
            weight: config.epaisseur,
            opacity: 0.9,
            fillColor: config.couleurRemplissage,
            fillOpacity: config.opaciteRemplissage,
            dashArray: config.pointilles,
            smoothFactor: 1.5,
          };

          const groupe = this.L.geoJSON<ProprietesZone, MultiPolygon>(
            collection,
            {
              pane: `pane-${config.type}`,
              // Lissage agressif au petit zoom : moins de sommets rendus.
              style: () => styleCouche,
              onEachFeature: (feature, couche) => {
                couche.bindPopup(this.contenuInfobulle(feature, config), {
                  maxWidth: 280,
                  className: "popup-zone",
                });
                couche.on({
                  mouseover: (e) =>
                    (e.target as LeafletNS.Path).setStyle({
                      weight: config.epaisseur + 1.5,
                      fillOpacity: Math.min(
                        config.opaciteRemplissage + 0.2,
                        0.7,
                      ),
                    }),
                  mouseout: (e) =>
                    (e.target as LeafletNS.Path).setStyle({
                      weight: config.epaisseur,
                      fillOpacity: config.opaciteRemplissage,
                    }),
                });
              },
            },
          );

          this.groupes.set(config.type, groupe);
          if (this.visibilite()[config.type]) {
            groupe.addTo(this.carte);
          }
        },
        error: () => {
          this.chargement.update((l) => l.filter((t) => t !== config.type));
          this.erreur.set(`Chargement impossible : ${config.libelle}.`);
        },
      });
  }

  private masquerCouche(type: TypeZone): void {
    const groupe = this.groupes.get(type);
    if (groupe && this.carte?.hasLayer(groupe)) {
      this.carte.removeLayer(groupe);
    }
  }

  private contenuInfobulle(
    feature: Feature<MultiPolygon, ProprietesZone>,
    config: ConfigCouche,
  ): string {
    const p = feature.properties;
    const superficie =
      p.superficie_km2 != null
        ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(p.superficie_km2)} km²`
        : "—";
    return `
      <div class="infobulle-zone">
        <span class="pastille" style="background:${config.couleur}"></span>
        <strong>${this.echapper(p.nom)}</strong>
        <div class="libelle-couche">${config.libelle}</div>
        <dl>
          ${p.code ? `<dt>Code</dt><dd>${this.echapper(p.code)}</dd>` : ""}
          <dt>Superficie</dt><dd>${superficie}</dd>
        </dl>
      </div>`;
  }

  /** Les noms viennent d'un .dbf importé : on ne fait pas confiance au contenu. */
  private echapper(valeur: string): string {
    const div = document.createElement("div");
    div.textContent = valeur;
    return div.innerHTML;
  }

  // ------------------------------------------------------------------
  // Interactions
  // ------------------------------------------------------------------
  basculerCouche(type: TypeZone): void {
    this.visibilite.update((etats) => ({ ...etats, [type]: !etats[type] }));
  }

  zoomerSurCouche(type: TypeZone): void {
    const groupe = this.groupes.get(type);
    if (groupe && this.carte) {
      this.carte.fitBounds(groupe.getBounds(), { padding: [24, 24] });
    }
  }

  reinitialiserVue(): void {
    this.carte?.setView(CENTRE, ZOOM_INITIAL);
    this.effacerPoint();
  }

  private interrogerPoint(lat: number, lon: number): void {
    this.pointInterroge.set({ lat, lon });
    this.zonesAuPoint.set(null);

    if (this.carte) {
      this.marqueurClic?.remove();
      // CircleMarker plutôt que Marker : évite le bug classique des icônes
      // Leaflet introuvables après build Angular.
      this.marqueurClic = this.L.circleMarker([lat, lon], {
        radius: 6,
        color: "#ffffff",
        weight: 2,
        fillColor: "#e53935",
        fillOpacity: 1,
      }).addTo(this.carte);
    }

    this.zonesService
      .localiser(lat, lon)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reponse) => this.zonesAuPoint.set(reponse.zones),
        error: () => this.zonesAuPoint.set([]),
      });
  }

  effacerPoint(): void {
    this.marqueurClic?.remove();
    this.marqueurClic = undefined;
    this.pointInterroge.set(null);
    this.zonesAuPoint.set(null);
  }

  libelleCouche(type: TypeZone): string {
    return COUCHES.find((c) => c.type === type)?.libelle ?? type;
  }

  couleurCouche(type: TypeZone): string {
    return COUCHES.find((c) => c.type === type)?.couleur ?? "#607d8b";
  }
}
