import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import { Permission, Role, Module } from "../../interfaces/permission-role";
import { PermissionsRolesService } from "../../services/permissions-roles.service";

declare var M: any;

@Component({
  selector: "app-permissions-role",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./permissions-role.component.html",
  styleUrl: "./permissions-role.component.scss",
})
export class PermissionsRoleComponent {
  roles: Role[] = [];
  permissions: Permission[] = [];
  modules: Module[] = [];

  selectedRole: Role | null = null;
  selectedPermissions: number[] = [];

  loading = false;
  saving = false;
  activeTab = "roles";

  // Formulaire nouveau rôle
  newRole = {
    code: "",
    nom: "",
    description: "",
    niveau: 5,
    actif: true,
    permission_ids: [] as number[],
  };

  errors: any = {};

  // Flag pour vérifier si Materialize est chargé
  private materializeLoaded = false;

  constructor(
    private http: HttpClient,
    private permissionsRolesService: PermissionsRolesService,
  ) {}

  ngOnInit() {
    this.loadRoles();
    this.loadPermissions();
    this.loadModules();
  }

  ngAfterViewInit() {
    // Initialiser Materialize avec un délai pour s'assurer que le DOM est prêt
    this.initializeMaterialize();
  }

  private initializeMaterialize() {
    // Vérifier si M est disponible
    if (typeof M === "undefined") {
      console.error("Materialize CSS not loaded!");
      alert(
        "Erreur: Materialize CSS n'est pas chargé. Veuillez vérifier votre configuration.",
      );
      return;
    }

    setTimeout(() => {
      try {
        // Initialiser tous les composants Materialize
        const tabs = document.querySelectorAll(".tabs");
        if (tabs.length > 0) {
          M.Tabs.init(tabs, {});
        }

        const modals = document.querySelectorAll(".modal");
        if (modals.length > 0) {
          M.Modal.init(modals, {
            dismissible: true,
            opacity: 0.5,
          });
        }

        const selects = document.querySelectorAll("select");
        if (selects.length > 0) {
          M.FormSelect.init(selects, {});
        }

        const collapsibles = document.querySelectorAll(".collapsible");
        if (collapsibles.length > 0) {
          M.Collapsible.init(collapsibles, {});
        }

        this.materializeLoaded = true;
        console.log("Materialize initialized successfully");
      } catch (error) {
        console.error("Error initializing Materialize:", error);
      }
    }, 300);
  }

