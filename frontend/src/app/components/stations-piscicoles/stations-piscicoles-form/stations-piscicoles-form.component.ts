// station-piscicole-form.component.ts
import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ReactiveFormsModule, FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";

import { StationPiscicoleService } from "../../../services/stations-piscicole.service";
import {
  TYPE_STATION_LABELS,
  SOURCE_EAU_LABELS,
  TYPE_PROMOTEUR_LABELS,
  PROVINCES_GABON,
  ESPECES_DISPONIBLES,
} from "../../../models/stations-piscicole.model";

declare const M: any;

@Component({
  selector: "app-stations-piscicoles-form",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./stations-piscicoles-form.component.html",
  styleUrl: "./stations-piscicoles-form.component.scss",
})
export class StationsPiscicolesFormComponent {
  private fb = inject(FormBuilder);
  private service = inject(StationPiscicoleService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  modeEdition = false;
  stationId: number | null = null;
  codeStation = "";
  enregistrement = false;

  provinces = PROVINCES_GABON;
  especesDisponibles = ESPECES_DISPONIBLES;
  typesStation = Object.keys(TYPE_STATION_LABELS);
  sourcesEau = Object.keys(SOURCE_EAU_LABELS);
  typesPromoteur = Object.keys(TYPE_PROMOTEUR_LABELS);
  typeLabels = TYPE_STATION_LABELS;
  sourceEauLabels = SOURCE_EAU_LABELS;
  typePromoteurLabels = TYPE_PROMOTEUR_LABELS;

  form = this.fb.group({
    nom: ["", [Validators.required, Validators.maxLength(200)]],
    date_creation: [""],
    province: ["", Validators.required],
    departement: [""],
    localite: [""],
    adresse: [""],
    latitude: [null as number | null],
    longitude: [null as number | null],
    type_station: ["", Validators.required],
    superficie_totale: [null as number | null],
    nombre_bassins: [null as number | null],
    capacite_production: [null as number | null],
    source_eau: [""],
    especes: [[] as string[]], // multi-select -> join(',') à l'envoi
    promoteur_nom: ["", [Validators.required, Validators.maxLength(200)]],
    promoteur_contact: [""],
    promoteur_type: ["PRIVE"],
    numero_agrement: [""],
    date_agrement: [""],
    date_expiration_agrement: [""],
    observations: [""],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get("id");
    if (id) {
      this.modeEdition = true;
      this.stationId = +id;
      this.chargerStation(+id);
    } else {
      this.initMaterialize();
    }
  }

  private chargerStation(id: number): void {
    this.service.obtenir(id).subscribe({
      next: (station) => {
        this.codeStation = station.code_station;
        this.form.patchValue({
          ...station,
          date_creation: station.date_creation || "",
          date_agrement: station.date_agrement || "",
          date_expiration_agrement: station.date_expiration_agrement || "",
          source_eau: station.source_eau || "",
          // Chaîne "TILAPIA,CLARIAS" -> tableau pour le multi-select
          especes: station.especes_elevees
            ? station.especes_elevees.split(",").filter((e) => e.trim())
            : [],
        } as any);
        this.initMaterialize();
      },
      error: () => {
        M.toast({ html: "Station introuvable", classes: "red" });
        this.router.navigate(["/stations-piscicoles"]);
      },
    });
  }

  private initMaterialize(): void {
    // Init APRÈS patchValue pour que les selects reflètent les valeurs du form
    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"));
      M.updateTextFields();
    }, 0);
  }

  invalide(champ: string): boolean {
    const ctrl = this.form.get(champ);
    return !!ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched);
  }

  enregistrer(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      M.toast({
        html: "Veuillez corriger les champs en erreur",
        classes: "red",
      });
      return;
    }

    const v = this.form.value;
    const payload: any = {
      ...v,
      // Tableau -> chaîne séparée par virgules pour le backend
      especes_elevees: (v.especes || []).join(",") || null,
      source_eau: v.source_eau || null,
      date_creation: v.date_creation || null,
      date_agrement: v.date_agrement || null,
      date_expiration_agrement: v.date_expiration_agrement || null,
      numero_agrement: v.numero_agrement || null,
    };
    delete payload.especes;

    this.enregistrement = true;
    const requete = this.modeEdition
      ? this.service.modifier({ ...payload, id: this.stationId! })
      : this.service.creer(payload);

    requete.subscribe({
      next: (station) => {
        this.enregistrement = false;
        M.toast({
          html: this.modeEdition
            ? `Station ${station.code_station} mise à jour`
            : `Station ${station.code_station} créée`,
          classes: "green",
        });
        this.router.navigate(["/stations-piscicoles", station.id, "details"]);
      },
      error: (err) => {
        this.enregistrement = false;
        M.toast({
          html: err?.error?.detail || "Erreur lors de l'enregistrement",
          classes: "red",
        });
      },
    });
  }
}
