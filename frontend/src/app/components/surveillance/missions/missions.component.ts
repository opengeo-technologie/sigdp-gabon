import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { MissionsService } from "../../../services/missions.service";
import {
  Mission,
  MissionDetail,
  Equipe,
  Rapport,
  LABELS_TYPE_MISSION,
  COULEUR_TYPE_MISSION,
} from "../../../models/missions.model";

// Réutilise le référentiel des agents pour composer les équipes
import { AgentControleService } from "../../../services/agent-controle.service";
import { Agent } from "../../../models/agents.model";

declare const M: any; // Materialize global
import { HasPermissionDirective } from "../../../directives/has-permission.directive";
import { RouterModule } from "@angular/router";

@Component({
  selector: "app-missions",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./missions.component.html",
  styleUrl: "./missions.component.scss",
})
export class MissionsComponent {
  private srv = inject(MissionsService);
  private agentsSrv = inject(AgentControleService);

  labelType = LABELS_TYPE_MISSION;
  couleurType = COULEUR_TYPE_MISSION;
  readonly typesMission = Object.keys(LABELS_TYPE_MISSION);

  chargement = false;

  // ---- Liste des missions ----
  missions: Mission[] = [];
  filtre = { q: "", type_mission: "", date_debut: "", date_fin: "" };
  missionForm: Partial<Mission> = this.nouvelleMission();
  missionEnEdition = false;

  // ---- Dossier (mission active) ----
  dossier: MissionDetail | null = null;

  // Équipe
  agentsRef: Agent[] = [];
  membreForm = { agent_id: null as number | null, role_agent: "" };

  // Rapports
  rapportForm: Partial<Rapport> = {};
  rapportEnEdition = false;

  // Scan
  fichierScan: File | null = null;

  ngOnInit(): void {
    this.chargerMissions();
    this.agentsSrv.listerAgents().subscribe((a) => (this.agentsRef = a));
  }

  // =====================================================================
  //  MISSIONS
  // =====================================================================
  private nouvelleMission(): Partial<Mission> {
    return {
      date_depart: new Date().toISOString().slice(0, 10),
      type_mission: "terrain",
    };
  }

  chargerMissions(): void {
    this.chargement = true;
    this.srv
      .listerMissions({
        q: this.filtre.q || null,
        type_mission: (this.filtre.type_mission || null) as any,
        date_debut: this.filtre.date_debut || null,
        date_fin: this.filtre.date_fin || null,
      })
      .subscribe({
        next: (r) => {
          this.missions = r;
          this.chargement = false;
        },
        error: () => {
          this.chargement = false;
          this.toast("Erreur de chargement des missions", true);
        },
      });
  }

  ouvrirFormMission(m?: Mission): void {
    this.missionEnEdition = !!m;
    this.missionForm = m ? { ...m } : this.nouvelleMission();
    this.ouvrirModal("modal-mission");
  }

