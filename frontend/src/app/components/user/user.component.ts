import { Component, OnInit, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { environment } from "../../../environments/environment";
import { UserService } from "../../services/user.service";
import { PermissionsRolesService } from "../../services/permissions-roles.service";

declare var M: any;

interface User {
  id: number;
  username: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  role_id?: number;
  is_active: boolean;
  date_creation: string;
  permissions?: string[];
}

interface Role {
  id: number;
  code: string;
  nom: string;
  niveau: number;
  permissions: Permission[];
}

interface Permission {
  id: number;
  code: string;
  nom: string;
  module: string;
}

function isStringArray(arr: unknown): arr is string[] {
  return Array.isArray(arr) && arr.every((item) => typeof item === "string");
}

@Component({
  selector: "app-user",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./user.component.html",
  styleUrl: "./user.component.scss",
})
export class UserComponent {
  users: User[] = [];
  roles: Role[] = [];
  allPermissions: Permission[] = [];

  filteredUsers: User[] = [];
  searchTerm = "";
  roleFilter = "";
  statutFilter = "";

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  // Statistiques
  stats = {
    total: 0,
    actifs: 0,
    inactifs: 0,
    admins: 0,
    gestionnaires: 0,
    operateurs: 0,
  };

  // Utilisateur sélectionné
  selectedUser: User | null = null;
  selectedRoleId: number | null = null;
  selectedPermissions: number[] = [];

  loading = false;
  saving = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private userService: UserService,
    private permissionsRolesService: PermissionsRolesService,
  ) {}

  ngOnInit() {
    this.loadUsers();
    this.loadRoles();
    this.loadPermissions();
  }

  ngAfterViewInit() {
    this.initializeMaterialize();
  }

  private initializeMaterialize() {
    if (typeof M === "undefined") {
      console.error("Materialize not loaded");
      return;
    }

    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.Modal.init(document.querySelectorAll(".modal"), {
        dismissible: true,
      });
      M.Tabs.init(document.querySelectorAll(".tabs"), {});
      M.Tooltip.init(document.querySelectorAll(".tooltipped"), {});
    }, 300);
  }

  private initializeCollapsible() {
    if (typeof M === "undefined") return;

    const collapsibles = document.querySelectorAll(".collapsible");
    if (collapsibles.length > 0) {
      M.Collapsible.init(collapsibles, {
        accordion: false, // ✅ Plusieurs sections ouvertes
      });
      // console.log("Collapsible initialized");
    }
  }

  loadUsers() {
    this.loading = true;

    this.userService.getUsers().subscribe({
      next: (data) => {
        // console.log("Utilisateurs chargés:", data);
        this.users = data;
        this.filteredUsers = data;
        this.calculateStats();
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        console.error("Erreur chargement utilisateurs:", error);
        this.loading = false;
        this.showToast("Erreur chargement utilisateurs", "red");
      },
    });
  }

  loadRoles() {
    this.permissionsRolesService.getRoles().subscribe({
      next: (data) => {
        this.roles = data;
      },
      error: (error) => {
        console.error("Erreur chargement rôles:", error);
      },
    });
  }

  loadPermissions() {
    this.permissionsRolesService.getPermissions().subscribe({
      next: (data) => {
        this.allPermissions = data;
      },
      error: (error) => {
        console.error("Erreur chargement permissions:", error);
      },
    });
  }

  calculateStats() {
    this.stats.total = this.users.length;
    this.stats.actifs = this.users.filter((u) => u.is_active).length;
    this.stats.inactifs = this.users.filter((u) => !u.is_active).length;
    this.stats.admins = this.users.filter((u) => u.role === "admin").length;
    this.stats.gestionnaires = this.users.filter(
      (u) => u.role === "gestionnaire",
    ).length;
    this.stats.operateurs = this.users.filter(
      (u) => u.role === "operateur",
    ).length;
  }

  applyFilters() {
    let filtered = [...this.users];

    // Filtre par recherche
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.username.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          u.nom.toLowerCase().includes(term) ||
          u.prenom.toLowerCase().includes(term),
      );
    }

    // Filtre par rôle
    if (this.roleFilter) {
      filtered = filtered.filter((u) => u.role === this.roleFilter);
    }

    // Filtre par statut
    if (this.statutFilter === "actif") {
      filtered = filtered.filter((u) => u.is_active);
    } else if (this.statutFilter === "inactif") {
      filtered = filtered.filter((u) => !u.is_active);
    }

    this.filteredUsers = filtered;
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
    this.currentPage = 1;
  }

  onSearch(event: any) {
    this.searchTerm = event.target.value;
    this.applyFilters();
  }

  onRoleFilterChange(event: any) {
    this.roleFilter = event.target.value;
    this.applyFilters();
  }

  onStatutFilterChange(event: any) {
    this.statutFilter = event.target.value;
    this.applyFilters();
  }

  resetFilters() {
    this.searchTerm = "";
    this.roleFilter = "";
    this.statutFilter = "";
    this.filteredUsers = [...this.users];
    this.totalPages = Math.ceil(this.filteredUsers.length / this.itemsPerPage);
    this.currentPage = 1;

    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.updateTextFields();
    }, 100);
  }

  get paginatedUsers() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredUsers.slice(start, end);
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPage(page: number) {
    this.currentPage = page;
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // Gérer les rôles
  manageUserRole(user: User) {
    this.selectedUser = user;
    this.selectedRoleId = user.role_id || null;

    this.openModal("modal-assign-role");

    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"), {});
    }, 100);
  }

  assignRole() {
    if (!this.selectedUser) return;

    this.saving = true;

    const roleData = {
      role_id: this.selectedRoleId,
    };

    this.http
      .put(
        `${environment.apiUrl}/api/permissions/users/${this.selectedUser.id}/role`,
        roleData,
      )
      .subscribe({
        next: () => {
          this.saving = false;
          this.showToast("Rôle attribué avec succès", "green");
          this.loadUsers();
          this.closeModal("modal-assign-role");
        },
        error: (error) => {
          console.error("Erreur attribution rôle:", error);
          this.saving = false;
          this.showToast("Erreur attribution rôle", "red");
        },
      });
  }

  // Gérer les permissions
  manageUserPermissions(user: User) {
    this.selectedUser = user;

    // Charger les permissions actuelles de l'utilisateur
    this.permissionsRolesService.getPermission(user.id).subscribe({
      next: (data) => {
        // Récupérer les IDs des permissions directes (pas celles du rôle)
        // console.log("Permissions directes de l'utilisateur:", data);
        const directPermissionCodes = data.direct_permissions || [];
        this.selectedPermissions = this.allPermissions
          .filter((p) => directPermissionCodes.includes(p.code))
          .map((p) => p.id);

        this.openModal("modal-assign-permissions");

        // ✅ Init collapsible APRÈS (500ms)
        setTimeout(() => {
          this.initializeCollapsible();
        }, 500);
      },
      error: (error) => {
        console.error("Erreur chargement permissions user:", error);
      },
    });
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

  assignPermissions() {
    if (!this.selectedUser) return;

    this.saving = true;

    // ✅ Filtrer pour ne garder QUE les nombres
    const permissionIds = this.selectedPermissions.filter(
      (id) => typeof id === "number",
    );

    // console.log(
    //   "Assigning permissions:",
    //   permissionIds,
    //   "to user",
    //   this.selectedUser.id,
    // );

    const permissionsData = {
      permission_ids: permissionIds, // ✅ Tableau de nombres
    };

    this.permissionsRolesService
      .assignPermissionsToUser(this.selectedUser.id, permissionsData)
      .subscribe({
        next: () => {
          this.saving = false;
          this.showToast("Permissions attribuées avec succès", "green");
          this.loadUsers();
          this.closeModal("modal-assign-permissions");
        },
        error: (error) => {
          console.error("Erreur attribution permissions:", error);
          this.saving = false;
          this.showToast("Erreur attribution permissions", "red");
        },
      });
  }

  // Voir les permissions d'un utilisateur
  viewUserPermissions(user: User) {
    this.selectedUser = user;

    this.permissionsRolesService.getPermission(user.id).subscribe({
      next: (data) => {
        this.selectedUser!.permissions = data.permissions || [];
        this.openModal("modal-view-permissions");
      },
      error: (error) => {
        console.error("Erreur chargement permissions:", error);
      },
    });
  }

  // Toggle statut utilisateur
  toggleUserStatus(user: User) {
    const newStatus = !user.is_active;
    const action = newStatus ? "activer" : "désactiver";

    if (
      confirm(`Voulez-vous vraiment ${action} l'utilisateur ${user.username} ?`)
    ) {
      this.permissionsRolesService
        .toogleUserStatus(user.id, newStatus)
        .subscribe({
          next: () => {
            user.is_active = newStatus;
            this.calculateStats();
            this.showToast(
              `Utilisateur ${action === "activer" ? "activé" : "désactivé"}`,
              "green",
            );
          },
          error: (error) => {
            console.error("Erreur toggle statut:", error);
            this.showToast("Erreur modification statut", "red");
          },
        });
    }
  }

  // Navigation
  editUser(user: User) {
    this.router.navigate(["/users/edit", user.id]);
  }

  createUser() {
    this.router.navigate(["/users/create"]);
  }

  // Helpers
  getRoleBadgeClass(role: string): string {
    const classes: any = {
      admin: "red",
      gestionnaire: "blue",
      operateur_saisie: "green",
      consultant: "orange",
    };
    return classes[role] || "grey";
  }

  getRoleLabel(role: string): string {
    const labels: any = {
      admin: "Administrateur",
      gestionnaire: "Gestionnaire",
      operateur_saisie: "Opérateur",
      consultant: "Consultant",
    };
    return labels[role] || role;
  }

  getPermissionsByModule(permissions: any[]): any {
    const grouped: any = {};
    // console.log(permissions);
    if (isStringArray(permissions)) {
      permissions.forEach((code) => {
        const parts = code.split(".");
        const module = parts[0];

        if (!grouped[module]) {
          grouped[module] = [];
        }
        grouped[module].push(code);
      });
    } else {
      permissions.forEach((p) => {
        const parts = p.code.split(".");
        const module = parts[0];

        if (!grouped[module]) {
          grouped[module] = [];
        }
        grouped[module].push(p.code);
      });
    }

    return grouped;
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

  // Modals
  openModal(modalId: string) {
    if (typeof M === "undefined") return;

    setTimeout(() => {
      const modal = document.getElementById(modalId);
      if (modal) {
        let instance = M.Modal.getInstance(modal);
        if (!instance) {
          instance = M.Modal.init(modal, { dismissible: true });
        }
        instance.open();
      }
    }, 100);
  }

  closeModal(modalId: string) {
    if (typeof M === "undefined") return;

    const modal = document.getElementById(modalId);
    if (modal) {
      const instance = M.Modal.getInstance(modal);
      if (instance) {
        instance.close();
      }
    }
  }

  showToast(message: string, color: string = "blue") {
    if (typeof M !== "undefined" && M.toast) {
      M.toast({ html: message, classes: color });
    } else {
      alert(message);
    }
  }

  getSelectedRole(): Role | undefined {
    return this.roles.find((r) => r.id === this.selectedRoleId);
  }

  getUniqueModules(): string[] {
    const modules = new Set<string>();
    this.allPermissions.forEach((p) => modules.add(p.module));
    return Array.from(modules);
  }

  getPermissionsForModule(module: string): Permission[] {
    return this.allPermissions.filter((p) => {
      // console.log(
      //   `Checking permission ${p.code} for module ${p.module} against ${module}`,
      // );
      return p.module === module;
    });
  }

  Object = Object; // Pour utiliser Object.keys dans le template
}
