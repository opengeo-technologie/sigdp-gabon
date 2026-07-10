import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { MareyeurService } from "../../../services/mareyeur.service";
import { MareyeurPdfService } from "../../../services/mareyage-pdf.service";
import {
  Mareyeur,
  AgrementMareyage,
  LIBELLES_STATUT_MAREYEUR,
  LIBELLES_STATUT_AGREMENT,
  LIBELLES_CATEGORIE_AGREMENT,
} from "../../../models/mareyeur.model";

declare var M: any;

@Component({
  selector: "app-mareyeur-details",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: "./mareyeur-details.component.html",
  styleUrl: "./mareyeur-details.component.scss",
})
export class MareyeurDetailsComponent implements OnInit {
  private mareyeurService = inject(MareyeurService);
  private mareyeurPdfService = inject(MareyeurPdfService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  LIBELLES_STATUT_MAREYEUR = LIBELLES_STATUT_MAREYEUR;
  LIBELLES_STATUT_AGREMENT = LIBELLES_STATUT_AGREMENT;
  LIBELLES_CATEGORIE_AGREMENT = LIBELLES_CATEGORIE_AGREMENT;

  mareyeur: Mareyeur | null = null;
  agrements: AgrementMareyage[] = [];

  afficherFormAgrement = false;
  nouvelAgrement = {
    categorie: "mareyeur_simple",
    duree_validite_mois: 12,
    montant_redevance: null as number | null,
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get("id");
    if (!id) {
      this.router.navigate(["/mareyeurs"]);
      return;
    }
    this.charger(+id);
  }

  private charger(id: number): void {
    this.mareyeurService.detailsMareyeur(id).subscribe({
      next: (m) => {
        this.mareyeur = m;
        this.chargerAgrements();
        setTimeout(() => {
          M.FormSelect.init(document.querySelectorAll("select"));
        }, 0);
      },
      error: () => {
        M.toast({ html: "Mareyeur introuvable", classes: "red" });
        this.router.navigate(["/mareyeurs"]);
      },
    });
  }

  private chargerAgrements(): void {
    if (!this.mareyeur?.id) {
      return;
    }
    this.mareyeurService
      .listerAgrements({ mareyeur_id: this.mareyeur.id })
      .subscribe({
        next: (reponse) => (this.agrements = reponse.resultats),
        error: () =>
          M.toast({
            html: "Erreur de chargement des agréments",
            classes: "red",
          }),
      });
  }

  nomAffiche(): string {
    if (!this.mareyeur) {
      return "";
    }
    return this.mareyeur.type_personne === "morale"
      ? this.mareyeur.raison_sociale || "-"
      : `${this.mareyeur.nom || ""} ${this.mareyeur.prenom || ""}`.trim();
  }

  onCategorieChange(event: Event): void {
    this.nouvelAgrement.categorie = (event.target as HTMLSelectElement).value;
  }

  creerAgrement(): void {
    if (!this.mareyeur?.id) {
      return;
    }
    this.mareyeurService
      .creerAgrement({
        mareyeur_id: this.mareyeur.id,
        categorie: this.nouvelAgrement.categorie,
        duree_validite_mois: this.nouvelAgrement.duree_validite_mois,
        montant_redevance: this.nouvelAgrement.montant_redevance,
      })
      .subscribe({
        next: (a) => {
          M.toast({ html: `Demande ${a.code} enregistrée`, classes: "green" });
          this.afficherFormAgrement = false;
          this.chargerAgrements();
          // this.mareyeurPdfService.imprimerAgrement(this.mareyeur!, a);
        },
        error: (e) =>
          M.toast({
            html: e?.error?.detail || "Erreur lors de la création",
            classes: "red",
          }),
      });
  }

  delivrer(a: AgrementMareyage): void {
    if (!a.id || !confirm(`Délivrer l'agrément ${a.code} ?`)) {
      return;
    }
    this.mareyeurService.delivrerAgrement(a.id).subscribe({
      next: (maj) => {
        M.toast({
          html: `Agrément délivré — expire le ${maj.date_expiration}`,
          classes: "green",
        });
        this.chargerAgrements();
        this.mareyeurPdfService.imprimerAgrement(this.mareyeur!, maj);
      },
      error: (e) =>
        M.toast({ html: e?.error?.detail || "Erreur", classes: "red" }),
    });
  }

  suspendre(a: AgrementMareyage): void {
    if (!a.id) {
      return;
    }
    const motif = prompt(`Motif de suspension de l'agrément ${a.code} :`);
    if (motif === null) {
      return;
    }
    this.mareyeurService.suspendreAgrement(a.id, motif).subscribe({
      next: () => {
        M.toast({ html: "Agrément suspendu", classes: "orange" });
        this.chargerAgrements();
      },
      error: (e) =>
        M.toast({ html: e?.error?.detail || "Erreur", classes: "red" }),
    });
  }

  retirer(a: AgrementMareyage): void {
    if (!a.id) {
      return;
    }
    const motif = prompt(
      `Motif de retrait de l'agrément ${a.code} (action définitive) :`,
    );
    if (motif === null) {
      return;
    }
    this.mareyeurService.retirerAgrement(a.id, motif).subscribe({
      next: () => {
        M.toast({ html: "Agrément retiré", classes: "red" });
        this.chargerAgrements();
      },
      error: (e) =>
        M.toast({ html: e?.error?.detail || "Erreur", classes: "red" }),
    });
  }

  renouveler(a: AgrementMareyage): void {
    if (!a.id) {
      return;
    }
    const duree = prompt("Durée de validité du nouvel agrément (mois) :", "12");
    if (duree === null) {
      return;
    }
    const redevance = prompt(
      "Montant de la redevance (FCFA, vide si aucune) :",
      "",
    );
    this.mareyeurService
      .renouvelerAgrement(
        a.id,
        parseInt(duree, 10) || 12,
        redevance ? parseFloat(redevance) : null,
      )
      .subscribe({
        next: (nouveau) => {
          M.toast({
            html: `Nouvel agrément ${nouveau.code} délivré`,
            classes: "green",
          });
          this.chargerAgrements();
        },
        error: (e) =>
          M.toast({ html: e?.error?.detail || "Erreur", classes: "red" }),
      });
  }

  supprimerAgrement(a: AgrementMareyage): void {
    if (!a.id || !confirm(`Supprimer la demande ${a.code} ?`)) {
      return;
    }
    this.mareyeurService.supprimerAgrement(a.id).subscribe({
      next: () => {
        M.toast({ html: "Demande supprimée", classes: "green" });
        this.chargerAgrements();
      },
      error: (e) =>
        M.toast({ html: e?.error?.detail || "Erreur", classes: "red" }),
    });
  }

  checkAgrementDelivre() {
    let agrement_delivre = this.agrements.filter(
      (a: any) => a.statut == "delivre",
    );
    if (agrement_delivre.length != 0) {
      return true;
    }
    return false;
  }

  imprimerAgrement(a: AgrementMareyage): void {
    this.mareyeurPdfService.imprimerAgrement(this.mareyeur!, a);
  }

  imprimerCarte(): void {
    console.log(this.agrements);
    let agrement_delivre = this.agrements.filter(
      (a: any) => a.statut == "delivre",
    );
    this.mareyeurPdfService.imprimerCarte(this.mareyeur!, agrement_delivre[0]);
  }
}