  enregistrerMission(): void {
    const req = this.missionEnEdition
      ? this.srv.modifierMission(this.missionForm as any)
      : this.srv.creerMission(this.missionForm);
    req.subscribe({
      next: () => {
        this.fermerModal("modal-mission");
        this.chargerMissions();
        this.toast(
          this.missionEnEdition ? "Mission mise à jour" : "Mission créée",
        );
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  supprimerMission(m: Mission): void {
    if (
      !confirm(
        `Supprimer la mission du ${m.date_depart} ? (équipe et rapports inclus)`,
      )
    )
      return;
    this.srv.supprimerMission(m.id).subscribe({
      next: () => {
        this.chargerMissions();
        this.toast("Mission supprimée");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  // =====================================================================
  //  FICHE PDF
  // =====================================================================
  /** Ouvre la fiche (pré-remplie) dans un nouvel onglet pour aperçu/impression. */
  apercuFiche(id: number, vierge = false): void {
    window.open(this.srv.ficheUrl(id, { vierge }), "_blank");
  }

  /** Télécharge la fiche en PDF. */
  telechargerFiche(id: number, vierge = false): void {
    this.srv.telechargerFiche(id, vierge).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fiche_mission_${vierge ? "vierge" : "MIS-" + String(id).padStart(4, "0")}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast("Échec du téléchargement de la fiche", true),
    });
  }

  // =====================================================================
  //  DOSSIER : équipe / rapports / scan
  // =====================================================================
  ouvrirDossier(m: Mission): void {
    this.membreForm = { agent_id: null, role_agent: "" };
    this.rapportForm = { date_rapport: new Date().toISOString().slice(0, 10) };
    this.rapportEnEdition = false;
    this.fichierScan = null;
    this.srv.detailMission(m.id).subscribe((d) => {
      this.dossier = d;
      this.ouvrirModal("modal-dossier");
    });
  }

  private rafraichirDossier(): void {
    if (!this.dossier) return;
    this.srv
      .detailMission(this.dossier.id)
      .subscribe((d) => (this.dossier = d));
    this.chargerMissions();
  }

  /** Agents encore disponibles (non déjà dans l'équipe). */
  get agentsDisponibles(): Agent[] {
    if (!this.dossier) return this.agentsRef;
    const pris = new Set(this.dossier.membres.map((e) => e.agent_id));
    return this.agentsRef.filter((a) => !pris.has(a.id));
  }

  ajouterMembre(): void {
    if (!this.dossier || !this.membreForm.agent_id) return;
    this.srv
      .ajouterMembre(
        this.dossier.id,
        this.membreForm.agent_id,
        this.membreForm.role_agent || undefined,
      )
      .subscribe({
        next: () => {
          this.membreForm = { agent_id: null, role_agent: "" };
          this.rafraichirDossier();
          this.toast("Agent ajouté à l'équipe");
        },
        error: (e) => this.toast(this.messageErreur(e), true),
      });
  }

  changerRole(e: Equipe, role: string): void {
    this.srv.modifierRole(e.id, role).subscribe(() => this.rafraichirDossier());
  }

  retirerMembre(e: Equipe): void {
    this.srv.retirerMembre(e.id).subscribe({
      next: () => {
        this.rafraichirDossier();
        this.toast("Agent retiré");
      },
      error: (err) => this.toast(this.messageErreur(err), true),
    });
  }

  // ---- Rapports ----
  editerRapport(r: Rapport): void {
    this.rapportEnEdition = true;
    this.rapportForm = { ...r };
  }
  annulerEditionRapport(): void {
    this.rapportEnEdition = false;
    this.rapportForm = { date_rapport: new Date().toISOString().slice(0, 10) };
  }
  enregistrerRapport(): void {
    if (!this.dossier) return;
    const req = this.rapportEnEdition
      ? this.srv.modifierRapport(this.rapportForm as any)
      : this.srv.creerRapport({
          ...this.rapportForm,
          mission_id: this.dossier.id,
        });
    req.subscribe({
      next: () => {
        this.annulerEditionRapport();
        this.rafraichirDossier();
        this.toast("Rapport enregistré");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }
  supprimerRapport(r: Rapport): void {
    if (!confirm("Supprimer ce rapport ?")) return;
    this.srv.supprimerRapport(r.id).subscribe({
      next: () => {
        this.rafraichirDossier();
        this.toast("Rapport supprimé");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  // ---- Scan ----
  onFichierChoisi(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.fichierScan = input.files?.[0] ?? null;
  }
  televerserScan(): void {
    if (!this.dossier || !this.fichierScan) return;
    this.srv.uploaderScan(this.dossier.id, this.fichierScan).subscribe({
      next: (res) => {
        if (this.dossier)
          this.dossier.rapport_scan =
            res.rapport_scan ?? this.dossier.rapport_scan;
        this.fichierScan = null;
        this.toast("Document téléversé");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  // =====================================================================
  //  Helpers Materialize
  // =====================================================================
  private ouvrirModal(id: string): void {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const inst =
        M.Modal.getInstance(el) || M.Modal.init(el, { dismissible: false });
      inst.open();
      M.updateTextFields();
      M.FormSelect.init(document.querySelectorAll("select"));
    }, 50);
  }
  private fermerModal(id: string): void {
    const el = document.getElementById(id);
    if (el) M.Modal.getInstance(el)?.close();
  }
  private toast(msg: string, erreur = false): void {
    M?.toast?.({
      html: msg,
      classes: erreur ? "red darken-1" : "green darken-1",
    });
  }
  private messageErreur(e: any): string {
    const d = e?.error?.detail;
    if (Array.isArray(d)) return d.map((x) => x.msg).join(" · ");
    return d || "Une erreur est survenue.";
  }
}
