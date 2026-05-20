import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, of } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { Router } from "@angular/router";
import { environment } from "../../environments/environment";
import { PermissionsRolesService } from "./permissions-roles.service";

export interface User {
  id: number;
  username: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
  is_active: boolean;
  telephone?: string;
  debarcadere_affecte?: string;
  province_affectee?: string;
  permissions: any[]; // Liste des permissions de l'utilisateur
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  private apiUrl = `${environment.apiUrl}/api/auth`;

  permissions: string[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private userPermissions: PermissionsRolesService,
  ) {
    // Charger l'utilisateur au démarrage si un token existe
    const token = this.getToken();
    if (token) {
      this.loadCurrentUser();
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    const loginData: LoginRequest = { username, password };

    return this.http
      .post<LoginResponse>(`${this.apiUrl}/login`, loginData)
      .pipe(
        tap((response) => {
          this.setToken(response.access_token);
          setTimeout(() => {
            this.loadCurrentUser();
          }, 100);
        }),
      );
  }

  logout() {
    localStorage.removeItem("access_token");
    this.currentUserSubject.next(null);
    this.router.navigate(["/login"]);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem("access_token");
  }

  private setToken(token: string) {
    localStorage.setItem("access_token", token);
  }

  loadCurrentUser() {
    this.http
      .get<User>(`${this.apiUrl}/me`, {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      })
      .subscribe({
        next: (user) => {
          // console.log("Utilisateur chargé:", user);
          this.currentUserSubject.next(user);
        },
        error: (error) => {
          console.error("Erreur chargement utilisateur:", error);
          this.logout();
        },
      });
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  public get currentUserValue(): User | null {
    // console.log(
    //   "Récupération utilisateur actuel:",
    //   this.currentUserSubject.value,
    // );
    return this.currentUserSubject.value;
  }

  // isAdmin(): boolean {
  //   const user = this.currentUserSubject.value;
  //   return user?.role === "admin" || false;
  // }

  isAgent(): boolean {
    const user = this.currentUserSubject.value;
    return user?.role === "Agent de contrôle" || false;
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/change-password`, {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  updateProfile(userData: Partial<User>): Observable<User> {
    return this.http
      .put<User>(`${this.apiUrl}/me`, userData)
      .pipe(tap((user) => this.currentUserSubject.next(user)));
  }

  // Admin methods
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${id}`);
  }

  createUser(userData: any): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/register`, userData);
  }

  updateUser(id: number, userData: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${id}`, userData);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/${id}`);
  }

  // ========================================
  // Méthodes de vérification des permissions
  // ========================================

  /**
   * Vérifier si l'utilisateur a UNE permission spécifique
   */

  hasPermission(permission: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) {
      return false;
    }

    const list_perms = user.permissions.map((p) => p.code || p);

    return list_perms.includes(permission);
  }

  /**
   * Vérifier si l'utilisateur a AU MOINS UNE des permissions
   */
  hasAnyPermission(...permissions: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) {
      return false;
    }

    // console.log("Permissions utilisateur:", user.permissions);

    const list_perms = user.permissions.map((p) => p.code || p);
    // console.log("Permissions utilisateur:", list_perms);

    return permissions.some((perm) => list_perms.includes(perm));
  }

  /**
   * Vérifier si l'utilisateur a TOUTES les permissions
   */
  hasAllPermissions(...permissions: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) {
      return false;
    }

    const list_perms = user.permissions.map((p) => p.code || p);
    // console.log("Permissions utilisateur:", list_perms);

    return permissions.every((perm) => list_perms.includes(perm));
  }

  /**
   * Vérifier si l'utilisateur a un rôle spécifique
   */
  hasRole(role: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.role) {
      return false;
    }

    return user.role === role;
  }

  /**
   * Vérifier si l'utilisateur est admin ou super admin
   */
  isAdmin(): boolean {
    return this.hasRole("admin") || this.hasRole("super_admin");
  }
}
