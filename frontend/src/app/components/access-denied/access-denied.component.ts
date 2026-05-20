// app/pages/access-denied/access-denied.component.ts

import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink } from "@angular/router";
import { Location } from "@angular/common";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-access-denied",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./access-denied.component.html",
  styleUrls: ["./access-denied.component.scss"],
})
export class AccessDeniedComponent implements OnInit {
  username: string = "";
  userRole: string = "";
  userEmail: string = "";

  constructor(
    private router: Router,
    private location: Location,
    public authService: AuthService,
  ) {}

  ngOnInit() {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.username = currentUser.username;
      this.userRole = currentUser.role;
      this.userEmail = currentUser.email || "";
    }
  }

  goBack() {
    this.location.back();
  }

  goHome() {
    this.router.navigate(["/dashboard"]);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(["/login"]);
  }
}
