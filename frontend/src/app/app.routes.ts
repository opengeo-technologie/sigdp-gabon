import { Routes } from "@angular/router";
import { authGuard } from "./guards/auth.guard";
// app/guards/permission.guard.ts

import { Injectable } from "@angular/core";
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from "@angular/router";
import { AuthService } from "./services/auth.service";
import { LicencesComponent } from "./components/licences/licences.component";
import { ArmementCooperative } from "./models/armement-cooperative.model";
import { ArmementCooperativeDetailComponent } from "./components/armement-cooperative/armement-cooperative-detail/armement-cooperative-detail.component";

@Injectable({
  providedIn: "root",
})
export class PermissionGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): boolean {
    // Vérifier si l'utilisateur est connecté
    const currentUser = this.authService.currentUserValue;

    if (!currentUser) {
      // Pas connecté, rediriger vers login
      this.router.navigate(["/login"], {
        queryParams: { returnUrl: state.url },
      });
      return false;
    }

    // Récupérer la permission requise depuis les données de la route
    const requiredPermission = route.data["permission"] as string;

    if (!requiredPermission) {
      // Pas de permission requise, autoriser
      return true;
    }

    // Vérifier si l'utilisateur a la permission
    if (this.authService.hasPermission(requiredPermission)) {
      return true;
    }

    // Pas de permission, rediriger vers page d'accès refusé
    this.router.navigate(["/access-denied"]);
    return false;
  }
}

