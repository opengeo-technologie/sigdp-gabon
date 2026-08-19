import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { AgentControleService } from "../../../services/agent-controle.service";
import { Fonction, Organisme, Agent } from "../../../models/agents.model";

declare const M: any; // Materialize global

import { HasPermissionDirective } from "../../../directives/has-permission.directive";
import { RouterModule } from "@angular/router";

type Onglet = "agents" | "fonctions" | "organismes";

@Component({
  selector: "app-agent-controle",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: "./agent-controle.component.html",
  styleUrl: "./agent-controle.component.scss",
})
export class AgentControleComponent {
  private srv = inject(AgentControleService);

  onglet: Onglet = "agents";
  chargement = false;

  // Référentiels (servent aussi de source aux <select> du formulaire agent)
  fonctions: Fonction[] = [];
  organismes: Organisme[] = [];

  // ---- Agents ----
  agents: Agent[] = [];
  filtreAgent = {
    q: "",
    fonction_id: null as number | null,
    organisme_id: null as number | null,
  };
  agentForm: Partial<Agent> = this.nouvelAgent();
  agentEnEdition = false;

  // ---- Fonctions ----
  fonctionForm: Partial<Fonction> = {};
  fonctionEnEdition = false;

  // ---- Organismes ----
  organismeForm: Partial<Organisme> = {};
  organismeEnEdition = false;

  ngOnInit(): void {
    this.chargerReferentiels(() => this.chargerAgents());
  }

  changerOnglet(o: Onglet): void {
    this.onglet = o;
  }

  /** Charge fonctions + organismes puis exécute un éventuel callback. */
  private chargerReferentiels(apres?: () => void): void {
    this.srv.listerFonctions().subscribe((f) => {
      this.fonctions = f;
      this.srv.listerOrganismes().subscribe((o) => {
        this.organismes = o;
        apres?.();
        setTimeout(
          () => M?.FormSelect?.init(document.querySelectorAll("select")),
          50,
        );
      });
    });
  }

  // =====================================================================
  //  AGENTS
  // =====================================================================
  private nouvelAgent(): Partial<Agent> {
    return {
      matricule: "",
      nom: "",
      prenom: "",
      fonction_id: null,
      organisme_id: null,
    };
  }

  chargerAgents(): void {
    this.chargement = true;
    this.srv
      .listerAgents({
        q: this.filtreAgent.q || null,
        fonction_id: this.filtreAgent.fonction_id || null,
        organisme_id: this.filtreAgent.organisme_id || null,
      })
      .subscribe({
        next: (r) => {
          this.agents = r;
          this.chargement = false;
        },
        error: () => {
          this.chargement = false;
          this.toast("Erreur de chargement des agents", true);
        },
      });
  }

  ouvrirFormAgent(a?: Agent): void {
    this.agentEnEdition = !!a;
    this.agentForm = a ? { ...a } : this.nouvelAgent();
    this.ouvrirModal("modal-agent");
  }

  enregistrerAgent(): void {
    const req = this.agentEnEdition
      ? this.srv.modifierAgent(this.agentForm as any)
      : this.srv.creerAgent(this.agentForm);
    req.subscribe({
      next: () => {
        this.fermerModal("modal-agent");
        this.chargerAgents();
        this.chargerReferentiels(); // rafraîchit les compteurs nb_agents
        this.toast(this.agentEnEdition ? "Agent mis à jour" : "Agent créé");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  supprimerAgent(a: Agent): void {
    if (!confirm(`Supprimer l'agent ${a.matricule} — ${a.nom} ${a.prenom} ?`))
      return;
    this.srv.supprimerAgent(a.id).subscribe({
      next: () => {
        this.chargerAgents();
        this.chargerReferentiels();
        this.toast("Agent supprimé");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  // =====================================================================
  //  FONCTIONS
  // =====================================================================
  ouvrirFormFonction(f?: Fonction): void {
    this.fonctionEnEdition = !!f;
    this.fonctionForm = f ? { ...f } : {};
    this.ouvrirModal("modal-fonction");
  }

  enregistrerFonction(): void {
    const libelle = (this.fonctionForm.libelle || "").trim();
    if (!libelle) {
      this.toast("Le libellé est obligatoire", true);
      return;
    }
    const req = this.fonctionEnEdition
      ? this.srv.modifierFonction(this.fonctionForm.id!, libelle)
      : this.srv.creerFonction(libelle);
    req.subscribe({
      next: () => {
        this.fermerModal("modal-fonction");
        this.chargerReferentiels();
        this.toast(
          this.fonctionEnEdition ? "Fonction mise à jour" : "Fonction créée",
        );
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  supprimerFonction(f: Fonction): void {
    if (f.nb_agents > 0) {
      this.toast(
        `Impossible : ${f.nb_agents} agent(s) rattaché(s) à cette fonction`,
        true,
      );
      return;
    }
    if (!confirm(`Supprimer la fonction « ${f.libelle} » ?`)) return;
    this.srv.supprimerFonction(f.id).subscribe({
      next: () => {
        this.chargerReferentiels();
        this.toast("Fonction supprimée");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  // =====================================================================
  //  ORGANISMES
  // =====================================================================
  ouvrirFormOrganisme(o?: Organisme): void {
    this.organismeEnEdition = !!o;
    this.organismeForm = o ? { ...o } : {};
    this.ouvrirModal("modal-organisme");
  }

  enregistrerOrganisme(): void {
    const libelle = (this.organismeForm.libelle || "").trim();
    if (!libelle) {
      this.toast("Le libellé est obligatoire", true);
      return;
    }
    const req = this.organismeEnEdition
      ? this.srv.modifierOrganisme(this.organismeForm as any)
      : this.srv.creerOrganisme(this.organismeForm);
    req.subscribe({
      next: () => {
        this.fermerModal("modal-organisme");
        this.chargerReferentiels();
        this.toast(
          this.organismeEnEdition ? "Organisme mis à jour" : "Organisme créé",
        );
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  supprimerOrganisme(o: Organisme): void {
    if (o.nb_agents > 0) {
      this.toast(
        `Impossible : ${o.nb_agents} agent(s) rattaché(s) à cet organisme`,
        true,
      );
      return;
    }
    if (!confirm(`Supprimer l'organisme « ${o.libelle} » ?`)) return;
    this.srv.supprimerOrganisme(o.id).subscribe({
      next: () => {
        this.chargerReferentiels();
        this.toast("Organisme supprimé");
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
