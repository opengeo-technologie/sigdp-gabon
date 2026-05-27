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
    redirectTo: "/public",
    pathMatch: "full",
  },
  {
    path: "public",
    loadComponent: () =>
      import("./components/public/public.component").then(
        (m) => m.PublicComponent,
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
    canActivate: [authGuard, PermissionGuard],
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
    path: "pecheurs/new",
    loadComponent: () =>
      import("./components/pecheurs/pecheur-form/pecheur-form.component").then(
        (m) => m.PecheurFormComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
  },
  {
    path: "pecheurs/:id",
    loadComponent: () =>
      import("./components/pecheurs/pecheur-detail/pecheur-detail.component").then(
        (m) => m.PecheurDetailComponent,
      ),
    canActivate: [authGuard, PermissionGuard],
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
    path: "debarquements/new",
    loadComponent: () =>
      import("./components/debarquements/debarquement-form/debarquement-form.component").then(
        (m) => m.DebarquementFormComponent,
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
      import("./components/licences/licence-form/licence-form.component").then(
        (m) => m.LicenceFormComponent,
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