export const routes: Routes = [
  // Pages publiques
  {
    path: "",
    redirectTo: "/map",
    pathMatch: "full",
  },
  {
    path: "map",
    loadComponent: () =>
      import("./components/public/public-map/public-map.component").then(
        (m) => m.PublicMapComponent,
      ),
  },
  {
    path: "public",
    loadComponent: () =>
      import("./components/public/public.component").then(
        (m) => m.PublicComponent,
      ),
  },
  {
    path: "public-especes",
    loadComponent: () =>
      import("./components/public/especes/especes.component").then(
        (m) => m.EspecesComponent,
      ),
  },
  {
    path: "login",
    loadComponent: () =>
      import("./components/login/login.component").then(
        (m) => m.LoginComponent,
      ),
  },

  // Pages protégées par authentification
  {
    path: "dashboard",
    loadComponent: () =>
      import("./components/dashboard/dashboard.component").then(
        (m) => m.DashboardComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "dashboard/stats",
    loadComponent: () =>
      import("./components/dashboard/new-dashboard/new-dashboard.component").then(
        (m) => m.NewDashboardComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "debarcaderes",
    loadComponent: () =>
      import("./components/debarcaderes/debarcadere-list/debarcadere-list.component").then(
        (m) => m.DebarcadereListComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "debarcaderes/new",
    loadComponent: () =>
      import("./components/debarcaderes/debarcadere-form/debarcadere-form.component").then(
        (m) => m.DebarcadereFormComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "debarcaderes/:id",
    loadComponent: () =>
      import("./components/debarcaderes/debarcadere-detail/debarcadere-detail.component").then(
        (m) => m.DebarcadereDetailComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "debarcaderes/:id/edit",
    loadComponent: () =>
      import("./components/debarcaderes/debarcadere-form/debarcadere-form.component").then(
        (m) => m.DebarcadereFormComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "pecheurs",
    loadComponent: () =>
      import("./components/pecheurs/pecheur-list/pecheur-list.component").then(
        (m) => m.PecheurListComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "pecheurs/importer",
    loadComponent: () =>
      import("./components/pecheurs/pecheurs-import/pecheurs-import.component").then(
        (m) => m.PecheursImportComponent,
      ),
    canActivate: [authGuard],
  },

  {
    path: "pecheurs/new",
    loadComponent: () =>
      import("./components/pecheurs/pecheur-form/pecheur-form.component").then(
        (m) => m.PecheurFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "pecheurs/:id",
    loadComponent: () =>
      import("./components/pecheurs/pecheur-detail/pecheur-detail.component").then(
        (m) => m.PecheurDetailComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "pecheurs/:id/edit",
    loadComponent: () =>
      import("./components/pecheurs/pecheur-form/pecheur-form.component").then(
        (m) => m.PecheurFormComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "bateaux",
    loadComponent: () =>
      import("./components/bateaux/bateau-list/bateau-list.component").then(
        (m) => m.BateauListComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "bateaux/new",
    loadComponent: () =>
      import("./components/bateaux/bateau-form/bateau-form.component").then(
        (m) => m.BateauFormComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "bateaux/importer",
    loadComponent: () =>
      import("./components/bateaux/bateaux-import/bateaux-import.component").then(
        (m) => m.BateauxImportComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "bateaux/:id",
    loadComponent: () =>
      import("./components/bateaux/bateau-detail/bateau-detail.component").then(
        (m) => m.BateauDetailComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "bateaux/:id/edit",
    loadComponent: () =>
      import("./components/bateaux/bateau-form/bateau-form.component").then(
        (m) => m.BateauFormComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "especes",
    loadComponent: () =>
      import("./components/especes/espece-list/espece-list.component").then(
        (m) => m.EspeceListComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "especes/new",
    loadComponent: () =>
      import("./components/especes/espece-form/espece-form.component").then(
        (m) => m.EspeceFormComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "especes/:id",
    loadComponent: () =>
      import("./components/especes/espece-detail/espece-detail.component").then(
        (m) => m.EspeceDetailComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "especes/:id/edit",
    loadComponent: () =>
      import("./components/especes/espece-form/espece-form.component").then(
        (m) => m.EspeceFormComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "debarquements",
    loadComponent: () =>
      import("./components/debarquements/debarquement-list/debarquement-list.component").then(
        (m) => m.DebarquementListComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "debarquements/rapport",
    loadComponent: () =>
      import("./components/debarquements/debarquement-stats/debarquement-stats.component").then(
        (m) => m.DebarquementStatsComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "debarquements/new",
    loadComponent: () =>
      import("./components/debarquements/debarquement-form/debarquement-form.component").then(
        (m) => m.DebarquementFormComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "debarquements/importer",
    loadComponent: () =>
      import("./components/debarquements/captures-import/captures-import.component").then(
        (m) => m.CapturesImportComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "debarquements/:id",
    loadComponent: () =>
      import("./components/debarquements/debarquement-detail/debarquement-detail.component").then(
        (m) => m.DebarquementDetailComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "carte",
    loadComponent: () =>
      import("./components/carte/carte.component").then(
        (m) => m.CarteComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "rapports",
    loadComponent: () =>
      import("./components/rapports/rapports.component").then(
        (m) => m.RapportsComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "profile",
    loadComponent: () =>
      import("./components/profile/profile.component").then(
        (m) => m.ProfileComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "roles-permissions",
    loadComponent: () =>
      import("./components/permissions-role/permissions-role.component").then(
        (m) => m.PermissionsRoleComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "users",
    loadComponent: () =>
      import("./components/user/user.component").then((m) => m.UserComponent),
    canActivate: [authGuard],
  },
  {
    path: "users/create",
    loadComponent: () =>
      import("./components/user/user-create/user-create.component").then(
        (m) => m.UserCreateComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "users/edit/:id",
    loadComponent: () =>
      import("./components/user/user-create/user-create.component").then(
        (m) => m.UserCreateComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "licences",
    loadComponent: () =>
      import("./components/licences/licences.component").then(
        (m) => m.LicencesComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "licences/add",
    loadComponent: () =>
      import("./components/licences/licence-autorisation-form/licence-autorisation-form.component").then(
        (m) => m.LicenceAutorisationFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "licences/:id/edit",
    loadComponent: () =>
      import("./components/licences/licence-autorisation-form/licence-autorisation-form.component").then(
        (m) => m.LicenceAutorisationFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "licences/:id/details",
    loadComponent: () =>
      import("./components/licences/licence-details/licence-details.component").then(
        (m) => m.LicenceDetailsComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "armements-cooperatives",
    loadComponent: () =>
      import("./components/armement-cooperative/armement-cooperative.component").then(
        (m) => m.ArmementCooperativeComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "armements-cooperatives/create",
    loadComponent: () =>
      import("./components/armement-cooperative/armement-cooperative-form/armement-cooperative-form.component").then(
        (m) => m.ArmementCooperativeFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "armements-cooperatives/:id",
    loadComponent: () =>
      import("./components/armement-cooperative/armement-cooperative-detail/armement-cooperative-detail.component").then(
        (m) => m.ArmementCooperativeDetailComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "armements-cooperatives/:id/edit",
    loadComponent: () =>
      import("./components/armement-cooperative/armement-cooperative-form/armement-cooperative-form.component").then(
        (m) => m.ArmementCooperativeFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "surveillance/tableau-de-bord",
    loadComponent: () =>
      import("./components/surveillance/surveillance-dashboard/surveillance-dashboard.component").then(
        (m) => m.SurveillanceDashboardComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "missions",
    loadComponent: () =>
      import("./components/surveillance/missions/missions.component").then(
        (m) => m.MissionsComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "infractions",
    loadComponent: () =>
      import("./components/surveillance/infractions/infractions.component").then(
        (m) => m.InfractionsComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "agent-de-controle",
    loadComponent: () =>
      import("./components/surveillance/agent-controle/agent-controle.component").then(
        (m) => m.AgentControleComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "surveillance",
    loadComponent: () =>
      import("./components/surveillance/surveillance.component").then(
        (m) => m.SurveillanceComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "mareyeurs",
    loadComponent: () =>
      import("./components/mareyeurs/mareyeurs.component").then(
        (m) => m.MareyeursComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "mareyeurs/rapport",
    loadComponent: () =>
      import("./components/mareyeurs/mareyeurs-stats/mareyeurs-stats.component").then(
        (m) => m.MareyeurStatsComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "mareyeurs/add",
    loadComponent: () =>
      import("./components/mareyeurs/mareyeur-form/mareyeur-form.component").then(
        (m) => m.MareyeurFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "mareyeurs/edit/:id",
    loadComponent: () =>
      import("./components/mareyeurs/mareyeur-form/mareyeur-form.component").then(
        (m) => m.MareyeurFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "mareyeurs/details/:id",
    loadComponent: () =>
      import("./components/mareyeurs/mareyeur-details/mareyeur-details.component").then(
        (m) => m.MareyeurDetailsComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "stations-piscicoles",
    loadComponent: () =>
      import("./components/stations-piscicoles/stations-piscicoles.component").then(
        (m) => m.StationsPiscicolesComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "stations-piscicoles/add",
    loadComponent: () =>
      import("./components/stations-piscicoles/stations-piscicoles-form/stations-piscicoles-form.component").then(
        (m) => m.StationsPiscicolesFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "stations-piscicoles/carte",
    loadComponent: () =>
      import("./components/stations-piscicoles/stations-piscicoles-map/stations-piscicoles-map.component").then(
        (m) => m.StationsPiscicolesMapComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "stations-piscicoles/:id/edit",
    loadComponent: () =>
      import("./components/stations-piscicoles/stations-piscicoles-form/stations-piscicoles-form.component").then(
        (m) => m.StationsPiscicolesFormComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "stations-piscicoles/:id/details",
    loadComponent: () =>
      import("./components/stations-piscicoles/stations-piscicoles-details/stations-piscicoles-details.component").then(
        (m) => m.StationsPiscicolesDetailsComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "stations-piscicoles/importer",
    loadComponent: () =>
      import("./components/stations-piscicoles/stations-piscicoles-import/stations-piscicoles-import.component").then(
        (m) => m.StationsPiscicolesImportComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "stations-piscicoles/exporter",
    loadComponent: () =>
      import("./components/stations-piscicoles/stations-piscicoles-export/stations-piscicoles-export.component").then(
        (m) => m.StationsPiscicolesExportComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "stations-piscicoles/rapports",
    loadComponent: () =>
      import("./components/stations-piscicoles/station-piscicole-rapport/station-piscicole-rapport.component").then(
        (m) => m.StationPiscicoleRapportComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "captures-estimees",
    loadComponent: () =>
      import("./components/captures-estimees/captures-estimees.component").then(
        (m) => m.CapturesEstimeesComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "captures-estimees/importer",
    loadComponent: () =>
      import("./components/captures-estimees/import-captures-estimees/import-captures-estimees.component").then(
        (m) => m.ImportCapturesEstimeesComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "captures-estimees/dashboard",
    loadComponent: () =>
      import("./components/captures-estimees/dashboard-captures/dashboard-captures.component").then(
        (m) => m.DashboardCapturesComponent,
      ),
    canActivate: [authGuard],
  },
  {
    path: "access-denied",
    loadComponent: () =>
      import("./components/access-denied/access-denied.component").then(
        (m) => m.AccessDeniedComponent,
      ),
  },
  {
    path: "**",
    redirectTo: "/public",
  },
];
