import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { Router } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { UserProfile, PasswordChange } from "../interfaces/profile";

@Injectable({
  providedIn: "root",
})
export class ProfileService {
  currentUser: UserProfile | null = null;

  private apiUrl = `${environment.apiUrl}/api/auth`;
  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    // Charger l'utilisateur au démarrage si un token existe
    const token = this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem("access_token");
  }

  getProfile() {
    return this.http.get<UserProfile>(
      `${environment.apiUrl}/api/auth/profile`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      },
    );
  }

  getProfileStats() {
    return this.http.get<any>(`${environment.apiUrl}/api/auth/profile/stats`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  getActivityLogs() {
    return this.http.get<any[]>(
      `${environment.apiUrl}/api/auth/profile/activity`,
      {
        params: { limit: "10" },
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      },
    );
  }

  saveProfile(data: any) {
    return this.http.put(`${environment.apiUrl}/api/auth/profile`, data, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  updateProfile(data: any) {
    return this.http.put(`${environment.apiUrl}/api/auth/profile`, data, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  uploadPicture(file: File) {
    const formData = new FormData();
    formData.append("photo", file);
    return this.http.post(
      `${environment.apiUrl}/api/auth/profile/upload-photo`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      },
    );
  }

  changePassword(data: PasswordChange) {
    return this.http.post(
      `${environment.apiUrl}/api/auth/profile/change-password`,
      data,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      },
    );
  }

  updateNotificationSettings(settings: any) {
    return this.http.put(
      `${environment.apiUrl}/api/auth/profile/preferences`,
      settings,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      },
    );
  }

  deleteAccount() {
    return this.http.delete(`${environment.apiUrl}/api/auth/profile`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  exportData() {
    return this.http.get(`${environment.apiUrl}/api/auth/profile/export`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
      responseType: "blob",
    });
  }
}
