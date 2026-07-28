// station-piscicole-detail.component.ts
import { Component, OnInit, AfterViewInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { StationPiscicoleService } from "../../../services/stations-piscicole.service";
import {
  StationPiscicoleDetail,
  CycleProduction,
  StatutStation,
  TYPE_STATION_LABELS,
  SOURCE_EAU_LABELS,
  TYPE_PROMOTEUR_LABELS,
  STATUT_STATION_LABELS,
  STATUT_STATION_COLORS,
  STATUT_CYCLE_LABELS,
  STATUT_CYCLE_COLORS,
  TRANSITIONS_STATUT,
  ESPECES_DISPONIBLES,
} from "../../../models/stations-piscicole.model";
import { AuthService } from "../../../services/auth.service";

declare var M: any;

@Component({
  selector: "app-stations-piscicoles-details",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./stations-piscicoles-details.component.html",
  styleUrl: "./stations-piscicoles-details.component.scss",
})
export class StationsPiscicolesDetailsComponent implements OnInit {
  private service = inject(StationPiscicoleService);
  private route = inject(ActivatedRoute);
  private permissionService = inject(AuthService);
  private router = inject(Router);

  station: StationPiscicoleDetail | null = null;

  typeLabels = TYPE_STATION_LABELS;
  sourceEauLabels = SOURCE_EAU_LABELS;
  typePromoteurLabels = TYPE_PROMOTEUR_LABELS;
  statutLabels = STATUT_STATION_LABELS;
  statutColors = STATUT_STATION_COLORS;
  cycleLabels = STATUT_CYCLE_LABELS;
  cycleColors = STATUT_CYCLE_COLORS;
  especesDisponibles = ESPECES_DISPONIBLES;

  // État des modals
  statutCible: string | null = null;
  motifStatut = "";
  cycleEnRecolte: CycleProduction | null = null;
  nouveauCycle: any = this.cycleVide();
  recolte: any = this.recolteVide();

  private modals: any[] = [];

  private modalsInitialises = new Set<string>();

  ngOnInit(): void {
    const id = +this.route.snapshot.paramMap.get("id")!;
    this.charger(id);
  }

  // ngAfterViewInit(): void {
  //   setTimeout(() => {
  //     this.modals = M.Modal.init(document.querySelectorAll(".modal"));
  //   }, 0);
  // }

  ngOnDestroy(): void {
    //Called once, before the instance is destroyed.
    //Add 'implements OnDestroy' to the class.
    this.modalsInitialises.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        M.Modal.getInstance(el)?.destroy();
        el.remove();
      }
    });
    this.modalsInitialises.clear();
  }

  hasPermission(permission: string): boolean {
    return this.permissionService.hasPermission(permission);
  }

  private charger(id: number): void {
    this.service.obtenir(id).subscribe({
      next: (station) => {
        this.station = station;
        setTimeout(() => {
          M.FormSelect.init(document.querySelectorAll("select"));
        }, 0);
      },
      error: () => {
        M.toast({ html: "Station introuvable", classes: "red" });
        this.router.navigate(["/stations-piscicoles"]);
      },
    });
  }

  splitEspeces(): string[] {
    return this.station?.especes_elevees
      ? this.station.especes_elevees.split(",").filter((e) => e.trim())
      : [];
  }

  agrementExpire(): boolean {
    if (!this.station?.date_expiration_agrement) return false;
    return new Date(this.station.date_expiration_agrement) < new Date();
  }

  transitionsPossibles(): StatutStation[] {
    return this.station ? TRANSITIONS_STATUT[this.station.statut] || [] : [];
  }

  // --------------------------- Statut ---------------------------

  private ouvrirModal(id: string): void {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`Modal #${id} introuvable dans le DOM (station chargée ?)`);
      return;
    }
    if (!this.modalsInitialises.has(id)) {
      document.body.appendChild(el); // sort le modal du contexte piégeant
      M.Modal.init(el, { dismissible: true });
      this.modalsInitialises.add(id);
    }
    M.Modal.getInstance(el).open();
  }

  private fermerModal(id: string): void {
    const el = document.getElementById(id);
    if (el) M.Modal.getInstance(el)?.close();
  }

  ouvrirModalStatut(statut: StatutStation): void {
    this.statutCible = statut;
    this.motifStatut = "";
    // console.log(this.statutCible);
    this.ouvrirModal("modal-statut");
  }

  confirmerStatut(): void {
    if (!this.station || !this.statutCible) return;
    this.service
      .changerStatut(
        this.station.id,
        this.statutCible,
        this.motifStatut || undefined,
      )
      .subscribe({
        next: () => {
          M.toast({ html: "Statut mis à jour", classes: "green" });
          this.fermerModal("modal-statut");
          this.charger(this.station!.id);
        },
        error: (err) =>
          M.toast({
            html: err?.error?.detail || "Transition non autorisée",
            classes: "red",
          }),
      });
  }

  // --------------------------- Cycles ---------------------------

  private cycleVide(): any {
    return {
      espece: "",
      date_empoissonnement: "",
      nombre_alevins: null,
      origine_alevins: "",
      date_recolte_prevue: "",
    };
  }

  private recolteVide(): any {
    return {
      date_recolte_effective: "",
      tonnage_recolte: null,
      taux_mortalite: null,
      observations: "",
    };
  }

  ouvrirModalCycle(): void {
    this.nouveauCycle = this.cycleVide();
    this.ouvrirModal("modal-cycle");
    setTimeout(
      () => M.FormSelect.init(document.querySelectorAll("#modal-cycle select")),
      0,
    );
  }

  creerCycle(): void {
    if (!this.station) return;
    if (!this.nouveauCycle.espece || !this.nouveauCycle.date_empoissonnement) {
      M.toast({
        html: "L'espèce et la date d'empoissonnement sont obligatoires",
        classes: "red",
      });
      return;
    }
    this.service
      .creerCycle({
        station_id: this.station.id,
        espece: this.nouveauCycle.espece,
        date_empoissonnement: this.nouveauCycle.date_empoissonnement,
        nombre_alevins: this.nouveauCycle.nombre_alevins || undefined,
        origine_alevins: this.nouveauCycle.origine_alevins || undefined,
        date_recolte_prevue: this.nouveauCycle.date_recolte_prevue || undefined,
      })
      .subscribe({
        next: (c) => {
          M.toast({ html: `Cycle ${c.code_cycle} créé`, classes: "green" });
          this.fermerModal("modal-cycle");
          this.charger(this.station!.id);
        },
        error: (err) =>
          M.toast({
            html: err?.error?.detail || "Erreur lors de la création du cycle",
            classes: "red",
          }),
      });
  }

  ouvrirModalRecolte(cycle: CycleProduction): void {
    this.cycleEnRecolte = cycle;
    this.recolte = this.recolteVide();
    this.ouvrirModal("modal-recolte");
  }

  confirmerRecolte(): void {
    if (!this.cycleEnRecolte) return;
    if (
      !this.recolte.date_recolte_effective ||
      this.recolte.tonnage_recolte == null
    ) {
      M.toast({
        html: "La date et le tonnage sont obligatoires",
        classes: "red",
      });
      return;
    }
    this.service
      .recolterCycle({
        id: this.cycleEnRecolte.id,
        date_recolte_effective: this.recolte.date_recolte_effective,
        tonnage_recolte: this.recolte.tonnage_recolte,
        taux_mortalite: this.recolte.taux_mortalite ?? undefined,
        observations: this.recolte.observations || undefined,
      })
      .subscribe({
        next: () => {
          M.toast({ html: "Récolte enregistrée", classes: "green" });
          this.fermerModal("modal-recolte");
          this.charger(this.station!.id);
        },
        error: (err) =>
          M.toast({
            html: err?.error?.detail || "Erreur lors de la récolte",
            classes: "red",
          }),
      });
  }

  abandonner(cycle: CycleProduction): void {
    if (
      !confirm(
        `Abandonner le cycle ${cycle.code_cycle} ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    this.service.abandonnerCycle(cycle.id).subscribe({
      next: () => {
        M.toast({ html: "Cycle abandonné", classes: "orange" });
        this.charger(this.station!.id);
      },
      error: (err) =>
        M.toast({
          html: err?.error?.detail || "Erreur",
          classes: "red",
        }),
    });
  }

  supprimerCycle(cycle: CycleProduction): void {
    if (!confirm(`Supprimer le cycle ${cycle.code_cycle} ?`)) return;
    this.service.supprimerCycle(cycle.id).subscribe({
      next: (res) => {
        M.toast({ html: res.message, classes: "green" });
        this.charger(this.station!.id);
      },
      error: (err) =>
        M.toast({
          html: err?.error?.detail || "Erreur lors de la suppression",
          classes: "red",
        }),
    });
  }
}
