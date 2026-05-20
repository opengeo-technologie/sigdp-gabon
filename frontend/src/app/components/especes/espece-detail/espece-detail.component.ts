import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { EspeceService } from '../../../services/espece.service';
import { Espece } from '../../../models/espece.model';

declare var M: any;

@Component({
  selector: 'app-espece-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1><i class="material-icons left">set_meal</i> Détails de l'espèce</h1>
      </div>
    </div>

    <div class="container-fluid" *ngIf="espece">
      <div class="row">
        <div class="col s12">
          <a routerLink="/especes" class="btn btn-flat waves-effect">
            <i class="material-icons left">arrow_back</i>Retour
          </a>
          <a [routerLink]="['/especes', espece.id, 'edit']" class="btn btn-primary waves-effect">
            <i class="material-icons left">edit</i>Modifier
          </a>
          <a (click)="deleteEspece()" class="btn red waves-effect">
            <i class="material-icons left">delete</i>Supprimer
          </a>
        </div>
      </div>

      <div class="row">
        <div class="col s12 l8">
          <div class="card">
            <div class="card-image" *ngIf="espece.photo_url">
              <img [src]="getPhotoUrl()" alt="{{ espece.nom_commun_francais }}">
            </div>
            <div class="card-content">
              <span class="card-title">
                {{ espece.nom_commun_francais }}
                <span class="badge" [ngClass]="getStatutClass()">{{ espece.statut_reglementaire }}</span>
              </span>
              
              <p><strong>Nom scientifique:</strong> <em>{{ espece.nom_scientifique }}</em></p>
              <p><strong>Code:</strong> {{ espece.code_espece }}</p>
              <p><strong>Catégorie:</strong> {{ espece.categorie }}</p>
              
              <div class="divider" *ngIf="espece.nom_commun_fang || espece.nom_commun_myene"></div>
              
              <div *ngIf="espece.nom_commun_fang || espece.nom_commun_myene">
                <h6>Noms locaux</h6>
                <p *ngIf="espece.nom_commun_fang"><strong>Fang:</strong> {{ espece.nom_commun_fang }}</p>
                <p *ngIf="espece.nom_commun_myene"><strong>Myènè:</strong> {{ espece.nom_commun_myene }}</p>
              </div>

              <div class="divider"></div>

              <h6>Réglementation</h6>
              <p *ngIf="espece.taille_minimale_legale_cm">
                <strong>Taille minimale légale:</strong> {{ espece.taille_minimale_legale_cm }} cm
              </p>
              <p *ngIf="espece.quota_mensuel_tonnes">
                <strong>Quota mensuel:</strong> {{ espece.quota_mensuel_tonnes }} tonnes
              </p>
              <p *ngIf="espece.quota_annuel_tonnes">
                <strong>Quota annuel:</strong> {{ espece.quota_annuel_tonnes }} tonnes
              </p>

              <div class="divider" *ngIf="espece.prix_reference_kg_min"></div>

              <div *ngIf="espece.prix_reference_kg_min">
                <h6>Valeur commerciale</h6>
                <p><strong>Prix de référence:</strong> 
                  {{ espece.prix_reference_kg_min }} - {{ espece.prix_reference_kg_max }} FCFA/kg
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="col s12 l4">
          <div class="card" *ngIf="espece.statut_reglementaire === 'Protégé'">
            <div class="card-content red lighten-5">
              <span class="card-title red-text">
                <i class="material-icons left">warning</i>Espèce protégée
              </span>
              <p>La capture de cette espèce est strictement interdite.</p>
            </div>
          </div>

          <div class="card" *ngIf="espece.statut_reglementaire === 'Sous quota'">
            <div class="card-content orange lighten-5">
              <span class="card-title orange-text">
                <i class="material-icons left">info</i>Sous quota
              </span>
              <p>Captures limitées par un système de quotas.</p>
            </div>
          </div>

          <div class="card">
            <div class="card-content">
              <span class="card-title">Informations système</span>
              <p><small><strong>Créé le:</strong> {{ espece.created_at | date:'dd/MM/yyyy' }}</small></p>
              <p *ngIf="espece.updated_at">
                <small><strong>Modifié le:</strong> {{ espece.updated_at | date:'dd/MM/yyyy' }}</small>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="spinner-container" *ngIf="!espece">
      <div class="preloader-wrapper big active">
        <div class="spinner-layer spinner-blue-only">
          <div class="circle-clipper left"><div class="circle"></div></div>
          <div class="gap-patch"><div class="circle"></div></div>
          <div class="circle-clipper right"><div class="circle"></div></div>
        </div>
      </div>
    </div>
  `,
  styles: [`h6{color:#0d47a1;font-weight:500}.divider{margin:1.5rem 0}.badge.Libre{background-color:#4caf50;color:white}.badge.Protégé{background-color:#f44336;color:white}.badge.Sous-quota{background-color:#ff9800;color:white}`]
})
export class EspeceDetailComponent implements OnInit {
  espece?: Espece;
  especeId?: number;

  constructor(private especeService: EspeceService, private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.especeId = +params['id'];
      this.loadEspece();
    });
  }

  loadEspece() {
    if (this.especeId) {
      this.especeService.getEspece(this.especeId).subscribe({
        next: (d) => { this.espece = d; },
        error: (e) => { console.error(e); M.toast({ html: 'Erreur', classes: 'red' }); this.router.navigate(['/especes']); }
      });
    }
  }

  deleteEspece() {
    if (this.espece && confirm(`Supprimer "${this.espece.nom_commun_francais}" ?`)) {
      this.especeService.deleteEspece(this.espece.id).subscribe({
        next: () => { M.toast({ html: 'Supprimé', classes: 'green' }); this.router.navigate(['/especes']); },
        error: (e) => { console.error(e); M.toast({ html: 'Erreur', classes: 'red' }); }
      });
    }
  }

  getStatutClass(): string {
    return this.espece?.statut_reglementaire.replace(' ', '-').replace('é', 'e') || '';
  }

  getPhotoUrl(): string {
    return this.espece ? this.especeService.getPhotoUrl(this.espece.id) : '';
  }
}
