import { Component, OnInit, AfterViewInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { Router, ActivatedRoute } from "@angular/router";
import { environment } from "../../../../environments/environment";
import { UserService } from "../../../services/user.service";
import { PermissionsRolesService } from "../../../services/permissions-roles.service";

declare var M: any;

interface User {
  id?: number;
  username: string;
  email: string;
  nom: string;
  prenom: string;
  password?: string;
  role: any;
  role_id?: number;
  is_active: boolean;
  telephone?: string;
  adresse?: string;
  ville?: string;
  code_postal?: string;
  pays?: string;
}

interface Role {
  id: number;
  code: string;
  nom: string;
  niveau: number;
}

@Component({
  selector: "app-user-create",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./user-create.component.html",
  styleUrl: "./user-create.component.scss",
})
export class UserCreateComponent {
  user: User = {
    username: "",
    email: "",
    nom: "",
    prenom: "",
    password: "",
    role: {},
    is_active: true,
    telephone: "",
    adresse: "",
    ville: "",
    code_postal: "",
    pays: "Gabon",
  };

  roles: Role[] = [];

  isEditMode = false;
  userId: number | null = null;

  loading = false;
  saving = false;

  errors: any = {};

  // Générateur mot de passe
  passwordLength = 12;
  showPassword = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private userService: UserService,
    private permissionsRolesService: PermissionsRolesService,
  ) {}

  ngOnInit() {
    this.loadRoles();

    this.route.params.subscribe((params) => {
      if (params["id"]) {
        this.isEditMode = true;
        this.userId = +params["id"];
        this.loadUser(this.userId);
      }
    });
  }

  ngAfterViewInit() {
    this.initializeMaterialize();
  }

  private initializeMaterialize() {
    if (typeof M === "undefined") return;

    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.updateTextFields();
      M.Tooltip.init(document.querySelectorAll(".tooltipped"), {});
    }, 300);
  }

  loadRoles() {
    this.permissionsRolesService.getRoles().subscribe({
      next: (data) => {
        this.roles = data;
        setTimeout(() => {
          M.FormSelect.init(document.querySelectorAll("select"), {});
        }, 100);
      },
      error: (error) => {
        console.error("Erreur chargement rôles:", error);
      },
    });
  }

  loadUser(id: number) {
    this.loading = true;

    this.userService.getUser(id).subscribe({
      next: (data) => {
        console.log("Utilisateur chargé:", data);
        this.user = { ...data, password: "" };
        this.loading = false;

        setTimeout(() => {
          M.FormSelect.init(document.querySelectorAll("select"), {});
          M.updateTextFields();
        }, 100);
      },
      error: (error) => {
        console.error("Erreur chargement utilisateur:", error);
        this.loading = false;
        this.showToast("Erreur chargement utilisateur", "red");
        this.router.navigate(["/users"]);
      },
    });
  }

  validateForm(): boolean {
    this.errors = {};
    let isValid = true;

    if (!this.user.username || this.user.username.trim().length < 3) {
      this.errors.username = "Min 3 caractères requis";
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.user.email || !emailRegex.test(this.user.email)) {
      this.errors.email = "Email invalide";
      isValid = false;
    }

    if (!this.user.nom || this.user.nom.trim().length < 2) {
      this.errors.nom = "Min 2 caractères requis";
      isValid = false;
    }

    if (!this.user.prenom || this.user.prenom.trim().length < 2) {
      this.errors.prenom = "Min 2 caractères requis";
      isValid = false;
    }

    if (!this.isEditMode) {
      if (!this.user.password || this.user.password.length < 6) {
        this.errors.password = "Min 6 caractères requis";
        isValid = false;
      }
    } else if (this.user.password && this.user.password.length < 6) {
      this.errors.password = "Min 6 caractères requis";
      isValid = false;
    }

    if (!this.user.role) {
      this.errors.role = "Sélectionner un rôle";
      isValid = false;
    }

    return isValid;
  }

  saveUser() {
    if (!this.validateForm()) {
      this.showToast("Corriger les erreurs", "orange");
      return;
    }

    this.saving = true;

    const userData: any = {
      username: this.user.username.trim(),
      email: this.user.email.trim(),
      nom: this.user.nom.trim(),
      prenom: this.user.prenom.trim(),
      role: this.user.role.code, // Envoyer le code du rôle
      role_id: this.user.role.id, // Envoyer l'ID du rôle
      is_active: this.user.is_active,
      telephone: this.user.telephone?.trim() || null,
      adresse: this.user.adresse?.trim() || null,
      ville: this.user.ville?.trim() || null,
      code_postal: this.user.code_postal?.trim() || null,
      pays: this.user.pays || "Gabon",
    };

    if (this.user.password && this.user.password.trim()) {
      userData.password = this.user.password;
    }

    console.log("Données à envoyer:", userData);

    const request =
      this.isEditMode && this.userId
        ? this.userService.updateUser(this.userId, userData)
        : this.userService.saveUser(userData);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.showToast(
          this.isEditMode ? "Utilisateur modifié" : "Utilisateur créé",
          "green",
        );
        this.router.navigate(["/users"]);
      },
      error: (error) => {
        console.error("Erreur:", error);
        this.saving = false;

        let errorMessage = "Erreur lors de l'opération";
        if (error.status === 400 && error.error?.detail) {
          errorMessage = error.error.detail;
        }

        this.showToast(errorMessage, "red");
      },
    });
  }

  generatePassword() {
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
    let password = "";

    for (let i = 0; i < this.passwordLength; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    this.user.password = password;
    this.showPassword = true;

    setTimeout(() => M.updateTextFields(), 100);
    this.showToast("Mot de passe généré", "blue");
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  copyPassword() {
    if (this.user.password) {
      navigator.clipboard.writeText(this.user.password).then(() => {
        this.showToast("Mot de passe copié", "green");
      });
    }
  }

  cancel() {
    if (confirm("Annuler ? Les modifications seront perdues.")) {
      this.router.navigate(["/users"]);
    }
  }

  showToast(message: string, color: string = "blue") {
    if (typeof M !== "undefined" && M.toast) {
      M.toast({ html: message, classes: color });
    } else {
      alert(message);
    }
  }
}
