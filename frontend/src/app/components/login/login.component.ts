import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router, RouterModule } from "@angular/router";
import { AuthService } from "../../services/auth.service";
import { PresenceService } from "../../services/presence.service";

declare var M: any;

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="login-container">
      <div class="row">
        <div class="col s12 m12 l12  xl12">
          <div class="card login-card">
            <div class="card-content">
              <!-- Logo et titre -->
              <div class="center-align mb-3">
                <img
                  src="../../../assets/logo_dp.jpeg"
                  alt=""
                  style="height: 200px;"
                />
                <h4 class="logo-title">SIGPA</h4>
                <p class="grey-text subtitle">
                  Système de Gestion de la Pêche et de l'Aquaculture
                </p>
                <div class="divider"></div>
              </div>

              <!-- Formulaire de connexion -->
              <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
                <div class="input-field">
                  <i class="material-icons prefix blue-text">person</i>
                  <input
                    id="username"
                    type="text"
                    [(ngModel)]="username"
                    name="username"
                    required
                    class="validate"
                  />
                  <label for="username">Nom d'utilisateur</label>
                </div>

                <div class="input-field">
                  <i class="material-icons prefix blue-text">lock</i>
                  <input
                    id="password"
                    type="password"
                    [(ngModel)]="password"
                    name="password"
                    required
                    class="validate"
                  />
                  <label for="password">Mot de passe</label>
                </div>

                <button
                  type="submit"
                  class="btn btn-primary waves-effect waves-light full-width btn-large"
                  [disabled]="!loginForm.form.valid || loading"
                >
                  <i class="material-icons left">{{
                    loading ? "hourglass_empty" : "login"
                  }}</i>
                  {{ loading ? "Connexion en cours..." : "Se connecter" }}
                </button>
              </form>

              <!-- Lien page publique -->
              <div class="center-align mt-3">
                <a routerLink="/map" class="blue-text">
                  <i class="material-icons tiny">public</i>
                  Consulter la page publique
                </a>
              </div>

              <!-- Informations de connexion par défaut -->
              <!-- <div class="card-panel blue lighten-5 mt-3">
                <p class="blue-text text-darken-2 mb-0">
                  <i class="material-icons tiny">info</i>
                  <strong>Première connexion :</strong>
                </p>
                <p class="blue-text text-darken-1" style="margin-top: 0.5rem;">
                  Utilisateur : <code>admin</code><br />
                  Mot de passe : <code [innerHTML]="'Admin@2025'"></code>
                </p>
              </div> -->
            </div>
          </div>

          <!-- Footer -->
          <p class="center-align white-text">
            © 2026 Ministère de la Mer, de la Pêche et de l'Economie Bleue -
            République Gabonaise
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .login-container {
        min-height: 100vh;
        background: linear-gradient(
          135deg,
          #0d47a1 0%,
          #1976d2 50%,
          #42a5f5 100%
        );
        display: flex;
        align-items: center;
        padding: 20px;
      }

      .login-card {
        border-radius: 8px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      }

      .logo-icon {
        font-size: 80px;
        color: #0d47a1;
      }

      .logo-title {
        color: #0d47a1;
        font-weight: 600;
        margin: 10px 0;
      }

      .subtitle {
        font-size: 1rem;
        margin-bottom: 20px;
      }

      .full-width {
        width: 100%;
      }

      .mb-3 {
        margin-bottom: 2rem;
      }

      .mt-3 {
        margin-top: 2rem;
      }

      .mb-0 {
        margin-bottom: 0 !important;
      }

      code {
        background-color: rgba(0, 0, 0, 0.05);
        padding: 2px 6px;
        border-radius: 3px;
        font-family: monospace;
      }
    `,
  ],
})
export class LoginComponent {
  username = "";
  password = "";
  loading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private presence: PresenceService,
  ) {
    // Rediriger si déjà connecté
    if (this.authService.isAuthenticated()) {
      this.router.navigate(["/dashboard"]);
    }
  }

  onSubmit() {
    if (!this.username || !this.password) {
      M.toast({ html: "Veuillez remplir tous les champs", classes: "orange" });
      return;
    }

    this.loading = true;

    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        M.toast({ html: "Connexion réussie !", classes: "green" });
        this.presence.start();
        setTimeout(() => {
          this.router.navigate(["/dashboard"]);
        }, 200);
      },
      error: (error) => {
        console.error("Erreur de connexion:", error);
        M.toast({
          html: "Identifiants incorrects ou compte inactif",
          classes: "red",
          displayLength: 4000,
        });
        this.loading = false;
      },
    });
  }
}
