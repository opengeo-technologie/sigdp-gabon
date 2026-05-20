import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";

declare var M: any;

interface RapportType {
  id: string;
  titre: string;
  description: string;
  icon: string;
  formats: string[];
  color: string;
}

@Component({
  selector: "app-rapports",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./rapports.component.html",
  styleUrls: ["./rapports.component.css"],
})
export class RapportsComponent implements OnInit {
  // Filtres
  filtres = {
    date_debut: "",
    date_fin: "",
    debarcadere_id: null as number | null,
    espece_id: null as number | null,
    statut: "",
  };

  debarcaderes: any[] = [];
  especes: any[] = [];
  loading = false;

  rapportTypes: RapportType[] = [
    {
      id: "synthese_activite",
      titre: "Synthèse d'activité",
      description: "Vue d'ensemble des activités de pêche sur la période",
      icon: "assessment",
      formats: ["pdf", "excel"],
      color: "blue",
    },
    {
      id: "debarquements",
      titre: "Débarquements",
      description: "Liste détaillée de tous les débarquements",
      icon: "inventory",
      formats: ["pdf", "excel", "csv"],
      color: "teal",
    },
    {
      id: "captures_par_espece",
      titre: "Captures par espèce",
      description: "Statistiques des captures groupées par espèce",
      icon: "set_meal",
      formats: ["pdf", "excel", "csv"],
      color: "green",
    },
    {
      id: "activite_debarcaderes",
      titre: "Activité débarcadères",
      description: "Performance et activité par site de débarquement",
      icon: "anchor",
      formats: ["pdf", "excel"],
      color: "indigo",
    },
    {
      id: "flotte_bateaux",
      titre: "Flotte de bateaux",
      description: "Inventaire complet de la flotte avec caractéristiques",
      icon: "directions_boat",
      formats: ["pdf", "excel", "csv"],
      color: "cyan",
    },
    {
      id: "pecheurs_actifs",
      titre: "Pêcheurs actifs",
      description: "Liste des pêcheurs avec statistiques d'activité",
      icon: "people",
      formats: ["pdf", "excel", "csv"],
      color: "purple",
    },
    {
      id: "quotas_utilisation",
      titre: "Utilisation des quotas",
      description: "Suivi de l'utilisation des quotas par espèce",
      icon: "pie_chart",
      formats: ["pdf", "excel"],
      color: "orange",
    },
    {
      id: "alertes",
      titre: "Alertes",
      description:
        "Liste des alertes déclenchées (quotas, espèces protégées, etc.)",
      icon: "warning",
      formats: ["pdf", "excel", "csv"],
      color: "red",
    },
    {
      id: "valeur_economique",
      titre: "Valeur économique",
      description: "Analyse de la valeur économique des captures",
      icon: "attach_money",
      formats: ["pdf", "excel"],
      color: "amber",
    },
    {
      id: "conformite",
      titre: "Conformité réglementaire",
      description: "Vérification des licences, certificats et conformité",
      icon: "verified",
      formats: ["pdf", "excel"],
      color: "deep-purple",
    },
    {
      id: "production_mensuelle",
      titre: "Production mensuelle",
      description: "Production halieutique par mois et comparaisons",
      icon: "trending_up",
      formats: ["pdf", "excel", "csv"],
      color: "light-blue",
    },
    {
      id: "engins_peche",
      titre: "Utilisation des engins",
      description: "Répartition des captures par type d'engin de pêche",
      icon: "settings_ethernet",
      formats: ["pdf", "excel"],
      color: "brown",
    },
    {
      id: "zones_peche",
      titre: "Activité par zone",
      description: "Répartition géographique des captures par zone de pêche",
      icon: "map",
      formats: ["pdf", "excel"],
      color: "teal",
    },
    {
      id: "effort_peche",
      titre: "Effort de pêche",
      description: "Analyse de l'effort de pêche (heures, sorties, CPUE)",
      icon: "schedule",
      formats: ["pdf", "excel"],
      color: "indigo",
    },
    {
      id: "saisonnalite",
      titre: "Saisonnalité",
      description: "Analyse saisonnière des captures par espèce",
      icon: "calendar_today",
      formats: ["pdf", "excel"],
      color: "green",
    },
    {
      id: "tailles_captures",
      titre: "Distribution des tailles",
      description: "Répartition des tailles capturées par espèce",
      icon: "straighten",
      formats: ["pdf", "excel"],
      color: "blue-grey",
    },
    {
      id: "prix_marche",
      titre: "Évolution des prix",
      description: "Suivi de l'évolution des prix au kg par espèce",
      icon: "show_chart",
      formats: ["pdf", "excel"],
      color: "lime",
    },
    {
      id: "rentabilite_sortie",
      titre: "Rentabilité par sortie",
      description: "Analyse de la rentabilité des sorties de pêche",
      icon: "account_balance",
      formats: ["pdf", "excel"],
      color: "green",
    },
    {
      id: "composition_captures",
      titre: "Composition des captures",
      description: "Diversité et composition spécifique des captures",
      icon: "donut_large",
      formats: ["pdf", "excel"],
      color: "purple",
    },
    {
      id: "surveillance_ressources",
      titre: "Surveillance des ressources",
      description: "Indicateurs de durabilité et état des stocks",
      icon: "eco",
      formats: ["pdf", "excel"],
      color: "teal",
    },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.chargerDebarcaderes();
    this.chargerEspeces();
    this.initializerDates();

    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.Datepicker.init(document.querySelectorAll(".datepicker"), {
        format: "yyyy-mm-dd",
        autoClose: true,
      });
    }, 100);
  }

  initializerDates() {
    const aujourd_hui = new Date();
    const il_y_a_30_jours = new Date();
    il_y_a_30_jours.setDate(aujourd_hui.getDate() - 30);

    this.filtres.date_debut = il_y_a_30_jours.toISOString().split("T")[0];
    this.filtres.date_fin = aujourd_hui.toISOString().split("T")[0];
  }

  chargerDebarcaderes() {
    this.http.get<any[]>(`${environment.apiUrl}/api/debarcaderes`).subscribe({
      next: (data) => {
        this.debarcaderes = data;
        setTimeout(
          () => M.FormSelect.init(document.querySelectorAll("select"), {}),
          100,
        );
      },
      error: (error) => console.error("Erreur chargement débarcadères:", error),
    });
  }

  chargerEspeces() {
    this.http.get<any[]>(`${environment.apiUrl}/api/especes`).subscribe({
      next: (data) => {
        this.especes = data;
        setTimeout(
          () => M.FormSelect.init(document.querySelectorAll("select"), {}),
          100,
        );
      },
      error: (error) => console.error("Erreur chargement espèces:", error),
    });
  }

  genererRapport(typeRapport: string, format: string) {
    this.loading = true;

    // Construire le body JSON (pas de query params!)
    const requestBody: any = {
      type: typeRapport,
      format: format,
    };

    // Ajouter les filtres au body
    if (this.filtres.date_debut)
      requestBody.date_debut = this.filtres.date_debut;
    if (this.filtres.date_fin) requestBody.date_fin = this.filtres.date_fin;
    if (this.filtres.debarcadere_id)
      requestBody.debarcadere_id = this.filtres.debarcadere_id;
    if (this.filtres.espece_id) requestBody.espece_id = this.filtres.espece_id;
    if (this.filtres.statut) requestBody.statut = this.filtres.statut;

    // ✅ IMPORTANT: POST avec body JSON, pas GET avec query params!
    // console.log(requestBody);
    const queryString = new URLSearchParams(requestBody).toString();
    const url = `${environment.apiUrl}/api/rapports/generer?${queryString}`;
    this.http
      .post(url, requestBody, {
        responseType: "blob",
        observe: "response",
      })
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (blob) {
            this.telechargerFichier(blob, typeRapport, format);
          }
          this.loading = false;
          M.toast({ html: "Rapport généré avec succès", classes: "green" });
        },
        error: (error) => {
          console.error("Erreur génération rapport:", error);
          this.loading = false;

          let message = "Erreur lors de la génération du rapport";
          if (error.status === 405) {
            message =
              "Erreur 405: Vérifiez que le backend accepte POST avec body JSON";
          } else if (error.status === 422) {
            message = "Erreur 422: Paramètres invalides";
          } else if (error.status === 500) {
            message = "Erreur serveur: Vérifiez les logs backend";
          }

          M.toast({ html: message, classes: "red" });
        },
      });
  }

  telechargerFichier(blob: Blob, typeRapport: string, format: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const date = new Date().toISOString().split("T")[0];
    const extension = format === "excel" ? "xlsx" : format;
    link.download = `rapport_${typeRapport}_${date}.${extension}`;

    link.click();
    window.URL.revokeObjectURL(url);
  }

  exporterRapide(type: string, format: string) {
    this.genererRapport(type, format);
  }

  resetFiltres() {
    this.initializerDates();
    this.filtres.debarcadere_id = null;
    this.filtres.espece_id = null;
    this.filtres.statut = "";

    setTimeout(() => {
      M.FormSelect.init(document.querySelectorAll("select"), {});
      M.updateTextFields();
    }, 100);
  }
}
