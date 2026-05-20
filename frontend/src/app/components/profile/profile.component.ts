import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { environment } from "../../../environments/environment";
import { AuthService } from "../../services/auth.service";
import { ProfileService } from "../../services/profile.service";
import {
  UserProfile,
  PasswordChange,
  NotificationSettings,
} from "../../interfaces/profile";

declare var M: any;

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./profile.component.html",
  styleUrl: "./profile.component.scss",
})
export class ProfileComponent {
  currentUser: UserProfile | null = null;
  loading = false;
  saving = false;

  // Onglets
  activeTab = "informations";

  // Formulaires
  profileForm: any = {};
  passwordForm: PasswordChange = {
    ancien_password: "",
    nouveau_password: "",
    confirmer_password: "",
  };

  notificationSettings: NotificationSettings = {
    email_debarquements: true,
    email_alertes: true,
    email_rapports: false,
    email_quotas: true,
    notifications_push: true,
    frequence_emails: "quotidien",
  };

  // Upload photo
  selectedFile: File | null = null;
  photoPreview: string | null = null;

  // Statistiques utilisateur
  stats: any = null;

  // Historique activité
  activityLog: any[] = [];

  errors: any = {};

  picture_url: any = `${environment.apiUrl}/`;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router,
    private profileService: ProfileService,
  ) {}

  ngOnInit() {
    this.loadProfile();
    this.loadUserStats();
    this.loadActivityLog();

    setTimeout(() => {
      M.Tabs.init(document.querySelectorAll(".tabs"), {});
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.updateTextFields();
    }, 100);
  }

  loadProfile() {
    this.loading = true;

    this.profileService.getProfile().subscribe({
      next: (data) => {
        this.currentUser = data;
        this.profileForm = { ...data };

        // Charger les préférences si elles existent
        if (data.preferences) {
          this.notificationSettings = {
            ...this.notificationSettings,
            ...data.preferences.notifications,
          };
        }

        this.loading = false;

        setTimeout(() => {
          M.FormSelect.init(document.querySelectorAll("select"), {});
          M.updateTextFields();
        }, 100);
      },
      error: (error) => {
        console.error("Erreur chargement profil:", error);
        this.loading = false;
        M.toast({ html: "Erreur chargement profil", classes: "red" });
      },
    });
  }

  loadUserStats() {
    this.profileService.getProfileStats().subscribe({
      next: (data) => {
        console.log("Stats utilisateur:", data);
        this.stats = data;
      },
      error: (error) => {
        console.error("Erreur chargement stats:", error);
      },
    });
  }

  loadActivityLog() {
    this.profileService.getActivityLogs().subscribe({
      next: (data) => {
        this.activityLog = data;
      },
      error: (error) => {
        console.error("Erreur chargement activité:", error);
      },
    });
  }

  switchTab(tab: string) {
    this.activeTab = tab;
  }

  validateProfileForm(): boolean {
    this.errors = {};
    let isValid = true;

    if (!this.profileForm.nom || this.profileForm.nom.trim().length < 2) {
      this.errors.nom = "Le nom doit contenir au moins 2 caractères";
      isValid = false;
    }

    if (!this.profileForm.prenom || this.profileForm.prenom.trim().length < 2) {
      this.errors.prenom = "Le prénom doit contenir au moins 2 caractères";
      isValid = false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.profileForm.email || !emailRegex.test(this.profileForm.email)) {
      this.errors.email = "Email invalide";
      isValid = false;
    }

    if (this.profileForm.telephone && this.profileForm.telephone.length > 0) {
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(this.profileForm.telephone)) {
        this.errors.telephone = "Numéro de téléphone invalide";
        isValid = false;
      }
    }

    return isValid;
  }

  saveProfile() {
    if (!this.validateProfileForm()) {
      M.toast({ html: "Veuillez corriger les erreurs", classes: "orange" });
      return;
    }

    this.saving = true;

    const profileData = {
      nom: this.profileForm.nom,
      prenom: this.profileForm.prenom,
      email: this.profileForm.email,
      telephone: this.profileForm.telephone || null,
      adresse: this.profileForm.adresse || null,
      ville: this.profileForm.ville || null,
      code_postal: this.profileForm.code_postal || null,
      pays: this.profileForm.pays || "Gabon",
    };

    this.profileService.saveProfile(profileData).subscribe({
      next: (response) => {
        this.saving = false;
        M.toast({ html: "Profil mis à jour avec succès", classes: "green" });
        this.loadProfile();
      },
      error: (error) => {
        console.error("Erreur sauvegarde:", error);
        this.saving = false;

        let errorMessage = "Erreur lors de la sauvegarde";
        if (error.status === 400 && error.error?.detail) {
          errorMessage = error.error.detail;
        }

        M.toast({ html: errorMessage, classes: "red" });
      },
    });
  }

  updateProfile() {
    this.profileService.updateProfile(this.profileForm).subscribe({
      next: (updatedUser) => {
        this.loadProfile();
        M.toast({ html: "Profil mis à jour", classes: "green" });
      },
      error: (error) => {
        console.error("Erreur mise à jour profil:", error);
        M.toast({ html: "Erreur mise à jour profil", classes: "red" });
      },
    });
  }

  validatePasswordForm(): boolean {
    this.errors = {};
    let isValid = true;

    if (!this.passwordForm.ancien_password) {
      this.errors.ancien_password = "Ancien mot de passe requis";
      isValid = false;
    }

    if (
      !this.passwordForm.nouveau_password ||
      this.passwordForm.nouveau_password.length < 6
    ) {
      this.errors.nouveau_password =
        "Le nouveau mot de passe doit contenir au moins 6 caractères";
      isValid = false;
    }

    if (
      this.passwordForm.nouveau_password !==
      this.passwordForm.confirmer_password
    ) {
      this.errors.confirmer_password = "Les mots de passe ne correspondent pas";
      isValid = false;
    }

    if (
      this.passwordForm.ancien_password === this.passwordForm.nouveau_password
    ) {
      this.errors.nouveau_password =
        "Le nouveau mot de passe doit être différent de l'ancien";
      isValid = false;
    }

    return isValid;
  }

  changePassword() {
    if (!this.validatePasswordForm()) {
      M.toast({ html: "Veuillez corriger les erreurs", classes: "orange" });
      return;
    }

    this.saving = true;

    let data = {
      ancien_password: this.passwordForm.ancien_password,
      nouveau_password: this.passwordForm.nouveau_password,
      confirmer_password: this.passwordForm.confirmer_password,
    };

    this.profileService.changePassword(data).subscribe({
      next: (response) => {
        this.saving = false;
        this.passwordForm = {
          ancien_password: "",
          nouveau_password: "",
          confirmer_password: "",
        };
        M.toast({
          html: "Mot de passe modifié avec succès",
          classes: "green",
        });
      },
      error: (error) => {
        console.error("Erreur changement password:", error);
        this.saving = false;

        let errorMessage = "Erreur lors du changement de mot de passe";
        if (error.status === 400 && error.error?.detail) {
          if (error.error.detail.includes("incorrect")) {
            errorMessage = "Ancien mot de passe incorrect";
          } else {
            errorMessage = error.error.detail;
          }
        }

        M.toast({ html: errorMessage, classes: "red" });
      },
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Vérifier le type de fichier
      if (!file.type.startsWith("image/")) {
        M.toast({ html: "Veuillez sélectionner une image", classes: "orange" });
        return;
      }

      // Vérifier la taille (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        M.toast({
          html: "L'image ne doit pas dépasser 2 MB",
          classes: "orange",
        });
        return;
      }

      this.selectedFile = file;

      // Aperçu
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.photoPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  uploadPhoto() {
    if (!this.selectedFile) {
      M.toast({ html: "Veuillez sélectionner une photo", classes: "orange" });
      return;
    }

    this.saving = true;

    const formData = new FormData();
    formData.append("photo", this.selectedFile);

    this.profileService.uploadPicture(this.selectedFile).subscribe({
      next: (response: any) => {
        this.saving = false;
        this.selectedFile = null;
        this.photoPreview = null;
        M.toast({ html: "Photo de profil mise à jour", classes: "green" });
        this.loadProfile();
      },
      error: (error) => {
        console.error("Erreur upload photo:", error);
        this.saving = false;
        M.toast({ html: "Erreur lors de l'upload", classes: "red" });
      },
    });
  }

  saveNotificationSettings() {
    this.saving = true;

    const preferences = {
      notifications: this.notificationSettings,
    };

    this.profileService.updateNotificationSettings(preferences).subscribe({
      next: (response) => {
        this.saving = false;
        M.toast({ html: "Préférences enregistrées", classes: "green" });
      },
      error: (error) => {
        console.error("Erreur sauvegarde préférences:", error);
        this.saving = false;
        M.toast({ html: "Erreur sauvegarde préférences", classes: "red" });
      },
    });
  }

  deleteAccount() {
    const confirmation = prompt(
      'Pour confirmer la suppression de votre compte, tapez "SUPPRIMER" :',
    );

    if (confirmation === "SUPPRIMER") {
      this.http.delete(`${environment.apiUrl}/api/auth/profile`).subscribe({
        next: () => {
          M.toast({ html: "Compte supprimé", classes: "green" });
          this.authService.logout();
          this.router.navigate(["/login"]);
        },
        error: (error) => {
          console.error("Erreur suppression compte:", error);
          M.toast({ html: "Erreur suppression compte", classes: "red" });
        },
      });
    } else if (confirmation !== null) {
      M.toast({ html: "Suppression annulée", classes: "blue" });
    }
  }

  exportMyData() {
    this.profileService.exportData().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `mes-donnees-${new Date().toISOString().split("T")[0]}.json`;
        link.click();
        window.URL.revokeObjectURL(url);

        M.toast({ html: "Données exportées", classes: "green" });
      },
      error: (error) => {
        console.error("Erreur export:", error);
        M.toast({ html: "Erreur export données", classes: "red" });
      },
    });
  }

  getRoleBadgeClass(role: string): string {
    const classes: any = {
      admin: "red",
      gestionnaire: "blue",
      operateur: "green",
      consultant: "orange",
    };
    return classes[role] || "grey";
  }

  getRoleLabel(role: string): string {
    const labels: any = {
      admin: "Administrateur",
      gestionnaire: "Gestionnaire",
      operateur: "Opérateur",
      consultant: "Consultant",
    };
    return labels[role] || role;
  }

  getActivityIcon(action: string): string {
    const icons: any = {
      login: "login",
      logout: "logout",
      create: "add_circle",
      update: "edit",
      delete: "delete",
      export: "download",
      import: "upload",
    };
    return icons[action] || "info";
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
