import { TypeCooperative } from "./../../../models/armement-cooperative.model";
import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, ActivatedRoute, Router } from "@angular/router";
import { BateauService } from "../../../services/bateau.service";
import { Bateau } from "../../../models/bateau.model";
import { environment } from "../../../../environments/environment";
import { HasPermissionDirective } from "../../../directives/has-permission.directive";
import { LicencesAutorisationsService } from "../../../services/licences-autorisations.service";
import { AutorisationPechePdfService } from "../../../services/autorisation-pdf.service";
import { ImageHelperService } from "../../../services/image-helper.service";

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
              <div class="row">
                <div class="col s12 m6" *ngIf="bateau.proprietaire_info">
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
                  >
                    Voir fiche pêcheur
                  </a>
                </div>
                <div
                  class="col s12 m6"
                  *ngIf="bateau.cooperative_armement_info"
                >
                  <h6>Coopérative / Armement</h6>
                  <p>{{ bateau.cooperative_armement_info.denomination }}</p>
                  <p>
                    <small>{{ bateau.cooperative_armement_info.code }}</small>
                  </p>
                  <a
                    [routerLink]="[
                      '/armements-cooperatives',
                      bateau.cooperative_armement_info.id,
                    ]"
                    class="btn-small"
                  >
                    Voir fiche de la coopérative ou armement
                  </a>
                </div>
              </div>

              <div class="divider" *ngIf="bateau.site_port_attache_info"></div>

              <div class="row">
                <div class="col s12 m6" *ngIf="bateau.site_port_attache_info">
                  <h6>Site d'attache / Port d'attache</h6>
                  <p>
                    {{ bateau.site_port_attache_info.nom }} -
                    {{ bateau.site_port_attache_info.localisation }}
                  </p>
                </div>
                <div
                  class="col s12 m6"
                  *ngIf="
                    bateau.site_obligatoire_info &&
                    bateau.site_obligatoire_info.length > 0
                  "
                >
                  <h6>Site de débarquement</h6>
                  @for (site of bateau.site_obligatoire_info; track site.id) {
                    <p>{{ site.nom }} - {{ site.localisation }}</p>
                  }
                </div>
              </div>
              <div class="divider"></div>

              <div class="row">
                <div class="col s12 m12" *ngIf="bateau.photo_url">
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
                <div class="col s12 m12">
                  <h6 class="mt-2">Engins de pêche</h6>
                  <div class="row">
                    <p *ngFor="let item of listEnginsPeche" class="col s12 m4">
                      <i
                        class="material-icons tiny"
                        *ngIf="
                          item.id == bateau.engins_peche_principal ||
                          item.id == bateau.engins_peche_secondaires
                        "
                        [class.green-text]="true"
                      >
                        check_circle</i
                      >
                      <i
                        class="material-icons tiny"
                        *ngIf="
                          item.id != bateau.engins_peche_principal &&
                          item.id != bateau.engins_peche_secondaires
                        "
                        [class.grey-text]="true"
                      >
                        cancel</i
                      >
                      {{ item.libelle }}
                      @if (item.id == bateau.engins_peche_principal) {
                        <span class="blue-text">(Engin principal)</span>
                      }
                      @if (item.id == bateau.engins_peche_secondaires) {
                        <span class="red-text">(Engin secondaire)</span>
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col s12 l4">
          <div class="card">
            <div class="card-content">
              <span class="card-title">Licences</span>
              <table>
                <thead>
                  <tr>
                    <th>Numéro</th>
                    <th>Année</th>
                    <th>Etat</th>
                    <th>Montant</th>
                    <th>Détail</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let licence of licences">
                    <td>{{ licence.numero_licence }}</td>
                    <td>{{ licence.annee }}</td>
                    <td>
                      <span
                        class="badge"
                        [ngClass]="
                          licence.est_active
                            ? 'green white-text'
                            : 'red white-text'
                        "
                      >
                        {{ licence.est_active ? "Valide" : "Expiré" }}
                      </span>
                    </td>
                    <td>{{ licence.montant || 0 }}</td>
                    <td>
                      <a
                        (click)="generatePDf(licence.id)"
                        class="btn-small btn-flat waves-effect"
                        title="Voir détails"
                      >
                        <i class="material-icons">visibility</i>
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
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
  listEnginsPeche: any[] = [];
  licences: any[] = [];

  url: any = `${environment.apiUrl}/uploads/bateaux/`;

  constructor(
    private bateauService: BateauService,
    private licenceService: LicencesAutorisationsService,
    private pdf: AutorisationPechePdfService,
    private imageHelper: ImageHelperService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.bateauId = +params["id"];
      this.loadBateau();
      this.getLicencesByBateau();
      this.getEnginsPeche();
    });
  }

  loadBateau() {
    if (this.bateauId) {
      this.bateauService.getBateau(this.bateauId).subscribe({
        next: (d) => {
          console.log("Données du bateau chargées:", d);
          this.bateau = d;
          // this.listEnginsPeche = d.engins_peche
          //   ? d.engins_peche.split(",").map((e) => e.trim())
          //   : [];
        },
        error: (e) => {
          console.error(e);
          M.toast({ html: "Erreur", classes: "red" });
          this.router.navigate(["/bateaux"]);
        },
      });
    }
  }

  getLicencesByBateau() {
    if (this.bateauId) {
      this.licenceService.getLicencesByBateauId(this.bateauId).subscribe({
        next: (d) => {
          // console.log("Données du bateau chargées:", d);
          this.licences = d;
        },
        error: (e) => {
          console.error(e);
          M.toast({ html: "Erreur", classes: "red" });
          this.router.navigate(["/bateaux"]);
        },
      });
    }
  }

  getEnginsPeche() {
    this.bateauService.getEngins().subscribe({
      next: (d) => {
        // console.log("Données du bateau chargées:", d);
        this.listEnginsPeche = d;
      },
      error: (e) => {
        console.error(e);
        M.toast({ html: "Erreur", classes: "red" });
        this.router.navigate(["/bateaux"]);
      },
    });
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

  listSiteDebarquement(site_obligatoire: any[]): string {
    if (!site_obligatoire || site_obligatoire.length === 0) {
      return "N/A";
    }
    return site_obligatoire.map((s) => s.nom).join(", ");
  }

  checkProprietaireType(type: string): "NATIONAL" | "ETRANGER" {
    return type === "Gabonaise" ? "NATIONAL" : "ETRANGER";
  }

  async generatePDf(licenceId: number) {
    const logoBase64 = await this.imageHelper.getBase64ImageFromURL(
      "../../../assets/logo.jpg",
    );

    this.licenceService.getLicence(licenceId).subscribe({
      next: (data) => {
        // console.log("Données de la licence:", data);
        // this.pdfService.generateLicencePDF(data);
        this.pdf.open({
          numero: data.numero_licence.padStart(3, "0"),
          anneeValidite: data.annee_validite,
          proprietaireType: this.checkProprietaireType(
            data.proprietaire_info.nationalite,
          ),
          embarcation: {
            nom: data.bateau_info.nom,
            immatriculation: data.bateau_info.immatriculation,
            typePirogue: data.bateau_info.type_bateau,
            marqueMoteur: data.bateau_info.moteur_marque || "N/A",
            puissanceCv: data.bateau_info.moteur_puissance_cv,
            debarcadereAttache: data.bateau_info.site_port_attache.nom,
            siteDebarquement: this.listSiteDebarquement(
              data.bateau_info.site_obligatoire,
            ),
          },
          proprietaire: {
            nom:
              data.proprietaire_info.nom + " " + data.proprietaire_info.prenom,
            nationalite: data.proprietaire_info.nationalite,
            typePiece: data.proprietaire_info.type_piece_identite || "N/A",
            numeroPiece: data.proprietaire_info.numero_piece_identite || "N/A",
            residence: data.proprietaire_info.adresse || "N/A",
            telephone: data.proprietaire_info.telephone || "N/A",
            cooperative: data.bateau_info.cooperative.denomination || "N/A",
          },
          engins: {
            engin1: "Senne tournante",
            especes1: "Sardine",
            codeBarre: "SIGDP-AUTH-452-2026",
          },
          periodeDebut: data.date_debut
            ? new Date(data.date_debut).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "N/A",
          periodeFin: data.date_expiration
            ? new Date(data.date_expiration).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "N/A",
          montantFcfa: 200000,
          quittanceTresor: "2419",
          faitA: "Libreville",
          dateFait: data.date_emission
            ? new Date(data.date_emission).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })
            : "N/A",
          signataire: "Brice Didier Celce KOUMBA MABERT",
          logoBase64: logoBase64,
        });
      },
      error: (error) => {
        console.error("Erreur lors de la récupération de la licence:", error);
        M.toast({
          html: "Erreur lors de la récupération de la licence",
          classes: "red",
        });
      },
    });
  }
}
