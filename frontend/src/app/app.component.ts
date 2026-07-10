import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Router, NavigationEnd } from "@angular/router";
import { AuthService, User } from "./services/auth.service";
import { Subscription, filter } from "rxjs";
import { HasPermissionDirective } from "./directives/has-permission.directive";

declare var M: any;

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, RouterModule, HasPermissionDirective],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
})
export class AppComponent implements OnInit, OnDestroy {
  private sidenavInstance: any;
  private dropdownInstance: any;
  showNavigation = false;
  showSidebar = false;
  currentRoute: string = "";
  currentUser: User | null = null;
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    // Écouter les changements de route
    this.subscriptions.push(
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => {
          this.updateNavigationVisibility();
          this.updateSidebarVisibility();
        }),
    );

    // Écouter les changements d'utilisateur
    this.subscriptions.push(
      this.authService.currentUser$.subscribe((user) => {
        this.currentUser = user;
        this.updateNavigationVisibility();
        this.updateSidebarVisibility();
      }),
    );

    // Initialiser
    this.updateNavigationVisibility();
    this.updateSidebarVisibility();
    this.initializeMaterialize();
  }

  ngOnDestroy() {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    if (this.sidenavInstance) {
      this.sidenavInstance.destroy();
    }
    if (this.dropdownInstance) {
      this.dropdownInstance.destroy();
    }
  }

  private updateNavigationVisibility() {
    // Cacher la navigation sur les pages publiques et login
    const publicRoutes = ["/public", "/login"];
    const currentRoute = this.router.url.split("?")[0];
    this.showNavigation =
      !publicRoutes.includes(currentRoute) &&
      this.authService.isAuthenticated();

    // Réinitialiser Materialize après changement de visibilité
    setTimeout(() => this.initializeMaterialize(), 100);
  }

  private updateSidebarVisibility() {
    const publicRoutes = ["/public", "/login"];
    const currentRoute = this.router.url.split("?")[0];

    this.currentRoute = currentRoute;

    const surveillanceRoutes = [
      "/surveillance",
      "/missions",
      "/infractions",
      "/agent-de-controle",
    ];

    const isPublicRoute = publicRoutes.includes(currentRoute);
    const isSurveillanceRoute = surveillanceRoutes.includes(currentRoute);

    this.showSidebar =
      !isPublicRoute &&
      isSurveillanceRoute &&
      this.authService.isAuthenticated();

    setTimeout(() => this.initializeMaterialize(), 100);
  }

  private initializeMaterialize() {
    if (typeof M !== "undefined" && this.showNavigation) {
      // Initialiser le sidenav
      const sidenavElem = document.querySelectorAll(".sidenav");
      if (sidenavElem.length > 0) {
        const instances = M.Sidenav.init(sidenavElem, {});
        // ✅ Prendre le premier élément du tableau
        this.sidenavInstance = instances[0] || instances;
      }

      // Initialiser le dropdown
      const dropdownElem = document.querySelectorAll(".dropdown-trigger");
      if (dropdownElem.length > 0) {
        const instances = M.Dropdown.init(dropdownElem, {
          coverTrigger: false,
          constrainWidth: false,
        });
        this.dropdownInstance = instances[0] || instances;
      }
    }
  }

  closeSidenav() {
    // ✅ Vérifier que la méthode existe
    if (
      this.sidenavInstance &&
      typeof this.sidenavInstance.close === "function"
    ) {
      this.sidenavInstance.close();
    }
  }

  logout() {
    this.closeSidenav();
    this.authService.logout();
  }
}
