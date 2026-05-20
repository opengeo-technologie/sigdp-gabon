import { Component, OnInit, ChangeDetectorRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, ActivatedRoute, RouterModule } from "@angular/router";
import { BateauService } from "../../../services/bateau.service";
import { PecheurService } from "../../../services/pecheur.service";

import { PhotoUploaderComponent } from "../photo-uploader/photo-uploader.component";
import { filter } from "rxjs";

declare var M: any;

@Component({
  selector: "app-bateau-form",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PhotoUploaderComponent],
  templateUrl: "./bateau-form.component.html",
  styleUrls: ["./bateau-form.component.css"],
})
export class BateauFormComponent implements OnInit {
  bateau: any = {
    numero_immatriculation: "",
    nom_bateau: "",
    type_bateau: "",
    propulsion: "",
    materiau_coque: "",
    statut: "Actif",
    equipement_gilets_sauvetage: false,
    equipement_extincteur: false,
    equipement_radio_vhf: false,
    equipement_gps: false,
    equipement_balise_detresse: false,
    balise_gps_actif: false,
    nombre_equipage: 0,
    longueur_hors_tout: 0,
    largeur: 0,
    tirant_eau: 0,
    puissance_moteur: 0,
    jauge_brute: 0,
  };

  enginsPecheSelectionnes: any = {
    filet_maillant: false,
    senne: false,
    ligne: false,
    casier: false,
    harpon: false,
    palangre: false,
  };

  pecheurs: any[] = [];
  isEditMode = false;
  bateauId: number | null = null;
  loading = false;
  showListEquipage = false;

  equipageRoles = [
    { nom: "Capitaine", role: "capitaine" },
    { nom: "Matelot", role: "matelot" },
    { nom: "Pêcheur", role: "pecheur" },
  ];

  listSelectedEquipage: any[] = [];

  constructor(
    private bateauService: BateauService,
    private pecheurService: PecheurService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    // Charger la liste des pêcheurs
    this.loadPecheurs();
    this.bateau.nombre_equipage = 0; // Initialiser à 0 pour éviter les problèmes de validation

    // Vérifier si mode édition
    this.route.params.subscribe((params) => {
      if (params["id"]) {
        this.isEditMode = true;
        this.bateauId = +params["id"];
        this.loadBateau(this.bateauId);
      }
    });

    // Initialiser Materialize
    setTimeout(() => {
      this.initializeMaterialize();
    }, 100);
  }

  trackByIndex(index: number): number {
    return index;
  }

  checkNbEquipage() {
    const nb = this.bateau.nombre_equipage || 0;
    if (nb < 1) {
      this.bateau.nombre_equipage = 0;
      this.showListEquipage = false;
    } else if (nb > 20) {
      this.bateau.nombre_equipage = 20;
    }
    this.onNbEquipageChange();
  }

  onNbEquipageChange() {
    const nb = this.bateau.nombre_equipage || 0;
    this.showListEquipage = nb > 0;
    if (nb > this.listSelectedEquipage.length) {
      for (let i = this.listSelectedEquipage.length; i < nb; i++) {
        this.addEquipage();
      }
    } else {
      this.listSelectedEquipage = this.listSelectedEquipage.slice(0, nb);
    }
  }

  initializeMaterialize() {
    if (typeof M !== "undefined") {
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.Datepicker.init(document.querySelectorAll(".datepicker"), {
        format: "yyyy-mm-dd",
        autoClose: true,
      });
      M.updateTextFields();
    }
  }

  loadPecheurs() {
    this.pecheurService.getPecheurs().subscribe({
      next: (data) => {
        this.pecheurs = data;
        setTimeout(() => this.initializeMaterialize(), 100);
      },
      error: (error) => {
        console.error("Erreur chargement pêcheurs:", error);
        M.toast({ html: "Erreur chargement pêcheurs", classes: "red" });
      },
    });
  }

  loadBateau(id: number) {
    this.bateauService.getBateau(id).subscribe({
      next: (data) => {
        this.bateau = data;

        // Charger les engins de pêche
        if (this.bateau.engins_peche) {
          const engins = this.bateau.engins_peche
            .split(",")
            .map((e: string) => e.trim());
          this.enginsPecheSelectionnes = {
            filet_maillant: engins.includes("Filet maillant"),
            senne: engins.includes("Senne"),
            ligne: engins.includes("Ligne"),
            casier: engins.includes("Casier"),
            harpon: engins.includes("Harpon"),
            palangre: engins.includes("Palangre"),
          };
        }

        setTimeout(() => this.initializeMaterialize(), 100);
      },
      error: (error) => {
        console.error("Erreur chargement bateau:", error);
        M.toast({ html: "Erreur chargement bateau", classes: "red" });
        this.router.navigate(["/bateaux"]);
      },
    });
  }

  get filteredPecheurs() {
    return this.pecheurs.filter((p) => p.statut === "Actif");
  }

  onPecheurChange() {
    if (this.bateau.proprietaire_pecheur_id) {
      const pecheur = this.pecheurs.find(
        (p) => p.id == this.bateau.proprietaire_pecheur_id,
      );
      if (pecheur) {
        this.bateau.proprietaire_nom = `${pecheur.nom} ${pecheur.prenom}`;
        M.updateTextFields();
      }
    }
  }

  addEquipage() {
    this.listSelectedEquipage.push({ pecheur_id: 0, role: "" });
    this.cdr.detectChanges();
    setTimeout(() => this.initializeMaterialize(), 50);
  }

  removeEquipage(index: number) {
    this.listSelectedEquipage.splice(index, 1);
  }

