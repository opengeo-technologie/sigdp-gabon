import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { MareyeurService } from "../../../services/mareyeur.service";
import { MareyeurPdfService } from "../../../services/mareyage-pdf.service";
import {
  Mareyeur,
  AgrementMareyage,
  InstallationMareyage,
  TransactionAchat,
  LIBELLES_STATUT_MAREYEUR,
  LIBELLES_STATUT_AGREMENT,
  LIBELLES_CATEGORIE_AGREMENT,
  SITES_DEBARQUEMENT,
} from "../../../models/mareyeur.model";

const LIBELLES_TYPE_INSTALLATION: Record<string, string> = {
  chambre_froide: "Chambre froide",
  vehicule_frigorifique: "Véhicule frigorifique",
  entrepot: "Entrepôt",
  etal: "Étal",
  autre: "Autre",
};

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
  LIBELLES_TYPE_INSTALLATION = LIBELLES_TYPE_INSTALLATION;
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

  // --- Installations ---
  installations: InstallationMareyage[] = [];
  typesInstallation = [
    "chambre_froide",
    "vehicule_frigorifique",
    "entrepot",
    "etal",
    "autre",
  ];
  afficherFormInstallation = false;
  formInstallation: InstallationMareyage = this.installationVide();

  // --- Transactions ---
  transactions: TransactionAchat[] = [];
  totalTransactions = 0;
  pageTransactions = 1;
  taillePageTransactions = 10;
  afficherFormTransaction = false;
  formTransaction: TransactionAchat = this.transactionVide();

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
        this.chargerInstallations();
        this.chargerTransactions();
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

  // ------------------------------------------------------------------ //
  // Installations
  // ------------------------------------------------------------------ //

  private installationVide(): InstallationMareyage {
    return {
      mareyeur_id: this.mareyeur?.id || 0,
      type_installation: "chambre_froide",
      designation: "",
      capacite_tonnes: null,
      immatriculation: null,
      adresse: null,
      latitude: null,
      longitude: null,
      statut: "fonctionnelle",
    };
  }

  private chargerInstallations(): void {
    if (!this.mareyeur?.id) {
      return;
    }
    this.mareyeurService
      .listerInstallations({ mareyeur_id: this.mareyeur.id })
      .subscribe({
        next: (liste) => (this.installations = liste),
        error: () =>
          M.toast({
            html: "Erreur de chargement des installations",
            classes: "red",
          }),
      });
  }

  private initSelects(): void {
    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"));
      M.updateTextFields();
    }, 0);
  }

  ouvrirFormInstallation(): void {
    this.formInstallation = this.installationVide();
    this.afficherFormInstallation = true;
    this.initSelects();
  }

  fermerFormInstallation(): void {
    this.afficherFormInstallation = false;
    this.formInstallation = this.installationVide();
  }

  editerInstallation(i: InstallationMareyage): void {
    this.formInstallation = { ...i };
    this.afficherFormInstallation = true;
    this.initSelects();
  }

  onTypeInstallationChange(event: Event): void {
    this.formInstallation.type_installation = (
      event.target as HTMLSelectElement
    ).value;
    // Le champ immatriculation apparaît/disparaît via *ngIf : ré-init
    this.initSelects();
  }

  onStatutInstallationChange(event: Event): void {
    this.formInstallation.statut = (event.target as HTMLSelectElement).value;
  }

  enregistrerInstallation(): void {
    if (!this.mareyeur?.id) {
      return;
    }
    if (!this.formInstallation.designation) {
      M.toast({ html: "La désignation est obligatoire", classes: "red" });
      return;
    }
    // Éviter les coordonnées partielles (marqueur Leaflet à 0,0)
    const latRenseignee = this.formInstallation.latitude != null;
    const lngRenseignee = this.formInstallation.longitude != null;
    if (latRenseignee !== lngRenseignee) {
      M.toast({
        html: "Renseignez latitude ET longitude, ou aucune des deux",
        classes: "red",
      });
      return;
    }

    this.formInstallation.mareyeur_id = this.mareyeur.id;
    const appel = this.formInstallation.id
      ? this.mareyeurService.modifierInstallation(this.formInstallation)
      : this.mareyeurService.creerInstallation(this.formInstallation);

    appel.subscribe({
      next: () => {
        M.toast({
          html: this.formInstallation.id
            ? "Installation modifiée"
            : "Installation ajoutée",
          classes: "green",
        });
        this.fermerFormInstallation();
        this.chargerInstallations();
      },
      error: (e) =>
        M.toast({ html: e?.error?.detail || "Erreur", classes: "red" }),
    });
  }

  supprimerInstallation(i: InstallationMareyage): void {
    if (!i.id || !confirm(`Supprimer « ${i.designation} » ?`)) {
      return;
    }
    this.mareyeurService.supprimerInstallation(i.id).subscribe({
      next: () => {
        M.toast({ html: "Installation supprimée", classes: "green" });
        this.chargerInstallations();
      },
      error: (e) =>
        M.toast({ html: e?.error?.detail || "Erreur", classes: "red" }),
    });
  }

  // ------------------------------------------------------------------ //
  // Transactions d'achat
  // ------------------------------------------------------------------ //

  private transactionVide(): TransactionAchat {
    return {
      mareyeur_id: this.mareyeur?.id || 0,
      date_transaction: new Date().toISOString().slice(0, 10),
      site_debarquement: null,
      pecheur: null,
      pirogue: null,
      espece: "",
      quantite_kg: 0,
      prix_unitaire_fcfa: null,
    };
  }

  private chargerTransactions(): void {
    if (!this.mareyeur?.id) {
      return;
    }
    this.mareyeurService
      .listerTransactions({
        mareyeur_id: this.mareyeur.id,
        page: this.pageTransactions,
        taille_page: this.taillePageTransactions,
      })
      .subscribe({
        next: (reponse) => {
          this.transactions = reponse.resultats;
          this.totalTransactions = reponse.total;
        },
        error: () =>
          M.toast({ html: "Erreur de chargement du registre", classes: "red" }),
      });
  }

  sitesDuMareyeur(): string[] {
    const sites = (this.mareyeur?.sites_debarquement || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    return sites.length > 0 ? sites : SITES_DEBARQUEMENT;
  }

  ouvrirFormTransaction(): void {
    this.formTransaction = this.transactionVide();
    this.afficherFormTransaction = true;
    this.initSelects();
  }

  onSiteTransactionChange(event: Event): void {
    this.formTransaction.site_debarquement =
      (event.target as HTMLSelectElement).value || null;
  }

  montantPrevisionnel(): number {
    return (
      (this.formTransaction.quantite_kg || 0) *
      (this.formTransaction.prix_unitaire_fcfa || 0)
    );
  }

  enregistrerTransaction(): void {
    if (!this.mareyeur?.id) {
      return;
    }
    if (
      !this.formTransaction.espece ||
      !this.formTransaction.quantite_kg ||
      !this.formTransaction.date_transaction
    ) {
      M.toast({
        html: "Date, espèce et quantité sont obligatoires",
        classes: "red",
      });
      return;
    }
    this.formTransaction.mareyeur_id = this.mareyeur.id;
    this.mareyeurService.creerTransaction(this.formTransaction).subscribe({
      next: (t) => {
        M.toast({ html: `Achat ${t.code} enregistré`, classes: "green" });
        this.afficherFormTransaction = false;
        this.pageTransactions = 1;
        this.chargerTransactions();
      },
      error: (e) =>
        M.toast({ html: e?.error?.detail || "Erreur", classes: "red" }),
    });
  }

  supprimerTransaction(t: TransactionAchat): void {
    if (!t.id || !confirm(`Supprimer la transaction ${t.code} ?`)) {
      return;
    }
    this.mareyeurService.supprimerTransaction(t.id).subscribe({
      next: () => {
        M.toast({ html: "Transaction supprimée", classes: "green" });
        this.chargerTransactions();
      },
      error: (e) =>
        M.toast({ html: e?.error?.detail || "Erreur", classes: "red" }),
    });
  }

  changerPageTransactions(page: number): void {
    this.pageTransactions = page;
    this.chargerTransactions();
  }

  nombrePagesTransactions(): number {
    return Math.max(
      1,
      Math.ceil(this.totalTransactions / this.taillePageTransactions),
    );
  }

  // supprimerAgrement(a: AgrementMareyage): void {
  //   if (!a.id || !confirm(`Supprimer la demande ${a.code} ?`)) {
  //     return;
  //   }
  //   this.mareyeurService.supprimerAgrement(a.id).subscribe({
  //     next: () => {
  //       M.toast({ html: "Demande supprimée", classes: "green" });
  //       this.chargerAgrements();
  //     },
  //     error: (e) =>
  //       M.toast({ html: e?.error?.detail || "Erreur", classes: "red" }),
  //   });
  // }
}
