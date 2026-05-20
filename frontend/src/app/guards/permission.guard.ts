// app/guards/permission.guard.ts

import { Injectable } from "@angular/core";
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
} from "@angular/router";
import { AuthService } from "../services/auth.service";

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