  onSubmit() {
    // Construire la liste des engins de pêche
    const enginsSelectionnes = [];
    if (this.enginsPecheSelectionnes.filet_maillant)
      enginsSelectionnes.push("Filet maillant");
    if (this.enginsPecheSelectionnes.senne) enginsSelectionnes.push("Senne");
    if (this.enginsPecheSelectionnes.ligne) enginsSelectionnes.push("Ligne");
    if (this.enginsPecheSelectionnes.casier) enginsSelectionnes.push("Casier");
    if (this.enginsPecheSelectionnes.harpon) enginsSelectionnes.push("Harpon");
    if (this.enginsPecheSelectionnes.palangre)
      enginsSelectionnes.push("Palangre");

    this.bateau.engins_peche = enginsSelectionnes.join(", ");

    this.loading = false;

    const formData = new FormData();
    // console.log("Données du bateau à soumettre:", this.bateau);
    formData.append(
      "numero_immatriculation",
      this.bateau.numero_immatriculation,
    );
    formData.append("nom_bateau", this.bateau.nom_bateau);
    formData.append("type_bateau", this.bateau.type_bateau);
    formData.append("propulsion", this.bateau.propulsion);
    formData.append("materiau_coque", this.bateau.materiau_coque);
    formData.append("jauge_brute", this.bateau.jauge_brute);
    formData.append("longueur_hors_tout", this.bateau.longueur_hors_tout);
    formData.append("largeur", String(this.bateau.largeur));
    formData.append("tirant_eau", String(this.bateau.tirant_eau));
    formData.append("puissance_moteur", String(this.bateau.puissance_moteur));
    formData.append("statut", this.bateau.statut);
    formData.append(
      "equipement_gilets_sauvetage",
      String(this.bateau.equipement_gilets_sauvetage),
    );
    formData.append(
      "equipement_extincteur",
      String(this.bateau.equipement_extincteur),
    );
    formData.append(
      "equipement_radio_vhf",
      String(this.bateau.equipement_radio_vhf),
    );
    formData.append("equipement_gps", String(this.bateau.equipement_gps));
    formData.append(
      "equipement_balise_detresse",
      String(this.bateau.equipement_balise_detresse),
    );
    formData.append("balise_gps_actif", String(this.bateau.balise_gps_actif));
    formData.append(
      "proprietaire_pecheur_id",
      String(this.bateau.proprietaire_pecheur_id),
    );
    formData.append("engins_peche", this.bateau.engins_peche);
    formData.append(
      "certificat_navigabilite_numero",
      this.bateau.certificat_navigabilite_numero,
    );
    formData.append(
      "certificat_navigabilite_date_expiration",
      this.bateau.certificat_navigabilite_date_expiration,
    );
    formData.append(
      "certificat_navigabilite_date_delivrance",
      this.bateau.certificat_navigabilite_date_delivrance,
    );
    formData.append(
      "nombre_equipage",
      String(this.bateau.nombre_equipage || 0),
    );
    if (this.bateau.photo) {
      formData.append("photo", this.bateau.photo);
      formData.append("remove_photo", "true");
    } else {
      formData.append("remove_photo", "false");
    }

    if (this.listSelectedEquipage.length > 0 && this.validateEquipageForm()) {
      // ✅ Ajouter équipage en JSON string (sans null/undefined)
      const equipageValide = this.listSelectedEquipage
        .filter((e) => e.pecheur_id && e.role) // Filtrer valides
        .map((e) => ({
          pecheur_id: parseInt(e.pecheur_id),
          role: e.role,
        }));
      // console.log("Équipage à soumettre:", JSON.stringify(equipageValide));
      formData.append("equipage", JSON.stringify(equipageValide));
    }

    if (this.validateEquipageForm()) {
      const request = this.isEditMode
        ? this.bateauService.updateBateauWithPhoto(this.bateauId!, formData)
        : this.bateauService.createBateauWithPhoto(formData);

      request.subscribe({
        next: (response) => {
          // console.log("Réponse du serveur:", response);
          M.toast({
            html: `Bateau ${this.isEditMode ? "modifié" : "créé"} avec succès`,
            classes: "green",
          });
          this.router.navigate(["/bateaux"]);
        },
        error: (error) => {
          console.error("Erreur:", error.error.detail || error);

          M.toast({
            html: `Erreur lors de ${this.isEditMode ? "la modification" : "la création"}`,
            classes: "red",
          });
          this.loading = false;
        },
      });
    }
  }

  onPhotoSelected(file: File) {
    this.bateau.photo = file;
    console.log("Photo sélectionnée:", file.name, file.size);
  }

  onPhotoRemoved() {
    this.bateau.photo = null;
    console.log("Photo supprimée");
  }

  validateEquipageForm(): boolean {
    // Vérifier équipage
    if (this.bateau.nombre_equipage > 0) {
      const equipageValide = this.listSelectedEquipage.every(
        (e) => e.pecheur_id && e.role,
      );

      if (!equipageValide) {
        M.toast({
          html: `Erreur : Veuillez remplir tous les membres d'équipage`,
          classes: "red",
        });
        return false;
      }
    }

    if (
      this.bateau.certificat_navigabilite_numero == "" ||
      this.bateau.certificat_navigabilite_date_delivrance == "" ||
      this.bateau.certificat_navigabilite_date_expiration == ""
    ) {
      M.toast({
        html: `Erreur : Veuillez remplir les informations sur le certificat de navigabilité`,
        classes: "red",
      });
      return false;
    }

    return true;
  }
}
