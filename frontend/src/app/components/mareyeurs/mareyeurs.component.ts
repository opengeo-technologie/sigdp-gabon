import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";

import { MareyeurService } from "../../services/mareyeur.service";
import {
  Mareyeur,
  MareyeurListFilter,
  LIBELLES_STATUT_MAREYEUR,
} from "../../models/mareyeur.model";
import {
  MareyeurExportService,
  FormatExport,
} from "../../services/export-services/mareyeur-export.service";

declare var M: any;

@Component({
  selector: "app-mareyeurs",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./mareyeurs.component.html",
  styleUrl: "./mareyeurs.component.scss",
})
export class MareyeursComponent {
  private mareyeurService = inject(MareyeurService);
  private exportService = inject(MareyeurExportService);
  private router = inject(Router);

  exportEnCours = false;
  exporterAvecFiltre = false;

  mareyeurs: Mareyeur[] = [];
  total = 0;
  chargement = false;

  filtre: MareyeurListFilter = {
    statut: null,
    recherche: null,
    page: 1,
    taille_page: 25,
  };

  ngOnInit(): void {
    this.charger();
    // Pattern SIGDP : init Materialize toujours dans un setTimeout
    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"));
    }, 0);
  }

  charger(): void {
    this.chargement = true;
    this.mareyeurService.listerMareyeurs(this.filtre).subscribe({
      next: (reponse) => {
        this.mareyeurs = reponse.resultats;
        this.total = reponse.total;
        this.chargement = false;
      },
      error: () => {
        this.chargement = false;
        M.toast({
          html: "Erreur lors du chargement des mareyeurs",
          classes: "red",
        });
      },
    });
  }

  // Selects Materialize : lecture via l'événement change, pas de ngModel
  onStatutChange(event: Event): void {
    const valeur = (event.target as HTMLSelectElement).value;
    this.filtre.statut = valeur || null;
  }

  rechercher(): void {
    this.filtre.page = 1;
    this.charger();
  }

  reinitialiser(): void {
    this.filtre = { statut: null, recherche: null, page: 1, taille_page: 25 };
    this.charger();
    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"));
    }, 0);
  }

  changerPage(page: number): void {
    this.filtre.page = page;
    this.charger();
  }

  nombrePages(): number {
    return Math.max(1, Math.ceil(this.total / this.filtre.taille_page));
  }

  nomAffiche(m: Mareyeur): string {
    return m.type_personne === "morale"
      ? m.raison_sociale || "-"
      : `${m.nom || ""} ${m.prenom || ""}`.trim() || "-";
  }

  libelleStatut(statut: string): string {
    return LIBELLES_STATUT_MAREYEUR[statut] || statut;
  }

  exporter(format: FormatExport): void {
    this.exportEnCours = true;
    M.toast({ html: "Préparation de l\u2019export...", classes: "blue" });
    // Le filtre courant (statut / recherche) est appliqué à l'export
    this.exportService
      .exporter(format, this.filtre)
      .then(() => M.toast({ html: "Export généré", classes: "green" }))
      .catch(() =>
        M.toast({ html: "Erreur lors de l\u2019export", classes: "red" }),
      )
      .finally(() => (this.exportEnCours = false));
  }

  supprimer(m: Mareyeur): void {
    if (!m.id) {
      return;
    }
    const confirmation = confirm(
      `Supprimer le mareyeur ${m.code} (${this.nomAffiche(m)}) ?\n` +
        `Ses agréments, installations et transactions seront également supprimés.`,
    );
    if (!confirmation) {
      return;
    }

    this.mareyeurService.supprimerMareyeur(m.id).subscribe({
      next: () => {
        M.toast({ html: "Mareyeur supprimé", classes: "green" });
        this.charger();
      },
      error: () =>
        M.toast({ html: "Erreur lors de la suppression", classes: "red" }),
    });
  }
}
