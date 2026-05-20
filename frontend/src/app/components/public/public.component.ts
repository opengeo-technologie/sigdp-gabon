import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";

declare var M: any;

@Component({
  selector: "app-public",
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <!-- Navigation -->
    <nav class="blue darken-2">
      <div class="nav-wrapper container">
        <a href="#" class="brand-logo">
          <img
            src="../../../assets/logo.png"
            alt=""
            style="height: 50px; padding-top: 15px;"
          />
          <!-- <i class="material-icons left">anchor</i> -->
          SIG-PECHE
        </a>
        <ul class="right hide-on-med-and-down">
          <li><a href="#about">À propos</a></li>
          <li><a href="#stats">Statistiques</a></li>
          <li>
            <a routerLink="/login">
              <i class="material-icons left">login</i>
              Connexion
            </a>
          </li>
        </ul>
        <a href="#" data-target="mobile-nav" class="sidenav-trigger">
          <i class="material-icons">menu</i>
        </a>
      </div>
    </nav>

    <!-- Sidenav mobile -->
    <ul class="sidenav" id="mobile-nav">
      <li><a href="#about">À propos</a></li>
      <li><a href="#stats">Statistiques</a></li>
      <li>
        <a routerLink="/login">
          <i class="material-icons">login</i>
          Connexion
        </a>
      </li>
    </ul>

    <!-- Hero Section -->
    <div class="hero-section">
      <div class="container center-align">
        <!-- <i class="material-icons hero-icon">anchor</i> -->
        <img src="../../../assets/logo.png" alt="" style="height: 200px;" />
        <h1 class="white-text hero-title">
          Système d'Information pour la Gestion<br />des Débarcadères et de la
          Pêche
        </h1>
        <p class="white-text flow-text hero-subtitle">
          République Gabonaise - Ministère de la Mer, de la Pêche et de
          l'Economie Bleue
        </p>
        <a
          routerLink="/login"
          class="btn btn-large waves-effect waves-light white blue-text text-darken-2 pulse"
        >
          <i class="material-icons left">login</i>
          Accéder au système
        </a>
      </div>
    </div>

    <!-- Statistiques publiques -->
    <div class="container section" id="stats">
      <h3 class="center-align blue-text text-darken-2">
        Statistiques en temps réel
      </h3>
      <p class="center-align grey-text">
        Données actualisées du système SIG-PECHE
      </p>

      <div class="row" style="margin-top: 3rem;">
        <div class="col s12 m6 l3">
          <div class="card hoverable stats-card">
            <div class="card-content center-align">
              <i class="material-icons large teal-text">location_on</i>
              <h4 class="stats-number">{{ stats.debarcaderes || 0 }}</h4>
              <p class="stats-label">Débarcadères actifs</p>
            </div>
          </div>
        </div>

        <div class="col s12 m6 l3">
          <div class="card hoverable stats-card">
            <div class="card-content center-align">
              <i class="material-icons large blue-text">people</i>
              <h4 class="stats-number">{{ stats.pecheurs || 0 }}</h4>
              <p class="stats-label">Pêcheurs enregistrés</p>
            </div>
          </div>
        </div>

        <div class="col s12 m6 l3">
          <div class="card hoverable stats-card">
            <div class="card-content center-align">
              <i class="material-icons large orange-text">directions_boat</i>
              <h4 class="stats-number">{{ stats.bateaux || 0 }}</h4>
              <p class="stats-label">Bateaux référencés</p>
            </div>
          </div>
        </div>

        <div class="col s12 m6 l3">
          <div class="card hoverable stats-card">
            <div class="card-content center-align">
              <i class="material-icons large green-text">assessment</i>
              <h4 class="stats-number">{{ stats.captures || 0 }}</h4>
              <p class="stats-label">Tonnes capturées (mois)</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- À propos -->
    <div class="grey lighten-4 section" id="about">
      <div class="container">
        <h4 class="center-align blue-text text-darken-2">
          À propos de SIG-PECHE
        </h4>
        <p class="center-align grey-text">
          Un système moderne pour la gestion durable des ressources halieutiques
        </p>

        <div class="row" style="margin-top: 3rem;">
          <div class="col s12 m4">
            <div class="card hoverable feature-card">
              <div class="card-content center-align">
                <i class="material-icons large blue-text">track_changes</i>
                <span class="card-title">Traçabilité complète</span>
                <p>
                  Suivi détaillé des débarquements et de la chaîne de capture
                  depuis la pêche jusqu'à la commercialisation
                </p>
              </div>
            </div>
          </div>

          <div class="col s12 m4">
            <div class="card hoverable feature-card">
              <div class="card-content center-align">
                <i class="material-icons large green-text">verified_user</i>
                <span class="card-title">Conformité réglementaire</span>
                <p>
                  Vérification automatique des quotas, tailles minimales et
                  respect de la réglementation en vigueur
                </p>
              </div>
            </div>
          </div>

          <div class="col s12 m4">
            <div class="card hoverable feature-card">
              <div class="card-content center-align">
                <i class="material-icons large orange-text">analytics</i>
                <span class="card-title">Statistiques avancées</span>
                <p>
                  Analyse en temps réel de la production halieutique et aide à
                  la décision pour une gestion durable
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Fonctionnalités -->
    <div class="container section">
      <h4 class="center-align blue-text text-darken-2">
        Fonctionnalités principales
      </h4>

      <div class="row">
        <div class="col s12 m6">
          <ul class="collection">
            <li class="collection-item">
              <i class="material-icons blue-text">check_circle</i>
              Gestion des débarcadères et infrastructures
            </li>
            <li class="collection-item">
              <i class="material-icons blue-text">check_circle</i>
              Enregistrement des pêcheurs et délivrance de cartes
            </li>
            <li class="collection-item">
              <i class="material-icons blue-text">check_circle</i>
              Suivi de la flotte de bateaux
            </li>
            <li class="collection-item">
              <i class="material-icons blue-text">check_circle</i>
              Base de données des espèces halieutiques
            </li>
          </ul>
        </div>

        <div class="col s12 m6">
          <ul class="collection">
            <li class="collection-item">
              <i class="material-icons green-text">check_circle</i>
              Enregistrement des débarquements en temps réel
            </li>
            <li class="collection-item">
              <i class="material-icons green-text">check_circle</i>
              Système d'alertes automatiques
            </li>
            <li class="collection-item">
              <i class="material-icons green-text">check_circle</i>
              Tableaux de bord statistiques
            </li>
            <li class="collection-item">
              <i class="material-icons green-text">check_circle</i>
              Cartographie interactive
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <footer class="page-footer blue darken-2">
      <div class="container">
        <div class="row">
          <div class="col l6 s12">
            <h5 class="white-text">SIGDP-GABON</h5>
            <p class="grey-text text-lighten-4">
              Système d'Information pour la Gestion des Débarcadères et de la
              Pêche au Gabon
            </p>
          </div>
          <div class="col l3 s12">
            <h5 class="white-text">Liens rapides</h5>
            <ul>
              <li>
                <a class="grey-text text-lighten-3" href="#about">À propos</a>
              </li>
              <li>
                <a class="grey-text text-lighten-3" href="#stats"
                  >Statistiques</a
                >
              </li>
              <li>
                <a class="grey-text text-lighten-3" routerLink="/login"
                  >Connexion</a
                >
              </li>
            </ul>
          </div>
          <div class="col l3 s12">
            <h5 class="white-text">Contact</h5>
            <ul>
              <li class="grey-text text-lighten-3">
                Ministère de la Mer, de la Pêche et de l'Economie Bleue
              </li>
              <li class="grey-text text-lighten-3">Direction des Pêches</li>
              <li class="grey-text text-lighten-3">Libreville, Gabon</li>
            </ul>
          </div>
        </div>
      </div>
      <div class="footer-copyright">
        <div class="container">
          © 2026 République Gabonaise - Tous droits réservés
          <a class="grey-text text-lighten-4 right" href="#!">Version 1.0.0</a>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
      .hero-section {
        background: linear-gradient(
          135deg,
          #0d47a1 0%,
          #1976d2 50%,
          #2196f3 100%
        );
        padding: 100px 0;
        margin-bottom: 0;
        position: relative;
        overflow: hidden;
      }

      .hero-section::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320"><path fill="%23ffffff" fill-opacity="0.1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,138.7C960,139,1056,117,1152,101.3C1248,85,1344,75,1392,69.3L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path></svg>')
          no-repeat bottom;
        background-size: cover;
      }

      .hero-icon {
        font-size: 100px;
        color: white;
        text-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        animation: float 3s ease-in-out infinite;
      }

      @keyframes float {
        0%,
        100% {
          transform: translateY(0px);
        }
        50% {
          transform: translateY(-20px);
        }
      }

      .hero-title {
        font-size: 2.5rem;
        font-weight: 600;
        margin: 20px 0;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .hero-subtitle {
        font-size: 1.3rem;
        margin-bottom: 30px;
        opacity: 0.95;
      }

      .stats-card {
        transition: transform 0.3s;
        height: 100%;
      }

      .stats-card:hover {
        transform: translateY(-5px);
      }

      .stats-number {
        font-size: 3rem;
        font-weight: bold;
        margin: 10px 0;
        color: #0d47a1;
      }

      .stats-label {
        color: #757575;
        font-size: 1rem;
      }

      .feature-card {
        height: 100%;
        transition: transform 0.3s;
      }

      .feature-card:hover {
        transform: translateY(-5px);
      }

      .feature-card .card-title {
        color: #0d47a1;
        font-weight: 500;
        font-size: 1.3rem;
        margin: 10px 0;
      }

      .collection .collection-item i {
        vertical-align: middle;
        margin-right: 10px;
      }

      @media only screen and (max-width: 600px) {
        .hero-title {
          font-size: 1.8rem;
        }
        .hero-subtitle {
          font-size: 1rem;
        }
        .stats-number {
          font-size: 2rem;
        }
      }
    `,
  ],
})
export class PublicComponent implements OnInit {
  stats = {
    debarcaderes: 0,
    pecheurs: 0,
    bateaux: 0,
    captures: 0,
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // Initialiser Materialize pour le sidenav
    setTimeout(() => {
      if (typeof M !== "undefined") {
        M.Sidenav.init(document.querySelectorAll(".sidenav"), {});
      }
    }, 100);

    // Charger les statistiques publiques
    this.loadPublicStats();
  }

  loadPublicStats() {
    this.http
      .get<any>(`${environment.apiUrl}/api/statistiques/dashboard`)
      .subscribe({
        next: (data) => {
          // console.log(data);
          this.stats = {
            debarcaderes: data.globaux.debarcaderes_actifs || 0,
            pecheurs: data.globaux.pecheurs_actifs || 0,
            bateaux: data.globaux.bateaux_actifs || 0,
            captures: data.captures_mois.quantite_tonnes,
          };
        },
        error: (error) => {
          console.log("Statistiques non disponibles:", error);
          // Valeurs par défaut si l'API n'est pas accessible
          this.stats = {
            debarcaderes: 0,
            pecheurs: 0,
            bateaux: 0,
            captures: 0,
          };
        },
      });
  }
}
