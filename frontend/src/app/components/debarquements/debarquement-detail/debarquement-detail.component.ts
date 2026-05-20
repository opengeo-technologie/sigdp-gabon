import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { DebarquementService } from '../../../services/debarquement.service';
import { Debarquement } from '../../../models/debarquement.model';

declare var M: any;

@Component({
  selector: 'app-debarquement-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header">
      <div class="container-fluid">
        <h1><i class="material-icons left">inventory</i> Détails du débarquement</h1>
      </div>
    </div>

    <div class="container-fluid" *ngIf="debarquement">
      <div class="row">
        <div class="col s12">
          <a routerLink="/debarquements" class="btn btn-flat waves-effect">
            <i class="material-icons left">arrow_back</i>Retour
          </a>
        </div>
      </div>

      <!-- Alertes -->
      <div class="row" *ngIf="debarquement.has_alertes">
        <div class="col s12">
          <div class="card red lighten-5">
            <div class="card-content">
              <span class="card-title red-text">
                <i class="material-icons left">warning</i>Alertes détectées
              </span>
              <div class="collection">
                <div class="collection-item red lighten-5" *ngIf="debarquement.alerte_espece_protegee">
                  <i class="material-icons red-text">error</i>
                  <strong>ESPÈCE PROTÉGÉE</strong> - Capture d'espèce protégée détectée
                </div>
                <div class="collection-item orange lighten-5" *ngIf="debarquement.alerte_quota_depasse">
                  <i class="material-icons orange-text">trending_up</i>
                  <strong>QUOTA DÉPASSÉ</strong> - Dépassement de quota mensuel
                </div>
                <div class="collection-item yellow lighten-4" *ngIf="debarquement.alerte_taille_illegale">
                  <i class="material-icons orange-text">straighten</i>
                  <strong>TAILLE ILLÉGALE</strong> - Capture sous taille minimale légale
                </div>
                <div class="collection-item yellow lighten-4" *ngIf="debarquement.alerte_bateau_non_conforme">
                  <i class="material-icons orange-text">directions_boat</i>
                  <strong>BATEAU NON CONFORME</strong> - Certificat de navigabilité expiré
                </div>
              </div>
              <p *ngIf="debarquement.alerte_details" class="grey-text">
                <small>{{ debarquement.alerte_details }}</small>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="row">
        <!-- Informations principales -->
        <div class="col s12 l8">
          <div class="card">
            <div class="card-content">
              <span class="card-title">
                {{ debarquement.numero_debarquement }}
                <span class="badge" [ngClass]="debarquement.has_alertes ? 'red white-text' : 'green white-text'">
                  {{ debarquement.has_alertes ? 'Avec alertes' : 'Conforme' }}
                </span>
              </span>
              
              <div class="row">
                <div class="col s12 m6">
                  <p><strong>Date:</strong> {{ debarquement.date_debarquement | date:'dd/MM/yyyy à HH:mm' }}</p>
                  <p><strong>Débarcadère:</strong> 
                    <a [routerLink]="['/debarcaderes', debarquement.debarcadere_id]">
                      {{ debarquement.debarcadere_nom }}
                    </a>
                  </p>
                  <p><strong>Pêcheur principal:</strong>
                    <a [routerLink]="['/pecheurs', debarquement.pecheur_principal_id]">
                      {{ debarquement.pecheur_nom }}
                    </a>
                  </p>
                  <p><strong>Bateau:</strong>
                    <a [routerLink]="['/bateaux', debarquement.bateau_id]">
                      {{ debarquement.bateau_immatriculation }}
                    </a>
                  </p>
                </div>
                <div class="col s12 m6">
                  <p *ngIf="debarquement.heure_depart_peche">
                    <strong>Heure départ:</strong> {{ debarquement.heure_depart_peche | date:'HH:mm' }}
                  </p>
                  <p *ngIf="debarquement.heure_arrivee_debarcadere">
                    <strong>Heure arrivée:</strong> {{ debarquement.heure_arrivee_debarcadere | date:'HH:mm' }}
                  </p>
                  <p *ngIf="debarquement.duree_sortie_heures">
                    <strong>Durée sortie:</strong> {{ debarquement.duree_sortie_heures }} heures
                  </p>
                  <p *ngIf="debarquement.nombre_pecheurs">
                    <strong>Nombre pêcheurs:</strong> {{ debarquement.nombre_pecheurs }}
                  </p>
                </div>
              </div>

              <div class="divider"></div>

              <h6>Zone de pêche</h6>
              <p *ngIf="debarquement.zone_peche_nom">
                <strong>Nom:</strong> {{ debarquement.zone_peche_nom }}
              </p>
              <p *ngIf="debarquement.zone_peche_latitude && debarquement.zone_peche_longitude">
                <strong>Coordonnées:</strong> 
                {{ debarquement.zone_peche_latitude }}, {{ debarquement.zone_peche_longitude }}
              </p>
              <p *ngIf="debarquement.zone_peche_profondeur_m">
                <strong>Profondeur:</strong> {{ debarquement.zone_peche_profondeur_m }} m
              </p>

              <div class="divider" *ngIf="debarquement.meteo_conditions"></div>

              <div *ngIf="debarquement.meteo_conditions">
                <h6>Conditions météo</h6>
                <p><strong>Conditions:</strong> {{ debarquement.meteo_conditions }}</p>
                <p *ngIf="debarquement.meteo_etat_mer">
                  <strong>État de la mer:</strong> {{ debarquement.meteo_etat_mer }}
                </p>
                <p *ngIf="debarquement.meteo_temperature_c">
                  <strong>Température:</strong> {{ debarquement.meteo_temperature_c }}°C
                </p>
              </div>

              <div class="divider"></div>

              <h6>Captures ({{ debarquement.nb_especes }} espèce(s))</h6>
              <table class="highlight">
                <thead>
                  <tr>
                    <th>Espèce</th>
                    <th>Code</th>
                    <th>Quantité (kg)</th>
                    <th>Individus</th>
                    <th>Valeur (FCFA)</th>
                    <th>Alertes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let detail of debarquement.details">
                    <td><strong>{{ detail.espece_nom }}</strong></td>
                    <td>{{ detail.espece_code }}</td>
                    <td>{{ detail.quantite_kg }}</td>
                    <td>{{ detail.nombre_individus || '-' }}</td>
                    <td>{{ (detail.valeur_totale || 0) | number:'1.0-0' }}</td>
                    <td>
                      <span *ngIf="detail.alerte_taille_illegale" class="badge red white-text">
                        <i class="material-icons tiny">straighten</i>
                      </span>
                      <span *ngIf="detail.alerte_quota" class="badge orange white-text">
                        <i class="material-icons tiny">trending_up</i>
                      </span>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <th colspan="2">TOTAL</th>
                    <th>{{ debarquement.total_quantite_kg }} kg</th>
                    <th>-</th>
                    <th>{{ (debarquement.total_valeur || 0) | number:'1.0-0' }} FCFA</th>
                    <th></th>
                  </tr>
                </tfoot>
              </table>

              <div class="divider" *ngIf="debarquement.observations"></div>

              <div *ngIf="debarquement.observations">
                <h6>Observations</h6>
                <p>{{ debarquement.observations }}</p>
              </div>

              <div *ngIf="debarquement.anomalies_detectees">
                <h6>Anomalies détectées</h6>
                <p class="red-text">{{ debarquement.anomalies_detectees }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Informations complémentaires -->
        <div class="col s12 l4">
          <div class="card">
            <div class="card-content">
              <span class="card-title">Résumé</span>
              <div class="stat-box">
                <h4 class="blue-text">{{ debarquement.total_quantite_kg }}</h4>
                <p>kg capturés</p>
              </div>
              <div class="stat-box">
                <h4 class="green-text">{{ (debarquement.total_valeur || 0) | number:'1.0-0' }}</h4>
                <p>FCFA</p>
              </div>
              <div class="stat-box">
                <h4 class="orange-text">{{ debarquement.nb_especes }}</h4>
                <p>espèce(s)</p>
              </div>
            </div>
          </div>

          <div class="card" *ngIf="debarquement.agent_controle_nom">
            <div class="card-content">
              <span class="card-title">Agent de contrôle</span>
              <p><strong>Nom:</strong> {{ debarquement.agent_controle_nom }}</p>
              <p *ngIf="debarquement.agent_controle_matricule">
                <strong>Matricule:</strong> {{ debarquement.agent_controle_matricule }}
              </p>
            </div>
          </div>

          <div class="card">
            <div class="card-content">
              <span class="card-title">Informations système</span>
              <p><small><strong>Créé le:</strong> {{ debarquement.created_at | date:'dd/MM/yyyy HH:mm' }}</small></p>
              <p>
                <i class="material-icons tiny" [class.green-text]="debarquement.synchronise" [class.orange-text]="!debarquement.synchronise">
                  {{ debarquement.synchronise ? 'cloud_done' : 'cloud_off' }}
                </i>
                {{ debarquement.synchronise ? 'Synchronisé' : 'Non synchronisé' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="spinner-container" *ngIf="!debarquement">
      <div class="preloader-wrapper big active">
        <div class="spinner-layer spinner-blue-only">
          <div class="circle-clipper left"><div class="circle"></div></div>
          <div class="gap-patch"><div class="circle"></div></div>
          <div class="circle-clipper right"><div class="circle"></div></div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    h6 { color: #0d47a1; font-weight: 500; margin: 1rem 0 0.5rem 0; }
    .divider { margin: 1.5rem 0; }
    .stat-box { text-align: center; padding: 1rem 0; border-bottom: 1px solid #e0e0e0; }
    .stat-box:last-child { border-bottom: none; }
    .stat-box h4 { margin: 0; font-size: 2rem; }
    .stat-box p { margin: 0.5rem 0 0; color: #757575; }
    .badge i.tiny { vertical-align: middle; font-size: 14px; }
    .collection-item i { vertical-align: middle; margin-right: 8px; }
  `]
})
export class DebarquementDetailComponent implements OnInit {
  debarquement?: Debarquement;
  debarquementId?: number;

  constructor(
    private debarquementService: DebarquementService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.debarquementId = +params['id'];
      this.loadDebarquement();
    });
  }

  loadDebarquement() {
    if (this.debarquementId) {
      this.debarquementService.getDebarquement(this.debarquementId).subscribe({
        next: (data) => { this.debarquement = data; },
        error: (error) => {
          console.error('Erreur:', error);
          M.toast({ html: 'Erreur de chargement', classes: 'red' });
          this.router.navigate(['/debarquements']);
        }
      });
    }
  }
}
