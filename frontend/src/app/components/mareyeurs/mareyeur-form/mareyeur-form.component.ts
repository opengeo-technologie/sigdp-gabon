// Module Mareyeurs - SIGDP-GABON
// Formulaire réactif création/modification — patterns SIGDP :
//  - M.FormSelect.init() toujours dans setTimeout(..., 0)
//  - multi-selects lus via (change) + selectedOptions (pas de ngModel)
//  - champs multiples en base : split(',') au chargement, join(', ') à l'enregistrement

import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { MareyeurService } from "../../../services/mareyeur.service";
import {
  Mareyeur,
  PROVINCES_GABON,
  SITES_DEBARQUEMENT,
} from "../../../models/mareyeur.model";

declare var M: any;

@Component({
  selector: "app-mareyeur-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./mareyeur-form.component.html",
  styleUrl: "./mareyeur-form.component.scss",
})
export class MareyeurFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private mareyeurService = inject(MareyeurService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  formulaire!: FormGroup;
  modeEdition = false;
  idMareyeur: number | null = null;
  codeMareyeur: string | null = null;
  enregistrement = false;

  // Valeurs des selects Materialize gérées hors formulaire réactif
  typePersonne = "physique";
  sexe: string | null = null;
  statut = "actif";
  zonesSelectionnees: string[] = [];
  sitesSelectionnes: string[] = [];

  provinces = PROVINCES_GABON;
  sites = SITES_DEBARQUEMENT;

  ngOnInit(): void {
    this.formulaire = this.fb.group({
      nom: [""],
      prenom: [""],
      raison_sociale: [""],
      date_naissance: [null],
      lieu_naissance: [""],
      nationalite: ["Gabonaise"],
      nif: [""],
      rccm: [""],
      telephone: ["", Validators.required],
      email: ["", Validators.email],
      adresse: [""],
      observations: [""],
    });

    const idParam = this.route.snapshot.paramMap.get("id");
    if (idParam) {
      this.modeEdition = true;
      this.idMareyeur = +idParam;
      this.chargerMareyeur(this.idMareyeur);
    } else {
      this.initMaterialize();
    }
  }

  private initMaterialize(): void {
    // Pattern SIGDP : toujours dans setTimeout(..., 0)
    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"));
      M.updateTextFields();
    }, 0);
  }

  private chargerMareyeur(id: number): void {
    this.mareyeurService.detailsMareyeur(id).subscribe({
      next: (m) => {
        this.codeMareyeur = m.code || null;
        this.typePersonne = m.type_personne;
        this.sexe = m.sexe || null;
        this.statut = m.statut;

        // Champs multiples : split(',') au chargement (pattern SIGDP)
        this.zonesSelectionnees = (m.zones_activite || "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        this.sitesSelectionnes = (m.sites_debarquement || "")
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        this.formulaire.patchValue({
          nom: m.nom || "",
          prenom: m.prenom || "",
          raison_sociale: m.raison_sociale || "",
          date_naissance: m.date_naissance || null,
          lieu_naissance: m.lieu_naissance || "",
          nationalite: m.nationalite || "",
          nif: m.nif || "",
          rccm: m.rccm || "",
          telephone: m.telephone || "",
          email: m.email || "",
          adresse: m.adresse || "",
          observations: m.observations || "",
        });

        // Ré-init des selects après le rendu des [selected]
        this.initMaterialize();
      },
      error: () => {
        M.toast({ html: "Mareyeur introuvable", classes: "red" });
        this.router.navigate(["/mareyeurs"]);
      },
    });
  }

  // --- Selects simples : lecture via (change) ---

  onTypePersonneChange(event: Event): void {
    this.typePersonne = (event.target as HTMLSelectElement).value;
    // Les *ngIf recréent des selects : ré-initialiser Materialize
    this.initMaterialize();
  }

  onSexeChange(event: Event): void {
    this.sexe = (event.target as HTMLSelectElement).value || null;
  }

  onStatutChange(event: Event): void {
    this.statut = (event.target as HTMLSelectElement).value;
  }

  // --- Multi-selects : (change) + selectedOptions (pattern SIGDP, pas de ngModel) ---

  onZonesChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.zonesSelectionnees = Array.from(select.selectedOptions)
      .map((o) => o.value)
      .filter((v) => v.length > 0);
  }

  onSitesChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sitesSelectionnes = Array.from(select.selectedOptions)
      .map((o) => o.value)
      .filter((v) => v.length > 0);
  }

  // --- Enregistrement ---

  enregistrer(): void {
    if (this.typePersonne === "physique" && !this.formulaire.value.nom) {
      M.toast({
        html: "Le nom est obligatoire pour une personne physique",
        classes: "red",
      });
      return;
    }
    if (
      this.typePersonne === "morale" &&
      !this.formulaire.value.raison_sociale
    ) {
      M.toast({
        html: "La raison sociale est obligatoire pour une personne morale",
        classes: "red",
      });
      return;
    }
    if (this.formulaire.invalid) {
      M.toast({
        html: "Veuillez corriger les champs invalides",
        classes: "red",
      });
      return;
    }

    const valeurs = this.formulaire.value;
    const mareyeur: Mareyeur = {
      ...valeurs,
      type_personne: this.typePersonne,
      sexe: this.sexe,
      statut: this.statut,
      // Champs multiples : join(', ') à l'enregistrement (pattern SIGDP)
      zones_activite: this.zonesSelectionnees.join(", ") || null,
      sites_debarquement: this.sitesSelectionnes.join(", ") || null,
      date_naissance: valeurs.date_naissance || null,
    };

    this.enregistrement = true;

    const appel =
      this.modeEdition && this.idMareyeur
        ? this.mareyeurService.modifierMareyeur({
            ...mareyeur,
            id: this.idMareyeur,
          })
        : this.mareyeurService.creerMareyeur(mareyeur);

    appel.subscribe({
      next: (resultat) => {
        this.enregistrement = false;
        M.toast({
          html: this.modeEdition
            ? "Mareyeur modifié avec succès"
            : `Mareyeur ${resultat.code} créé avec succès`,
          classes: "green",
        });
        this.router.navigate(["/mareyeurs/details", resultat.id]);
      },
      error: (erreur) => {
        this.enregistrement = false;
        const detail =
          erreur?.error?.detail || "Erreur lors de l'enregistrement";
        M.toast({ html: detail, classes: "red" });
      },
    });
  }
}
