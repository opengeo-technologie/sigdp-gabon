import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, ActivatedRoute, Router } from "@angular/router";
import { BateauService } from "../../../services/bateau.service";
import { Bateau } from "../../../models/bateau.model";
import { environment } from "../../../../environments/environment";
import { HasPermissionDirective } from "../../../directives/has-permission.directive";

declare var M: any;

@Component({
  selector: "app-bateau-detail",
  standalone: true,
  imports: [CommonModule, RouterModule, HasPermissionDirective],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1>
          <i class="material-icons left">directions_boat</i> Détails du bateau
        </h1>
      </div>
    </div>

    <div class="container-fluid" *ngIf="bateau">
      <div class="row">
        <div class="col s12">
          <a routerLink="/bateaux" class="btn btn-flat waves-effect">
            <i class="material-icons left">arrow_back</i>Retour
          </a>
          <a
            [routerLink]="['/bateaux', bateau.id, 'edit']"
            class="btn btn-primary waves-effect"
            *appHasPermission="'bateau.update'"
          >
            <i class="material-icons left">edit</i>Modifier
          </a>
          <a
            (click)="deleteBateau()"
            class="btn red waves-effect"
            *appHasPermission="'bateau.delete'"
          >
            <i class="material-icons left">delete</i>Supprimer
          </a>
        </div>
      </div>

      <div class="row">
        <div class="col s12 l8">
          <div class="card">
            <div class="card-content">
              <span class="card-title">
                {{ bateau.nom_bateau || bateau.numero_immatriculation }}
                <span class="badge" [ngClass]="bateau.statut">{{
                  bateau.statut
                }}</span>
              </span>

              <div class="row">
                <div class="col s12 m6">
                  <p>
                    <strong>Immatriculation:</strong>
                    {{ bateau.numero_immatriculation }}
                  </p>
                  <p><strong>Type:</strong> {{ bateau.type_bateau }}</p>
                  <p><strong>Propulsion:</strong> {{ bateau.propulsion }}</p>
                  <p><strong>Matériau:</strong> {{ bateau.materiau_coque }}</p>
                </div>
                <div class="col s12 m6">
                  <p *ngIf="bateau.longueur_hors_tout">
                    <strong>Longueur:</strong> {{ bateau.longueur_hors_tout }} m
                  </p>
                  <p *ngIf="bateau.largeur">
                    <strong>Largeur:</strong> {{ bateau.largeur }} m
                  </p>
                  <p *ngIf="bateau.jauge_brute">
                    <strong>Jauge:</strong> {{ bateau.jauge_brute }} t
                  </p>
                </div>
              </div>

              <div class="divider" *ngIf="bateau.proprietaire_info"></div>

              <div *ngIf="bateau.proprietaire_info">
                <h6>Propriétaire</h6>
                <p>
                  {{ bateau.proprietaire_info.nom }}
                  {{ bateau.proprietaire_info.prenom }}
                </p>
                <p>
                  <small>{{ bateau.proprietaire_info.numero_carte }}</small>
                </p>
                <a
                  [routerLink]="['/pecheurs', bateau.proprietaire_info.id]"
                  class="btn-small"
                  *appHasPermission="'pecheur.view'"
                >
                  Voir fiche pêcheur
                </a>
              </div>

              <div class="divider" *ngIf="bateau.photo_url"></div>

              <div class="row" *ngIf="bateau.photo_url">
                <div class="col s12 m6">
                  <h6 class="mt-2">Photo bateau</h6>
                  <div *ngIf="bateau.photo_url">
                    <img
                      [src]="url + bateau.photo_url"
                      alt="Photo de {{ bateau.numero_immatriculation }}"
                      class="responsive-img"
                      style="max-width: 200px; border-radius: 8px;"
                    />
                  </div>
                </div>
                <div class="col s12 m6">
                  <h6 class="mt-2">Engins de pêche</h6>
                  <p *ngFor="let item of listEnginsPeche">
                    <i class="material-icons tiny" [class.green-text]="true">
                      check_circle</i
                    >
                    {{ item }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col s12 l4">
          <div class="card">
            <div class="card-content">
              <span class="card-title">Certificat</span>
              <p *ngIf="bateau.certificat_navigabilite_numero">
                <strong>N°:</strong> {{ bateau.certificat_navigabilite_numero }}
              </p>
              <p *ngIf="bateau.certificat_navigabilite_date_expiration">
                <strong>Expire le:</strong>
                {{
                  bateau.certificat_navigabilite_date_expiration
                    | date: "dd/MM/yyyy"
                }}
                <br />
                <span
                  class="badge"
                  [ngClass]="bateau.certificat_valide ? 'green' : 'red'"
                >
                  {{ bateau.certificat_valide ? "Valide" : "Expiré" }}
                </span>
              </p>
            </div>
          </div>

          <div class="card">
            <div class="card-content">
              <span class="card-title">Sécurité</span>
              <p>
                <i
                  class="material-icons tiny"
                  [class.green-text]="bateau.equipement_gilets_sauvetage"
                >
                  {{
                    bateau.equipement_gilets_sauvetage
                      ? "check_circle"
                      : "cancel"
                  }}</i
                >
                Gilets
              </p>
              <p>
                <i
                  class="material-icons tiny"
                  [class.green-text]="bateau.equipement_extincteur"
                >
                  {{
                    bateau.equipement_extincteur ? "check_circle" : "cancel"
                  }}</i
                >
                Extincteur
              </p>
              <p>
                <i
                  class="material-icons tiny"
                  [class.green-text]="bateau.equipement_radio_vhf"
                >
                  {{
                    bateau.equipement_radio_vhf ? "check_circle" : "cancel"
                  }}</i
                >
                Radio VHF
              </p>
              <p>
                <i
                  class="material-icons tiny"
                  [class.green-text]="bateau.equipement_gps"
                >
                  {{ bateau.equipement_gps ? "check_circle" : "cancel" }}</i
                >
                GPS
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="spinner-container" *ngIf="!bateau">
      <div class="preloader-wrapper big active">
        <div class="spinner-layer spinner-blue-only">
          <div class="circle-clipper left"><div class="circle"></div></div>
          <div class="gap-patch"><div class="circle"></div></div>
          <div class="circle-clipper right"><div class="circle"></div></div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      h6 {
        color: #0d47a1;
        font-weight: 500;
      }
      .divider {
        margin: 1.5rem 0;
      }
      .badge.Actif {
        background-color: #4caf50;
        color: white;
      }
    `,
  ],
})
export class BateauDetailComponent implements OnInit {
  bateau?: Bateau;
  bateauId?: number;
  listEnginsPeche: string[] = [];

  url: any = `${environment.apiUrl}/uploads/bateaux/`;

  constructor(
    private bateauService: BateauService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.bateauId = +params["id"];
      this.loadBateau();
    });
  }

  loadBateau() {
    if (this.bateauId) {
      this.bateauService.getBateau(this.bateauId).subscribe({
        next: (d) => {
          console.log("Données du bateau chargées:", d);
          this.bateau = d;
          this.listEnginsPeche = d.engins_peche
            ? d.engins_peche.split(",").map((e) => e.trim())
            : [];
        },
        error: (e) => {
          console.error(e);
          M.toast({ html: "Erreur", classes: "red" });
          this.router.navigate(["/bateaux"]);
        },
      });
    }
  }

  deleteBateau() {
    if (
      this.bateau &&
      confirm(
        `Supprimer "${this.bateau.nom_bateau || this.bateau.numero_immatriculation}" ?`,
      )
    ) {
      this.bateauService.deleteBateau(this.bateau.id).subscribe({
        next: () => {
          M.toast({ html: "Supprimé", classes: "green" });
          this.router.navigate(["/bateaux"]);
        },
        error: (e) => {
          console.error(e);
          M.toast({ html: "Erreur", classes: "red" });
        },
      });
    }
  }
}
