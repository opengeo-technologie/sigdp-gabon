import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { Router } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { UserProfile, PasswordChange } from "../interfaces/profile";

@Injectable({
  providedIn: "root",
})
export class UserService {
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

  getUsers() {
    return this.http.get<any[]>(`${this.apiUrl}/users`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  getUser(id: number) {
    return this.http.get<any>(`${this.apiUrl}/users/${id}`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  saveUser(data: any) {
    return this.http.post(`${this.apiUrl}/register`, data, {
      headers: { Authorization: `Bearer ${this.getToken()}` },
    });
  }

  updateUser(id: number, data: any) {
    return this.http.put(`${this.apiUrl}/users/${id}`, data, {
      headers: { Authorization: `Bearer ${this.getToken()}` },
    });
  }

  deleteUser(id: number) {
    return this.http.delete(`${this.apiUrl}/users/${id}`, {
      headers: { Authorization: `Bearer ${this.getToken()}` },
    });
  }
}
