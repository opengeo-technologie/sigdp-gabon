import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";

declare var M: any;

@Component({
  selector: "app-public",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./public.component.html",
  styleUrls: ["./public.component.css"],
})
export class PublicComponent implements OnInit {
  stats = {
    debarcaderes: 0,
    pecheurs: 0,
    bateaux: 0,
    captures: 0,
  };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // Initialiser Materialize pour le sidenav
    setTimeout(() => {
      if (typeof M !== "undefined") {
        M.Sidenav.init(document.querySelectorAll(".sidenav"), {});
      }
    }, 100);

    // Charger les statistiques publiques
    this.loadPublicStats();
  }

  loadPublicStats() {
    this.http
      .get<any>(`${environment.apiUrl}/api/statistiques/dashboard`)
      .subscribe({
        next: (data) => {
          // console.log(data);
          this.stats = {
            debarcaderes: data.globaux.debarcaderes_actifs || 0,
            pecheurs: data.globaux.pecheurs_actifs || 0,
            bateaux: data.globaux.bateaux_actifs || 0,
            // captures: data.captures_mois.quantite_tonnes,
            captures: data.captures_annee.quantite_tonnes,
          };
        },
        error: (error) => {
          console.log("Statistiques non disponibles:", error);
          // Valeurs par défaut si l'API n'est pas accessible
          this.stats = {
            debarcaderes: 0,
            pecheurs: 0,
            bateaux: 0,
            captures: 0,
          };
        },
      });
  }
}
