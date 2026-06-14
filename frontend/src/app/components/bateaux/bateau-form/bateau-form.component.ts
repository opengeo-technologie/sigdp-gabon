import {
  Component,
  OnInit,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, ActivatedRoute, RouterModule } from "@angular/router";
import { BateauService } from "../../../services/bateau.service";
import { PecheurService } from "../../../services/pecheur.service";

import { PhotoUploaderComponent } from "../photo-uploader/photo-uploader.component";
import { filter, forkJoin } from "rxjs";
import { DebarcadereService } from "../../../services/debarcadere.service";

declare var M: any;

@Component({
  selector: "app-bateau-form",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PhotoUploaderComponent],
  templateUrl: "./bateau-form.component.html",
  styleUrls: ["./bateau-form.component.css"],
})
export class BateauFormComponent implements OnInit {
  @ViewChild("siteSelect") siteSelect!: ElementRef;

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
    site_port_attache: null,
    site_obligatoire: [],
    engins_peche_principal: null,
    engins_peche_secondaires: [] as (string | number)[],
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
  sites: any[] = [];
  engins_peche: any[] = [];
  isEditMode = false;
  bateauId: number | null = null;
  loading = false;
  showListEquipage = false;
  selectedValues: string[] = [];

  equipageRoles = [
    { nom: "Capitaine", role: "capitaine" },
    { nom: "Matelot", role: "matelot" },
    { nom: "Pêcheur", role: "pecheur" },
  ];

  listSelectedEquipage: any[] = [];

  readonly MAX_ENGINS = 2;

  constructor(
    private bateauService: BateauService,
    private debarcadereService: DebarcadereService,
    private pecheurService: PecheurService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    // Charger la liste des pêcheurs
    this.loadPecheurs();
    this.loadDebarcaderes();
    this.loadEnginsPeche();
    this.bateau.nombre_equipage = 0; // Initialiser à 0 pour éviter les problèmes de validation

    // Vérifier si mode édition
    this.route.params.subscribe((params) => {
      if (params["id"]) {
        this.isEditMode = true;
        this.bateauId = +params["id"];
        // this.loadBateau(this.bateauId);
        this.chargerFormulaire(this.bateauId);
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

  resetSiteSelect() {
    // 1. vider le modèle
    this.bateau.site_obligatoire = [];

    // 2. désélectionner toutes les options dans le DOM
    const el = this.siteSelect.nativeElement as HTMLSelectElement;
    Array.from(el.options).forEach((opt) => (opt.selected = false));

    // 3. réinitialiser Materialize pour rafraîchir l'affichage
    M.FormSelect.init(el);
  }

  preselectionnerSites() {
    // convertir la chaîne "2270, 2099" en tableau ["2270", "2099"]
    const idsSelectionnes = (this.bateau.site_obligatoire ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s !== "");

    const el = this.siteSelect.nativeElement as HTMLSelectElement;

    // marquer les options correspondantes comme selected
    Array.from(el.options).forEach((opt) => {
      opt.selected = idsSelectionnes.includes(opt.value);
    });

    // réinitialiser Materialize pour afficher la sélection
    M.FormSelect.init(el);
  }

  isEnginSelected(id: string | number): boolean {
    return this.bateau.engins_peche_secondaires.includes(id);
  }

  isMaxReached(): boolean {
    return this.bateau.engins_peche_secondaires.length >= this.MAX_ENGINS;
  }

  onEnginChange(event: Event, id: string | number) {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      if (this.bateau.engins_peche_secondaires.length < this.MAX_ENGINS) {
        this.bateau.engins_peche_secondaires.push(id);
      }
    } else {
      this.bateau.engins_peche_secondaires =
        this.bateau.engins_peche_secondaires.filter((x: any) => x !== id);
    }
    // console.log(this.bateau.engins_peche_secondaires);
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

  loadEnginsPeche() {
    this.bateauService.getEngins().subscribe({
      next: (data) => {
        this.engins_peche = data;
        setTimeout(() => this.initializeMaterialize(), 100);
      },
      error: (error) => {
        console.error("Erreur chargement engins de pêche:", error);
        M.toast({ html: "Erreur chargement engins de pêche", classes: "red" });
      },
    });
  }

  loadDebarcaderes() {
    this.debarcadereService.getDebarcaderes().subscribe({
      next: (data) => {
        // console.log(data);
        this.sites = data;
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
        // console.log(data);
        this.bateau = data;

        this.preselectionnerSites();
        // Charger les engins de pêche
        // if (data.engins_peche_secondaires) {
        //   this.bateau.engins_peche_secondaires = (
        //     data.engins_peche_secondaires ?? ""
        //   )
        //     .split(",")
        //     .map((s: string) => s.trim())
        //     .filter((s: string) => s !== "");
        // }

        setTimeout(() => this.initializeMaterialize(), 100);
      },
      error: (error) => {
        console.error("Erreur chargement bateau:", error);
        M.toast({ html: "Erreur chargement bateau", classes: "red" });
        this.router.navigate(["/bateaux"]);
      },
    });
  }

  chargerFormulaire(id: number) {
    forkJoin({
      engins: this.bateauService.getEngins(),
      // en édition on charge le bateau, en création on renvoie null
      bateau: this.bateauService.getBateau(id),
    }).subscribe({
      next: ({ engins, bateau }) => {
        this.engins_peche = engins;

        if (bateau) {
          // --- MODE ÉDITION : pré-remplir ---
          this.bateau = {
            ...bateau,
            engins_peche_secondaires: this.stringToIds(
              bateau.engins_peche_secondaires,
            ),
          };

          // pré-sélection du select Materialize (les checkboxes se gèrent seules)
          setTimeout(() => this.preselectionnerSites(), 0);
        }
        // --- MODE CRÉATION : on garde l'objet vierge initial ---
      },
      error: (err) => console.error("Erreur de chargement", err),
    });
  }

  stringToIds(value: string | undefined): number[] {
    if (!value) return [];
    return value
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n));
  }

  idsToString(ids: (string | number)[]): string {
    return ids.join(", ");
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

  onSelectSiteDebarquement(e: Event) {
    const select = e.target as HTMLSelectElement;
    const values = Array.from(select.selectedOptions)
      .map((opt) =>
        opt.value.includes(": ") ? opt.value.split(": ")[1] : opt.value,
      )
      .filter((v) => v !== "");

    this.selectedValues = values;
    this.bateau.site_obligatoire = values.join(", ");
    // console.log(this.bateau.site_obligatoire);
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

    // this.bateau.engins_peche = enginsSelectionnes.join(", ");

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
    formData.append("site_port_attache", this.bateau.site_port_attache);
    formData.append("site_obligatoire", this.bateau.site_obligatoire);
    formData.append(
      "engins_peche_secondaires",
      this.idsToString(this.bateau.engins_peche_secondaires),
    );
    formData.append(
      "engins_peche_principal",
      this.bateau.engins_peche_principal,
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
          this.router.navigate(["/bateaux", response.id]);
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
    // console.log("Photo sélectionnée:", file.name, file.size);
  }

  onPhotoRemoved() {
    this.bateau.photo = null;
    // console.log("Photo supprimée");
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
