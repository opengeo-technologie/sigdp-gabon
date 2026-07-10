import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, ActivatedRoute, Router } from "@angular/router";
import { DebarcadereService } from "../../../services/debarcadere.service";
import { Debarcadere } from "../../../models/debarcadere.model";
import { environment } from "../../../../environments/environment";
import { HasPermissionDirective } from "../../../directives/has-permission.directive";

declare var M: any;

@Component({
  selector: "app-debarcadere-detail",
  standalone: true,
  imports: [CommonModule, RouterModule, HasPermissionDirective],
  templateUrl: "./debarcadere-detail.component.html",
  styleUrls: ["./debarcadere-detail.component.css"],
})
export class DebarcadereDetailComponent implements OnInit {
  debarcadere?: Debarcadere;
  debarcadereId?: number;
  statistiques?: any;

  url: any = `${environment.apiUrl}/uploads/debarcaderes/`;

  constructor(
    private debarcadereService: DebarcadereService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      this.debarcadereId = +params["id"];
      this.loadDebarcadere();
      this.loadStatistiques();
    });
  }

  loadDebarcadere() {
    if (this.debarcadereId) {
      this.debarcadereService.getDebarcadere(this.debarcadereId).subscribe({
        next: (data) => {
          // console.log(data);
          this.debarcadere = data;
          setTimeout(() => this.initializeMap(), 100);
        },
        error: (error) => {
          console.error("Erreur lors du chargement:", error);
          M.toast({
            html: "Erreur lors du chargement du débarcadère",
            classes: "red",
          });
          this.router.navigate(["/debarcaderes"]);
        },
      });
    }
  }

  loadStatistiques() {
    if (this.debarcadereId) {
      this.debarcadereService
        .getStatistiquesDebarcadere(this.debarcadereId)
        .subscribe({
          next: (data) => {
            // console.log(data);
            this.statistiques = data;
          },
          error: (error) => {
            console.error("Erreur lors du chargement:", error);
            M.toast({
              html: "Erreur lors du chargement du débarcadère",
              classes: "red",
            });
            this.router.navigate(["/debarcaderes"]);
          },
        });
    }
  }

  deleteDebarcadere() {
    if (
      this.debarcadere &&
      confirm(
        `Êtes-vous sûr de vouloir supprimer le débarcadère "${this.debarcadere.denomination}" ?`,
      )
    ) {
      this.debarcadereService.deleteDebarcadere(this.debarcadere.id).subscribe({
        next: () => {
          M.toast({
            html: "Débarcadère supprimé avec succès",
            classes: "green",
          });
          this.router.navigate(["/debarcaderes"]);
        },
        error: (error) => {
          console.error("Erreur lors de la suppression:", error);
          M.toast({ html: "Erreur lors de la suppression", classes: "red" });
        },
      });
    }
  }

  getStatutClass(): string {
    if (!this.debarcadere) return "";
    const classes: { [key: string]: string } = {
      Actif: "actif",
      Inactif: "inactif",
      "En travaux": "en-travaux",
    };
    return classes[this.debarcadere.statut_operationnel] || "";
  }

  getMilieuClass(): string {
    return this.debarcadere?.milieu || "";
  }

  getGoogleMapsUrl(): string {
    if (!this.debarcadere) return "#";
    return `https://www.google.com/maps?q=${this.debarcadere.latitude},${this.debarcadere.longitude}`;
  }

  private initializeMap() {
    // Placeholder pour la carte Leaflet
    // À implémenter avec Leaflet
  }
}