  private reinitializeMaterialize() {
    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.updateTextFields();

      // Réinitialiser les modals
      const modals = document.querySelectorAll(".modal");
      if (modals.length > 0) {
        M.Modal.init(modals, {
          dismissible: true,
          opacity: 0.5,
        });
      }

      // Réinitialiser les collapsibles
      const collapsibles = document.querySelectorAll(".collapsible");
      if (collapsibles.length > 0) {
        M.Collapsible.init(collapsibles, {});
      }
    }, 100);
  }

  loadRoles() {
    this.loading = true;

    this.permissionsRolesService.getRoles().subscribe({
      next: (data) => {
        this.roles = data;
        this.loading = false;
      },
      error: (error) => {
        console.error("Erreur chargement rôles:", error);
        this.loading = false;
        this.showToast("Erreur chargement rôles", "red");
      },
    });
  }

  loadPermissions() {
    this.permissionsRolesService.getPermissions().subscribe({
      next: (data) => {
        this.permissions = data;
      },
      error: (error) => {
        console.error("Erreur chargement permissions:", error);
      },
    });
  }

  loadModules() {
    this.permissionsRolesService.getModules().subscribe({
      next: (data) => {
        this.modules = data;
      },
      error: (error) => {
        console.error("Erreur chargement modules:", error);
      },
    });
  }

  selectRole(role: Role) {
    this.selectedRole = { ...role };
    this.selectedPermissions = role.permissions.map((p) => p.id);

    // Ouvrir le modal avec vérification
    this.openModal("modal-edit-role");

    setTimeout(() => {
      M.updateTextFields();
    }, 100);
  }

  togglePermission(permissionId: number) {
    const index = this.selectedPermissions.indexOf(permissionId);
    if (index > -1) {
      this.selectedPermissions.splice(index, 1);
    } else {
      this.selectedPermissions.push(permissionId);
    }
  }

  isPermissionSelected(permissionId: number): boolean {
    return this.selectedPermissions.includes(permissionId);
  }

  selectAllModulePermissions(module: Module) {
    module.permissions.forEach((p) => {
      if (!this.selectedPermissions.includes(p.id)) {
        this.selectedPermissions.push(p.id);
      }
    });
  }

  deselectAllModulePermissions(module: Module) {
    module.permissions.forEach((p) => {
      const index = this.selectedPermissions.indexOf(p.id);
      if (index > -1) {
        this.selectedPermissions.splice(index, 1);
      }
    });
  }

  validateRoleForm(): boolean {
    this.errors = {};
    let isValid = true;

    if (!this.newRole.code || this.newRole.code.trim().length < 2) {
      this.errors.code = "Le code doit contenir au moins 2 caractères";
      isValid = false;
    }

    if (!this.newRole.nom || this.newRole.nom.trim().length < 3) {
      this.errors.nom = "Le nom doit contenir au moins 3 caractères";
      isValid = false;
    }

    if (this.newRole.niveau < 1 || this.newRole.niveau > 10) {
      this.errors.niveau = "Le niveau doit être entre 1 et 10";
      isValid = false;
    }

    return isValid;
  }

  createRole() {
    if (!this.validateRoleForm()) {
      this.showToast("Veuillez corriger les erreurs du formulaire", "orange");
      return;
    }

    this.saving = true;

    const roleData = {
      ...this.newRole,
      permission_ids: this.selectedPermissions,
    };

    this.permissionsRolesService.createRole(roleData).subscribe({
      next: (response) => {
        this.saving = false;
        this.showToast("Rôle créé avec succès", "green");

        // Réinitialiser le formulaire
        this.newRole = {
          code: "",
          nom: "",
          description: "",
          niveau: 5,
          actif: true,
          permission_ids: [],
        };
        this.selectedPermissions = [];

        // Recharger les rôles
        this.loadRoles();

        // Fermer le modal
        this.closeModal("modal-create-role");
      },
      error: (error) => {
        console.error("Erreur création rôle:", error);
        this.saving = false;

        let errorMessage = "Erreur lors de la création";
        if (error.status === 400 && error.error?.detail) {
          errorMessage = error.error.detail;
        }

        this.showToast(errorMessage, "red");
      },
    });
  }

  updateRole() {
    if (!this.selectedRole) return;

    this.saving = true;

    const roleData = {
      nom: this.selectedRole.nom,
      description: this.selectedRole.description,
      niveau: this.selectedRole.niveau,
      actif: this.selectedRole.actif,
      permission_ids: this.selectedPermissions,
    };

    this.permissionsRolesService
      .updateRole(this.selectedRole.id, roleData)
      .subscribe({
        next: (response) => {
          this.saving = false;
          this.showToast("Rôle modifié avec succès", "green");

          // Recharger les rôles
          this.loadRoles();

          // Fermer le modal
          this.closeModal("modal-edit-role");

          this.selectedRole = null;
        },
        error: (error) => {
          console.error("Erreur modification rôle:", error);
          this.saving = false;
          this.showToast("Erreur modification rôle", "red");
        },
      });
  }

  deleteRole(role: Role) {
    if (role.est_systeme) {
      this.showToast(
        "Les rôles système ne peuvent pas être supprimés",
        "orange",
      );
      return;
    }

    if (confirm(`Voulez-vous vraiment supprimer le rôle "${role.nom}" ?`)) {
      this.http
        .delete(`${environment.apiUrl}/api/permissions/roles/${role.id}`)
        .subscribe({
          next: () => {
            this.showToast("Rôle supprimé avec succès", "green");
            this.loadRoles();
          },
          error: (error) => {
            console.error("Erreur suppression rôle:", error);
            let errorMessage = "Erreur suppression rôle";
            if (error.status === 400 && error.error?.detail) {
              errorMessage = error.error.detail;
            }
            this.showToast(errorMessage, "red");
          },
        });
    }
  }

  getRoleBadgeClass(niveau: number): string {
    if (niveau >= 9) return "red";
    if (niveau >= 7) return "blue";
    if (niveau >= 5) return "green";
    return "orange";
  }

  getActionLabel(action: string): string {
    const labels: any = {
      create: "Créer",
      read: "Lire",
      update: "Modifier",
      delete: "Supprimer",
      export: "Exporter",
      validate: "Valider",
      generate: "Générer",
      view: "Voir",
      schedule: "Planifier",
      manage_permissions: "Gérer permissions",
      config: "Configurer",
      backup: "Sauvegarder",
      logs: "Logs",
      audit: "Auditer",
      advanced: "Avancé",
    };
    return labels[action] || action;
  }

  getModuleLabel(module: string): string {
    const labels: any = {
      debarquement: "Débarquements",
      pecheur: "Pêcheurs",
      bateau: "Bateaux",
      espece: "Espèces",
      debarcadere: "Débarcadères",
      rapport: "Rapports",
      statistique: "Statistiques",
      user: "Utilisateurs",
      system: "Système",
    };
    return labels[module] || module;
  }

  getModuleIcon(module: string): string {
    const icons: any = {
      debarquement: "anchor",
      pecheur: "person",
      bateau: "directions_boat",
      espece: "pets",
      debarcadere: "location_on",
      rapport: "description",
      statistique: "bar_chart",
      user: "people",
      system: "settings",
    };
    return icons[module] || "folder";
  }

  openCreateRoleModal() {
    this.newRole = {
      code: "",
      nom: "",
      description: "",
      niveau: 5,
      actif: true,
      permission_ids: [],
    };
    this.selectedPermissions = [];
    this.errors = {};

    this.openModal("modal-create-role");
  }

  openModal(modalId: string) {
    if (typeof M === "undefined") {
      console.error("Materialize not loaded");
      alert(
        "Erreur: Interface non chargée correctement. Veuillez rafraîchir la page.",
      );
      return;
    }

    setTimeout(() => {
      const modal = document.getElementById(modalId);
      if (!modal) {
        console.error(`Modal ${modalId} not found`);
        return;
      }

      try {
        let instance = M.Modal.getInstance(modal);

        if (!instance) {
          // Si l'instance n'existe pas, l'initialiser
          instance = M.Modal.init(modal, {
            dismissible: true,
            opacity: 0.5,
          });
        }

        if (instance && typeof instance.open === "function") {
          instance.open();
        } else {
          console.error("Modal instance invalid");
        }
      } catch (error) {
        console.error("Error opening modal:", error);
      }
    }, 100);
  }

  closeModal(modalId: string) {
    if (typeof M === "undefined") return;

    const modal = document.getElementById(modalId);
    if (modal) {
      try {
        const instance = M.Modal.getInstance(modal);
        if (instance && typeof instance.close === "function") {
          instance.close();
        }
      } catch (error) {
        console.error("Error closing modal:", error);
      }
    }
  }

  getUniqueModules(permissions: Permission[]): string[] {
    const modules = permissions.map((p) => p.module);
    return [...new Set(modules)];
  }

  getSelectedPermissionsCount(module: Module): number {
    return module.permissions.filter((p) => this.isPermissionSelected(p.id))
      .length;
  }

  showToast(message: string, color: string = "blue") {
    if (typeof M !== "undefined" && M.toast) {
      M.toast({ html: message, classes: color });
    } else {
      // Fallback si Materialize n'est pas disponible
      alert(message);
    }
  }
}
