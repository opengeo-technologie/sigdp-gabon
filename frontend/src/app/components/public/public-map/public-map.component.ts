import { CommonModule, DecimalPipe } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { RouterModule } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import type { Feature, MultiPolygon } from "geojson";
import * as L from "leaflet";
import "leaflet.markercluster";
import "leaflet-extra-markers";

import { ZoneGeographiqueService } from "../../../services/zone-geographique.service";

import {
  COUCHES,
  type ConfigCouche,
  type ProprietesZone,
  type TypeZone,
  type ZoneLocalisee,
} from "../../../models/zone.model";
import { StatistiquesService } from "../../../services/statistiques.service";
import { DebarcadereService } from "../../../services/debarcadere.service";
import { FormsModule } from "@angular/forms";

declare var M: any;

interface CustomMarker extends L.Marker {
  myData: any;
}

type ExtraColor =
  | "red"
  | "orange-dark"
  | "orange"
  | "yellow"
  | "blue-dark"
  | "cyan"
  | "purple"
  | "violet"
  | "pink"
  | "green-dark"
  | "green"
  | "green-light"
  | "black"
  | "white"
  | undefined;

@Component({
  selector: "app-public-map",
  standalone: true,
  imports: [CommonModule, RouterModule, DecimalPipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./public-map.component.html",
  styleUrl: "./public-map.component.scss",
})
export class PublicMapComponent {
  private map?: L.Map;
  currentRoute: string = "";
  stats: {
    debarcaderes: number;
    pecheurs: number;
    bateaux: number;
    captures: number;
    captures_annee_group: Array<{
      annee: number;
      quantite_tonnes: number;
      quantite_kg: number;
    }>;
  } = {
    debarcaderes: 0,
    pecheurs: 0,
    bateaux: 0,
    captures: 0,
    captures_annee_group: [],
  };

  private readonly zonesService = inject(ZoneGeographiqueService);
  private readonly statistiqueService = inject(StatistiquesService);
  private readonly debarcadereService = inject(DebarcadereService);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  /** L'élément est référencé par le template : plus fiable qu'un getElementById. */
  private readonly conteneurCarte =
    viewChild.required<ElementRef<HTMLElement>>("conteneurCarte");

  /**
   * Emprise élargie vers l'ouest : la ZEE gabonaise s'étend bien au-delà du
   * littoral (jusqu'à ~5°E). Les bornes d'origine (8.5°E) la coupaient en deux
   * et empêchaient de la voir en entier.
   */
  private maxBounds = L.latLngBounds(L.latLng(-6.5, 4.5), L.latLng(3.5, 15.5));

  private readonly couchesZones = new Map<TypeZone, L.GeoJSON>();
  private readonly dejaChargees = new Set<TypeZone>();
  private observateurTaille?: ResizeObserver;
  private marqueurClic?: L.CircleMarker;

  readonly couches = COUCHES;
  readonly chargement = signal<TypeZone[]>([]);
  readonly enChargement = computed(() => this.chargement().length > 0);
  readonly erreur = signal<string | null>(null);
  readonly pointInterroge = signal<{ lat: number; lon: number } | null>(null);
  readonly zonesAuPoint = signal<ZoneLocalisee[] | null>(null);

  filters = {
    type: "Centre d'Appui à la Pêche Artisanale",
  };
  debarcaderes: any[] = [];
  selectedYear: number = 2024;
  estGlobal: boolean = true;
  readonly selected = signal<any | null>(null);
  infrastructures: any[] = [];

  private markersCAPA: L.Marker[] = [];
  private couchesDebarcaderes?: any = (L as any).markerClusterGroup();

  private markers = new Map<number, L.Marker>();
  private selectedId: number | null = null;

  constructor() {
    // afterNextRender garantit que <main #conteneurCarte> existe dans le DOM.
    // Dans ngOnInit, le template du composant n'est pas encore instancié :
    // Leaflet lève « Map container not found ».
    afterNextRender(() => this.initializeMap());

    this.destroyRef.onDestroy(() => {
      this.observateurTaille?.disconnect();
      this.map?.remove();
    });
  }

  ngOnInit(): void {
    this.loadPublicStats();
    this.loadDebarcaderes();
    setTimeout(() => {
      if (typeof M !== "undefined") {
        M.Sidenav.init(document.querySelectorAll(".sidenav"), {});
      }
    }, 100);
  }

  // ---------------------- Statistiques globales --------------------------
  loadPublicStats() {
    this.statistiqueService.dashboardStats().subscribe({
      next: (data) => {
        // console.log(data);
        this.stats = {
          debarcaderes: data.globaux.debarcaderes_actifs || 0,
          pecheurs: data.globaux.pecheurs_actifs || 0,
          bateaux: data.globaux.bateaux_actifs || 0,
          captures_annee_group: data.captures_annee_group,
          captures: data.captures_annee.quantite_tonnes,
        };
      },
      error: (error) => {
        console.log("Statistiques non disponibles:", error);
        // Valeurs par défaut si l'API n'est pas accessible
        this.stats = {
          debarcaderes: 0,
          pecheurs: 0,
          bateaux: 0,
          captures: 0,
          captures_annee_group: [],
        };
      },
    });
  }

  get getTotalCapturePerYear() {
    const element = this.stats.captures_annee_group.find(
      (el: any) => el.annee == this.selectedYear,
    );
    if (element) {
      return element.quantite_tonnes;
    }
    return 0;
  }

  // ------------------------- Gestion des debarcaderes ------------------
  private loadDebarcaderes() {
    this.debarcadereService.getDebarcaderes(this.filters).subscribe({
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

  /** Default color reflects status; selected is always red. */
  private colorFor(c: any): ExtraColor {
    return c.status === "active" ? "blue-dark" : "red";
  }

  private makeIcon(c: any, selected: boolean): L.Icon {
    return L.ExtraMarkers.icon({
      icon: "fa-fish",
      prefix: "fas",
      markerColor: selected ? "yellow" : this.colorFor(c),
      shape: "penta",
    });
  }

  private onMarkerClick(c: any): void {
    // reset the previously selected marker back to its status color
    if (this.selectedId !== null && this.selectedId !== c.id) {
      const prev = this.debarcaderes.find((x) => x.id === this.selectedId);
      if (prev) {
        this.markers.get(prev.id)?.setIcon(this.makeIcon(prev, false));
        this.markers.get(prev.id)?.setZIndexOffset(0);
      }
    }

    // recolor + zoom the clicked marker
    const m = this.markers.get(c.id);
    m?.setIcon(this.makeIcon(c, true)); // color change (red)
    m?.setZIndexOffset(1000); // sit above other pins while enlarged
    m?.getElement()?.classList.add("marker-selected"); // MUST come AFTER setIcon
    this.selectedId = c.id;

    this.infrastructures = this.getInfrastructures(c);

    this.zone.run(() => this.selected.set(c));
  }

  private addMarkers() {
    if (!this.map) return;

    // Nettoyer les marqueurs existants
    this.markersCAPA = [];

    if (!L.ExtraMarkers) {
      console.error(
        "leaflet-extra-markers non chargé — vérifier l'ordre des imports",
      );
      return;
    }

    const icon = L.ExtraMarkers.icon({
      icon: "fa-fish-fins",
      prefix: "fas",
      markerColor: "red", // palette du plugin, pas un hex
      shape: "penta",
      iconColor: "#ffffff",
    });

    this.couchesDebarcaderes ??= (L as any).markerClusterGroup({
      disableClusteringAtZoom: 5, // marqueurs individuels en zoom rapproché
      maxClusterRadius: 0,
    });

    this.couchesDebarcaderes.clearLayers();

    // Ajouter un marqueur pour chaque débarcadère
    this.debarcaderes.forEach((deb) => {
      // const icon = this.getMarkerIcon(deb.milieu, deb.type);

      // const marker = L.marker([deb.latitude, deb.longitude], {
      //   icon,
      //   draggable: true,
      // }).bindPopup(this.createPopupContent(deb)) as CustomMarker;

      const marker = L.marker([deb.latitude, deb.longitude], {
        icon: this.makeIcon(deb, false),
      }) as CustomMarker;

      marker.myData = deb;

      marker.addTo(this.map!);

      marker.on("click", () => this.onMarkerClick(deb));

      // marker.addTo(this.couchesDebarcaderes);
      this.markers.set(deb.id, marker);

      // this.markers.addLayer(marker);
    });
    // this.map.addLayer(this.markersCAPA);
    // this.couchesDebarcaderes.addTo(this.map);

    // Ajuster la vue pour inclure tous les marqueurs
    if (this.couchesDebarcaderes.length > 0) {
      const group = L.featureGroup(this.couchesDebarcaderes);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  private getInfrastructures(deb: any) {
    const infras: any[] = [];
    let infra = {
      nom: "",
      etat: null,
      icone: "",
    };

    infras.push(
      {
        nom: "Quai",
        etat: deb.infrastructure_quai,
        icone: "flaticon-ports",
      },
      {
        nom: "Chambre froide",
        etat: deb.infrastructure_chambre_froide,
        icone: "flaticon-chambre-froide",
      },
      {
        nom: "Glace",
        etat: deb.infrastructure_glace,
        icone: "flaticon-flocon-de-neige",
      },
      {
        nom: "Marché",
        etat: deb.infrastructure_marche,
        icone: "flaticon-stand-de-nourriture",
      },
      {
        nom: "Carburant",
        etat: deb.infrastructure_carburant,
        icone: "flaticon-pompe-a-carburant",
      },
      {
        nom: "Eau potable",
        etat: deb.infrastructure_eau,
        icone: "flaticon-eau",
      },
      {
        nom: "Électricité",
        etat: deb.infrastructure_electricite,
        icone: "flaticon-electricite-1",
      },
    );

    // if (deb.infrastructure_quai) infras.push("Quai");
    // if (deb.infrastructure_chambre_froide) infras.push("Chambre froide");
    // if (deb.infrastructure_glace) infras.push("Glace");
    // if (deb.infrastructure_marche) infras.push("Marché");
    // if (deb.infrastructure_carburant) infras.push("Carburant");
    // if (deb.infrastructure_eau) infras.push("Eau");
    // if (deb.infrastructure_electricite) infras.push("Électricité");

    return infras;
  }

  // ------------------------------------------------------------------
  // Carte
  // ------------------------------------------------------------------

  private deselect(): void {
    if (this.selectedId !== null) {
      const prev = this.debarcaderes.find((x) => x.id === this.selectedId);
      if (prev) {
        const pm = this.markers.get(prev.id);
        pm?.setIcon(this.makeIcon(prev, false)); // back to status color
        pm?.setZIndexOffset(0); // drop the raised stacking
      }
      this.selectedId = null;
    }
    this.zone.run(() => this.selected.set(null)); // clears the sidebar
  }

  private initializeMap() {
    const gabonCenter: L.LatLngExpression = [-0.8, 10.2];

    this.zone.runOutsideAngular(() => {
      const map = L.map(this.conteneurCarte().nativeElement, {
        zoom: 7,
        // minZoom 7 ne permettait pas d'embrasser la ZEE et le pays d'un seul
        // regard ; 6 cadre l'ensemble.
        minZoom: 6,
        zoomControl: true,
        // maxBounds: this.maxBounds,
        // Rendu canvas : les polygones de la ZEE et des frontières comptent
        // des dizaines de milliers de sommets. En SVG, autant de nœuds DOM.
        preferCanvas: true,
      }).setView(gabonCenter, 7);

      /*
       * Fonds de plan
       */
      const osm = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: "© OpenStreetMap contributors", maxZoom: 18 },
      );

      const esriSatellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/" +
          "World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles © Esri", maxZoom: 21 },
      );

      const cartoDark = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { attribution: "&copy; CARTO" },
      );

      const topo = L.tileLayer(
        "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        { attribution: "&copy; OpenTopoMap" },
      );

      osm.addTo(map);

      const baseMaps = {
        OpenStreetMap: osm,
        Satellite: esriSatellite,
        Dark: cartoDark,
        Topo: topo,
      };

      /*
       * Un pane par couche : l'ordre d'empilement ne dépend plus de l'ordre
       * d'arrivée des réponses HTTP. La ZEE reste au fond, les parcs au-dessus
       * et restent cliquables.
       */
      const overlays: Record<string, L.Layer> = {};
      for (const config of COUCHES) {
        const pane = map.createPane(`pane-${config.type}`);
        pane.style.zIndex = String(config.zIndex);

        // Couche créée vide : elle figure tout de suite dans le contrôle,
        // les données arrivent ensuite via addData().
        const couche = this.creerCouche(config);
        this.couchesZones.set(config.type, couche);
        overlays[this.etiquetteCouche(config)] = couche;
      }

      L.control
        .layers(baseMaps, overlays, { collapsed: false, position: "topright" })
        .addTo(map);

      // Chargement paresseux : on ne télécharge une couche qu'à sa première
      // activation. Vaut aussi pour celles cochées par défaut.
      map.on("overlayadd", (evt: L.LayersControlEvent) => {
        const type = [...this.couchesZones.entries()].find(
          ([, couche]) => couche === evt.layer,
        )?.[0];
        if (type) {
          this.chargerCouche(type);
        }
      });

      map.on("click", (evt: L.LeafletMouseEvent) => {
        this.zone.run(
          () => this.interrogerPoint(evt.latlng.lat, evt.latlng.lng),
          this.deselect(),
        );
      });

      this.map = map;

      // Le repli du panneau anime flex-basis pendant 0,28 s : sans
      // invalidateSize() à la fin, Leaflet conserve l'ancienne largeur et les
      // tuiles restent décalées. Le ResizeObserver couvre aussi la rotation
      // d'écran et le redimensionnement de la fenêtre.
      this.observateurTaille = new ResizeObserver(() =>
        map.invalidateSize({ animate: false }),
      );
      this.observateurTaille.observe(this.conteneurCarte().nativeElement);

      for (const config of COUCHES.filter((c) => c.visibleParDefaut)) {
        this.couchesZones.get(config.type)?.addTo(map);
      }
    });
  }

  // ------------------------------------------------------------------
  // Couches de zones
  // ------------------------------------------------------------------
  private creerCouche(config: ConfigCouche): L.GeoJSON {
    // PolylineOptions (et non PathOptions) : smoothFactor n'est typé que là.
    const style: L.PolylineOptions = {
      color: config.couleur,
      weight: config.epaisseur,
      opacity: 0.9,
      fillColor: config.couleurRemplissage,
      fillOpacity: config.opaciteRemplissage,
      dashArray: config.pointilles,
      smoothFactor: 1.5,
    };

    return L.geoJSON(undefined, {
      pane: `pane-${config.type}`,
      style: () => style,
      onEachFeature: (feature, couche) => {
        couche.bindPopup(
          this.contenuInfobulle(
            feature as Feature<MultiPolygon, ProprietesZone>,
            config,
          ),
          { maxWidth: 280, className: "popup-zone" },
        );
        couche.on({
          mouseover: (e) =>
            (e.target as L.Path).setStyle({
              weight: config.epaisseur + 1.5,
              fillOpacity: Math.min(config.opaciteRemplissage + 0.2, 0.7),
            }),
          mouseout: (e) =>
            (e.target as L.Path).setStyle({
              weight: config.epaisseur,
              fillOpacity: config.opaciteRemplissage,
            }),
        });
      },
    });
  }

  private chargerCouche(type: TypeZone): void {
    if (this.dejaChargees.has(type) || this.chargement().includes(type)) {
      return;
    }
    const config = COUCHES.find((c) => c.type === type);
    const couche = this.couchesZones.get(type);
    if (!config || !couche) {
      return;
    }

    this.zone.run(() => this.chargement.update((l) => [...l, type]));

    this.zonesService
      .chargerCouche(type, config.tolerance)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (collection) => {
          this.chargement.update((l) => l.filter((t) => t !== type));
          if (!collection.features?.length) {
            return;
          }
          this.dejaChargees.add(type);
          couche.addData(collection as any);
        },
        error: () => {
          this.chargement.update((l) => l.filter((t) => t !== type));
          this.erreur.set(`Chargement impossible : ${config.libelle}.`);
        },
      });
  }

  /** À appeler après un import de shapefile. */
  rechargerZones(): void {
    this.zonesService.viderCache();
    for (const [type, couche] of this.couchesZones) {
      couche.clearLayers();
      this.dejaChargees.delete(type);
      if (this.map?.hasLayer(couche)) {
        this.chargerCouche(type);
      }
    }
  }

  private etiquetteCouche(config: ConfigCouche): string {
    return (
      `<span class="puce-couche" style="background:${config.couleurRemplissage};` +
      `border-color:${config.couleur};border-style:${config.pointilles ? "dashed" : "solid"}"></span>` +
      config.libelle
    );
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

  /** Les noms proviennent d'un .dbf importé : source externe, donc échappement. */
  private echapper(valeur: string): string {
    const div = document.createElement("div");
    div.textContent = valeur;
    return div.innerHTML;
  }

  // ------------------------------------------------------------------
  // Interrogation d'un point
  // ------------------------------------------------------------------
  private interrogerPoint(lat: number, lon: number): void {
    this.pointInterroge.set({ lat, lon });
    this.zonesAuPoint.set(null);

    if (this.map) {
      this.marqueurClic?.remove();
      // CircleMarker plutôt que Marker : évite le problème récurrent des
      // icônes Leaflet introuvables après build Angular.
      this.marqueurClic = L.circleMarker([lat, lon], {
        radius: 6,
        color: "#ffffff",
        weight: 2,
        fillColor: "#e53935",
        fillOpacity: 1,
      }).addTo(this.map);
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

  // ------------------------------------------------------------------
  // Panneau latéral
  // ------------------------------------------------------------------
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
