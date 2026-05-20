import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import { HttpClient } from "@angular/common/http";
import { Module, Permission, Role } from "../interfaces/permission-role";

@Injectable({
  providedIn: "root",
})
export class PermissionsRolesService {
  private apiUrl = `${environment.apiUrl}/api/permissions`;

  constructor(private http: HttpClient) {}

  getToken(): string | null {
    return localStorage.getItem("access_token");
  }

  getRoles() {
    return this.http.get<Role[]>(`${this.apiUrl}/roles`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  getPermissions() {
    return this.http.get<Permission[]>(`${this.apiUrl}/permissions`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  getModules() {
    return this.http.get<Module[]>(`${this.apiUrl}/modules`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  getPermission(id: number) {
    return this.http.get<any>(`${this.apiUrl}/users/${id}/permissions`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  createRole(data: any) {
    return this.http.post(`${this.apiUrl}/roles`, data, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  updateRole(id: number, data: any) {
    return this.http.put(`${this.apiUrl}/roles/${id}`, data, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  deleteRole(id: number) {
    return this.http.delete(`${this.apiUrl}/roles/${id}`, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
  }

  assignPermissionsToUser(userId: number, permissions: any) {
    return this.http.put(
      `${this.apiUrl}/users/${userId}/permissions`,
      permissions,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      },
    );
  }

  assignPermissionsToRole(roleId: number, permissions: number[]) {
    return this.http.put(
      `${this.apiUrl}/roles/${roleId}/permissions`,
      { permissions },
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      },
    );
  }

  removePermissionFromUser(userId: number, permissionId: number) {
    return this.http.delete(
      `${this.apiUrl}/users/${userId}/permissions/${permissionId}`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      },
    );
  }

  removePermissionFromRole(roleId: number, permissionId: number) {
    return this.http.delete(
      `${this.apiUrl}/roles/${roleId}/permissions/${permissionId}`,
      {
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
        },
      },
    );
  }

  toogleUserStatus(userId: number, actif: boolean) {
    return this.http.put(
      `${environment.apiUrl}/api/auth/users/${userId}/status`,
      { is_active: actif },
      {
        headers: { Authorization: `Bearer ${this.getToken()}` },
      },
    );
  }
}
