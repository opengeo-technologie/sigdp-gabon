import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, ActivatedRoute, Router } from "@angular/router";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { PecheurService } from "../../../services/pecheur.service";
import { BateauService } from "../../../services/bateau.service";
import { CardGeneratorService } from "../../../services/card-generator.service";
import { Pecheur } from "../../../models/pecheur.model";
import { Bateau } from "../../../models/bateau.model";
import { environment } from "../../../../environments/environment";
import { HasPermissionDirective } from "../../../directives/has-permission.directive";

declare var M: any;

@Component({
  selector: "app-pecheur-detail",
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1>
          <i class="material-icons left">person</i>
          Détails du pêcheur
        </h1>
      </div>
    </div>

    <div class="container-fluid" *ngIf="pecheur">
      <div class="row">
        <div class="col s12">
          <div class="btn-group" role="group">
            <a routerLink="/pecheurs" class="btn btn-flat waves-effect">
              <i class="material-icons left">arrow_back</i>
              Retour à la liste
            </a>
            <a
              [routerLink]="['/pecheurs', pecheur.id, 'edit']"
              class="btn btn-primary waves-effect waves-light"
            >
              <i class="material-icons left">edit</i>
              Modifier
            </a>
            <!-- <a
            (click)="downloadCarte()"
            class="btn teal waves-effect waves-light"
          >
            <i class="material-icons left">download</i>
            Télécharger PNG
          </a>
          <a
            (click)="downloadCartePDF()"
            class="btn blue waves-effect waves-light"
          >
            <i class="material-icons left">picture_as_pdf</i>
            Télécharger PDF
          </a> -->
            <a
              (click)="printCarte()"
              class="btn orange waves-effect waves-light"
            >
              <i class="material-icons left">print</i>
              Imprimer
            </a>
            <a
              (click)="deletePecheur()"
              class="btn red waves-effect waves-light"
            >
              <i class="material-icons left">delete</i>
              Supprimer
            </a>
          </div>
        </div>
      </div>

      <div class="row">
        <!-- Informations principales -->
        <div class="col s12 l8">
          <div class="card">
            <div class="card-content">
              <span class="card-title">
                {{ pecheur.nom }} {{ pecheur.prenom }}
                <span class="badge" [ngClass]="getStatutClass()">
                  {{ pecheur.statut }}
                </span>
              </span>

              <div class="row">
                <div class="col s12 m6">
                  <p><strong>Numéro CNP:</strong> {{ pecheur.numero_carte }}</p>
                  <p>
                    <strong>Date de naissance:</strong>
                    {{ pecheur.date_naissance | date: "dd/MM/yyyy" }}
                  </p>
                  <p><strong>Âge:</strong> {{ pecheur.age }} ans</p>
                  <p *ngIf="pecheur.lieu_naissance">
                    <strong>Lieu de naissance:</strong>
                    {{ pecheur.lieu_naissance }}
                  </p>
                  <p><strong>Nationalité:</strong> {{ pecheur.nationalite }}</p>
                </div>
                <div class="col s12 m6">
                  <p>
                    <strong>Catégorie:</strong>
                    <span class="badge blue lighten-4 blue-text text-darken-4">
                      {{ pecheur.categorie }}
                    </span>
                  </p>
                  <p *ngIf="pecheur.debarcadere_habituel_code">
                    <strong>Débarcadère habituel:</strong>
                    {{ pecheur.debarcadere_habituel_code }}
                  </p>
                </div>
              </div>

              <div class="divider"></div>

              <h6 class="mt-2">Contact</h6>
              <div class="row">
                <div class="col s12 m6">
                  <p *ngIf="pecheur.telephone">
                    <i class="material-icons tiny">phone</i>
                    {{ pecheur.telephone }}
                  </p>
                  <p *ngIf="pecheur.email">
                    <i class="material-icons tiny">email</i> {{ pecheur.email }}
                  </p>
                </div>
                <div class="col s12 m6">
                  <p *ngIf="pecheur.adresse">
                    <i class="material-icons tiny">home</i>
                    {{ pecheur.adresse }}
                  </p>
                </div>
              </div>

              <div class="divider" *ngIf="pecheur.contact_urgence_nom"></div>
              <div class="divider"></div>
              <h6 class="mt-2">Photo pêcheur</h6>
              <div *ngIf="pecheur.photo_url">
                <img
                  [src]="url + pecheur.photo_url"
                  alt="Photo de {{ pecheur.nom }}"
                  class="responsive-img"
                  style="max-width: 200px; border-radius: 8px;"
                />
              </div>
              <div *ngIf="pecheur.contact_urgence_nom">
                <h6 class="mt-2">Contact d'urgence</h6>
                <p><strong>Nom:</strong> {{ pecheur.contact_urgence_nom }}</p>
                <p *ngIf="pecheur.contact_urgence_telephone">
                  <strong>Téléphone:</strong>
                  {{ pecheur.contact_urgence_telephone }}
                </p>
                <p *ngIf="pecheur.contact_urgence_relation">
                  <strong>Relation:</strong>
                  {{ pecheur.contact_urgence_relation }}
                </p>
              </div>
            </div>
          </div>

          <!-- Bateaux du pêcheur -->
          <div class="card" *ngIf="bateaux.length > 0">
            <div class="card-content">
              <span class="card-title">
                <i class="material-icons left">directions_boat</i>
                Bateaux ({{ bateaux.length }})
              </span>
              <table class="highlight">
                <thead>
                  <tr>
                    <th>Immatriculation</th>
                    <th>Nom</th>
                    <th>Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let bateau of bateaux">
                    <td>
                      <strong>{{ bateau.numero_immatriculation }}</strong>
                    </td>
                    <td>{{ bateau.nom_bateau || "Sans nom" }}</td>
                    <td>{{ bateau.type_bateau }}</td>
                    <td>
                      <a
                        [routerLink]="['/bateaux', bateau.id]"
                        class="btn-small btn-flat"
                      >
                        <i class="material-icons">visibility</i>
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Carte et QR code -->
        <div class="col s12 l4">
          <!-- Carte de pêcheur -->
          <div class="card">
            <div class="card-content">
              <span class="card-title">Aperçu de la carte</span>
              <div id="card-preview" class="carte-preview">
                <!-- La carte sera générée dynamiquement -->
                <!-- <div *ngIf="cardHtml" [innerHtml]="cardHtml"></div> -->
                <div class="center-align" style="padding: 2rem;">
                  <i class="material-icons large grey-text">credit_card</i>
                  <p class="grey-text">
                    Cliquez sur "Télécharger PNG" ou "Imprimer" pour générer la
                    carte
                  </p>
                </div>
              </div>
              <p class="center-align mt-2">
                <!-- <a
                  (click)="downloadCarte()"
                  class="btn btn-small waves-effect waves-light teal"
                >
                  <i class="material-icons left">download</i>
                  PNG
                </a>
                <a
                  (click)="downloadCartePDF()"
                  class="btn btn-small waves-effect waves-light blue"
                  style="margin-left: 8px;"
                >
                  <i class="material-icons left">picture_as_pdf</i>
                  PDF
                </a> -->
                <a
                  (click)="printCarte()"
                  class="btn btn-small waves-effect waves-light orange"
                  style="margin-left: 8px;"
                >
                  <i class="material-icons left">print</i>
                  Imprimer
                </a>
              </p>
            </div>
          </div>

          <!-- Métadonnées -->
          <div class="card">
            <div class="card-content">
              <span class="card-title">Informations système</span>
              <p>
                <small
                  ><strong>Créé le:</strong>
                  {{ pecheur.created_at | date: "dd/MM/yyyy à HH:mm" }}</small
                >
              </p>
              <p *ngIf="pecheur.updated_at">
                <small
                  ><strong>Modifié le:</strong>
                  {{ pecheur.updated_at | date: "dd/MM/yyyy à HH:mm" }}</small
                >
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div class="spinner-container" *ngIf="!pecheur">
      <div class="preloader-wrapper big active">
        <div class="spinner-layer spinner-blue-only">
          <div class="circle-clipper left">
            <div class="circle"></div>
          </div>
          <div class="gap-patch">
            <div class="circle"></div>
          </div>
          <div class="circle-clipper right">
            <div class="circle"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .carte-preview,
      .qr-preview {
        background-color: #f5f5f5;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
      }

      .carte-preview > div {
        /* Styles pour le contenu HTML généré à l'intérieur du conteneur */
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        /* Si le contenu doit être mis à l'échelle pour s'adapter, utilisez transform: scale() */
        /* transform: scale(0.8); */ /* Exemple de mise à l'échelle */
        /* transform-origin: center center; */
      }

      /* Ajustements pour le HTML généré si nécessaire pour mieux s'adapter */
      .carte-preview div > div {
        max-width: 100%;
        max-height: 100%;
        overflow: auto; /* Permet le défilement si le contenu est trop grand même après scaling */
        box-sizing: border-box; /* Inclut padding et border dans la largeur/hauteur */
      }

      .mt-2 {
        margin-top: 1rem;
      }

      .divider {
        margin: 1.5rem 0;
      }

      h6 {
        color: #0d47a1;
        font-weight: 500;
      }

      .badge.actif {
        background-color: #4caf50;
        color: white;
      }

      .badge.inactif {
        background-color: #757575;
        color: white;
      }

      .badge.suspendu {
        background-color: #ff9800;
        color: white;
      }
    `,
  ],
})
export class PecheurDetailComponent implements OnInit {
  pecheur?: Pecheur;
  pecheurId?: number;
  bateaux: Bateau[] = [];
  cardHtml: SafeHtml | undefined;

  url: any = `${environment.apiUrl}/`;

  constructor(
    private pecheurService: PecheurService,
    private bateauService: BateauService,
    private cardGeneratorService: CardGeneratorService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.pecheurId = +params["id"];
      this.loadPecheur();
      this.loadBateaux();
    });
  }

  loadPecheur() {
    if (this.pecheurId) {
      this.pecheurService.getPecheur(this.pecheurId).subscribe({
        next: (data) => {
          // console.log("Pêcheur chargé:", data);
          this.pecheur = data;
          this.pecheurService.getPecheurPhotoUrl(this.pecheur.id).subscribe({
            next: async (response) => {
              if (response && this.pecheur) {
                this.pecheur.photo_url = response.photo_path;
                const qrCodeUrl =
                  await this.cardGeneratorService.generateQRCode(this.pecheur);
                const generatedHtml =
                  this.cardGeneratorService.generateCardHTML(
                    this.pecheur,
                    qrCodeUrl,
                    this.pecheur.photo_url,
                  );
                // Assainir le HTML pour le rendre sûr pour l'affichage
                this.cardHtml =
                  this.sanitizer.bypassSecurityTrustHtml(generatedHtml);
              }
            },
            error: (error) => {
              console.error("Erreur lors du chargement de la photo:", error);
            },
          });
        },
        error: (error) => {
          console.error("Erreur lors du chargement:", error);
          M.toast({
            html: "Erreur lors du chargement du pêcheur",
            classes: "red",
          });
          this.router.navigate(["/pecheurs"]);
        },
      });
    }
  }

  loadBateaux() {
    if (this.pecheurId) {
      this.bateauService.getBateauxByProprietaire(this.pecheurId).subscribe({
        next: (data) => {
          this.bateaux = data;
        },
        error: (error) => {
          console.error("Erreur lors du chargement des bateaux:", error);
        },
      });
    }
  }

  deletePecheur() {
    if (
      this.pecheur &&
      confirm(
        `Êtes-vous sûr de vouloir supprimer le pêcheur "${this.pecheur.nom} ${this.pecheur.prenom}" ?`,
      )
    ) {
      this.pecheurService.deletePecheur(this.pecheur.id).subscribe({
        next: () => {
          M.toast({ html: "Pêcheur supprimé avec succès", classes: "green" });
          this.router.navigate(["/pecheurs"]);
        },
        error: (error) => {
          console.error("Erreur lors de la suppression:", error);
          M.toast({ html: "Erreur lors de la suppression", classes: "red" });
        },
      });
    }
  }

  async downloadCarte() {
    if (this.pecheur) {
      try {
        M.toast({
          html: "Génération de la carte en cours...",
          classes: "blue",
        });
        if (this.pecheur.photo_url) {
          await this.cardGeneratorService.downloadCardPNG(
            this.pecheur,
            this.url + this.pecheur.photo_url,
          );
        } else {
          await this.cardGeneratorService.downloadCardPNG(this.pecheur);
        }
        M.toast({ html: "Carte téléchargée avec succès", classes: "green" });
      } catch (error) {
        console.error("Erreur:", error);
        M.toast({
          html: "Erreur lors de la génération de la carte",
          classes: "red",
        });
      }
    }
  }

  async downloadCartePDF() {
    if (this.pecheur) {
      try {
        M.toast({ html: "Génération du PDF en cours...", classes: "blue" });
        if (this.pecheur.photo_url) {
          await this.cardGeneratorService.generateCardPDF(
            this.pecheur,
            this.url + this.pecheur.photo_url,
          );
        } else {
          await this.cardGeneratorService.generateCardPDF(this.pecheur);
        }
        M.toast({ html: "PDF téléchargé avec succès", classes: "green" });
      } catch (error) {
        console.error("Erreur:", error);
        M.toast({
          html: "Erreur lors de la génération du PDF",
          classes: "red",
        });
      }
    }
  }

  async printCarte() {
    if (this.pecheur) {
      try {
        M.toast({ html: "Préparation de l'impression...", classes: "blue" });
        if (this.pecheur.photo_url) {
          await this.cardGeneratorService.printCard(
            this.pecheur,
            this.url + this.pecheur.photo_url,
          );
        } else {
          await this.cardGeneratorService.printCard(this.pecheur);
        }
      } catch (error) {
        console.error("Erreur:", error);
        M.toast({ html: "Erreur lors de l'impression", classes: "red" });
      }
    }
  }

  getStatutClass(): string {
    if (!this.pecheur) return "";
    const classes: { [key: string]: string } = {
      Actif: "actif",
      Inactif: "inactif",
      Suspendu: "suspendu",
    };
    return classes[this.pecheur.statut] || "";
  }
}
