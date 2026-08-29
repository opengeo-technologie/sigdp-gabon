import {
  Component,
  OnInit,
  Input,
  inject,
  ViewChild,
  ElementRef,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { OperationsService } from "../../services/operations.service";
import {
  Operation,
  OperationDetail,
  Infraction,
  Saisie,
  RefItem,
  LABELS_GRAVITE,
  COULEUR_GRAVITE,
  TYPES_OPERATION,
  RESULTATS_OPERATION,
  TYPES_EMBARCATION,
  POSITIONS_EMBARCATION,
  ACTIVITES_EMBARCATION,
  DOCUMENT_NAVIRE_LOCAL,
  DOCUMENT_NAVIRE_ETRANGER,
} from "../../models/operations.model";

// Réutilise les référentiels existants
import { MissionsService } from "../../services/missions.service";
import { Mission } from "../../models/missions.model";
import { AgentControleService } from "../../services/agent-controle.service";
import { Agent } from "../../models/agents.model";
import { BateauService } from "../../services/bateau.service";
import { DebarcadereService } from "../../services/debarcadere.service";

declare const M: any; // Materialize global

@Component({
  selector: "app-surveillance",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./surveillance.component.html",
  styleUrl: "./surveillance.component.scss",
})
export class SurveillanceComponent {
  @ViewChild("selectBateau") selectBateau!: ElementRef;
  @ViewChild("selectPort") selectPort!: ElementRef;
  private srv = inject(OperationsService);
  private missionsSrv = inject(MissionsService);
  private agentsSrv = inject(AgentControleService);
  private bateauSrv = inject(BateauService);
  private debarcadereSrv = inject(DebarcadereService);

  /** Mission ciblée. Si non fourni, un sélecteur de mission est affiché. */
  @Input() missionId: number | null = null;
  /** Catalogues externes optionnels : si fournis, rendus en <select>. */
  @Input() typesInfraction: RefItem[] = [];
  @Input() bateaux: RefItem[] = [];

  labelGravite = LABELS_GRAVITE;
  couleurGravite = COULEUR_GRAVITE;
  labelsTypeEmbarcation = TYPES_EMBARCATION;
  labelsPositionEmbarcation = POSITIONS_EMBARCATION;
  labelsActiviteEmbarcation = ACTIVITES_EMBARCATION;
  readonly gravites = Object.keys(LABELS_GRAVITE);
  readonly typesOperation = TYPES_OPERATION;
  readonly resultats = RESULTATS_OPERATION;
  readonly typesEmbarcation = Object.keys(TYPES_EMBARCATION);
  readonly positionsEmbarcation = Object.keys(POSITIONS_EMBARCATION);
  readonly activitesEmbarcation = Object.keys(ACTIVITES_EMBARCATION);

  chargement = false;

  // Sélecteur de mission (mode autonome)
  missions: Mission[] = [];
  missionLabel = "";

  // Opérations
  operations: Operation[] = [];
  operationForm: Partial<Operation> = this.nouvelleOperation();
  operationEnEdition = false;
  type_embarcation: string = "";
  saisirEmbarcation: boolean = false;
  selectedPosition: any = null;
  embarcations: any[] = [];
  debarcaderes: any[] = [];

  // Dossier opération
  dossier: OperationDetail | null = null;
  infractionForm: Partial<Infraction> = this.nouvelleInfraction();
  infractionEnEdition = false;

  // Saisies (sous une infraction sélectionnée)
  infractionActive: Infraction | null = null;
  saisies: Saisie[] = [];
  saisieForm: Partial<Saisie> = this.nouvelleSaisie();
  agents: Agent[] = [];

  ngOnInit(): void {
    this.agentsSrv.listerAgents().subscribe((a) => (this.agents = a));
    if (this.missionId) {
      this.chargerOperations();
    } else {
      this.missionsSrv.listerMissions().subscribe((m) => (this.missions = m));
    }
  }

  choisirMission(id: number): void {
    this.missionId = id;
    const m = this.missions.find((x) => x.id === id);
    this.missionLabel = m ? `${m.date_depart} — ${m.lieu_mission || ""}` : "";
    this.chargerOperations();
  }

  // =====================================================================
  //  OPÉRATIONS
  // =====================================================================
  private nouvelleOperation(): Partial<Operation> {
    return {
      date_operation: new Date().toISOString().slice(0, 10),
      type_operation: "inspection",
      resultat: "conforme",
      bateau_pavillon: null,
      bateau_id: 0,
      debarcadere_id: null,
      activite: null,
    };
  }

  chargerOperations(): void {
    if (!this.missionId) return;
    this.chargement = true;
    this.srv.listerOperations(this.missionId).subscribe({
      next: (r) => {
        this.operations = r;
        this.chargement = false;
      },
      error: () => {
        this.chargement = false;
        this.toast("Erreur de chargement des opérations", true);
      },
    });
  }

  ouvrirFormOperation(o?: Operation): void {
    this.operationEnEdition = !!o;
    this.operationForm = o ? { ...o } : this.nouvelleOperation();
    this.ouvrirModal("modal-operation");
  }

  chargerEmbarcations() {
    const filterParams: any = { type_bateau: null };
    filterParams.type_bateau = this.type_embarcation;
    this.bateauSrv.getBateauxDropdown(filterParams).subscribe({
      next: (r) => {
        // console.log(r);
        this.embarcations = r;
        setTimeout(() => {
          M.FormSelect.init(this.selectBateau?.nativeElement);
          this.addSearchBox(this.selectBateau?.nativeElement, "select_bateau");
        }, 500);
      },
      error: () => {
        this.chargement = false;
        this.toast("Erreur de chargement des embarcations", true);
      },
    });
  }

  chargerInfoEmbarcation() {
    if (this.operationForm.bateau_id) {
      this.bateauSrv.getBateau(this.operationForm.bateau_id).subscribe({
        next: (r) => {
          // console.log(r);
          this.operationForm.bateau_nom = r.nom_bateau;
          this.operationForm.bateau_proprietaire =
            r.proprietaire_info?.nom + " " + r.proprietaire_info?.prenom;
          this.operationForm.bateau_immatriculation = r.numero_immatriculation;
          this.operationForm.bateau_immatriculation = r.numero_immatriculation;
        },
        error: () => {
          this.chargement = false;
          this.toast("Erreur de chargement des embarcations", true);
        },
      });
    }
  }

  chargerPositions() {
    if (this.selectedPosition == "debarcadere") {
      this.debarcadereSrv.getDebarcadereList().subscribe({
        next: (r) => {
          // console.log(r);
          this.debarcaderes = r;
          setTimeout(() => {
            M.FormSelect.init(this.selectPort?.nativeElement);
            this.addSearchBox(this.selectPort?.nativeElement, "select_port");
          }, 500);
        },
        error: () => {
          this.chargement = false;
          this.toast("Erreur de chargement des embarcations", true);
        },
      });
    } else {
    }
  }

  selectDebarcadere() {
    let deb = this.debarcaderes.find(
      (d: any) => d.id == this.operationForm.debarcadere_id,
    );

    this.operationForm.lieu_operation = deb.site;
  }

  btnSaisirInfo() {
    this.saisirEmbarcation = true;
    this.operationForm.bateau_immatriculation = "";
    this.operationForm.bateau_nom = "";
    this.operationForm.bateau_proprietaire = "";
  }

  btnCloseSaisirInfo() {
    this.saisirEmbarcation = false;
    this.operationForm.bateau_immatriculation = "";
    this.operationForm.bateau_nom = "";
    this.operationForm.bateau_proprietaire = "";
    this.operationForm.bateau_id = 0;
    setTimeout(() => {
      M.FormSelect.init(this.selectBateau?.nativeElement);
      this.addSearchBox(this.selectBateau?.nativeElement, "select_bateau");
    }, 500);
  }

  enregistrerOperation(): void {
    if (!this.missionId) return;
    const req = this.operationEnEdition
      ? this.srv.modifierOperation(this.operationForm as any)
      : this.srv.creerOperation({
          ...this.operationForm,
          mission_id: this.missionId,
        });
    req.subscribe({
      next: () => {
        this.fermerModal("modal-operation");
        this.chargerOperations();
        this.toast(
          this.operationEnEdition ? "Opération mise à jour" : "Opération créée",
        );
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  supprimerOperation(o: Operation): void {
    if (
      !confirm("Supprimer cette opération ? (infractions et saisies incluses)")
    )
      return;
    this.srv.supprimerOperation(o.id).subscribe({
      next: () => {
        this.chargerOperations();
        this.toast("Opération supprimée");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  // =====================================================================
  //  DOSSIER OPÉRATION : infractions
  // =====================================================================
  ouvrirDossier(o: Operation): void {
    this.infractionForm = this.nouvelleInfraction();
    this.infractionEnEdition = false;
    this.infractionActive = null;
    this.saisies = [];
    this.srv.detailOperation(o.id).subscribe((d) => {
      this.dossier = d;
      this.ouvrirModal("modal-dossier-op");
    });
  }

  private rafraichirDossier(): void {
    if (!this.dossier) return;
    this.srv.detailOperation(this.dossier.id).subscribe((d) => {
      this.dossier = d;
      if (this.infractionActive) {
        this.infractionActive =
          d.infractions.find((x) => x.id === this.infractionActive!.id) || null;
      }
    });
    this.chargerOperations();
  }

  private nouvelleInfraction(): Partial<Infraction> {
    return {
      date_infraction: new Date().toISOString().slice(0, 10),
      gravite_infraction: "majeure",
    };
  }

  editerInfraction(i: Infraction): void {
    this.infractionEnEdition = true;
    this.infractionForm = { ...i };
  }
  annulerEditionInfraction(): void {
    this.infractionEnEdition = false;
    this.infractionForm = this.nouvelleInfraction();
  }
  enregistrerInfraction(): void {
    if (!this.dossier) return;
    const req = this.infractionEnEdition
      ? this.srv.modifierInfraction(this.infractionForm as any)
      : this.srv.creerInfraction({
          ...this.infractionForm,
          operation_id: this.dossier.id,
        });
    req.subscribe({
      next: () => {
        this.annulerEditionInfraction();
        this.rafraichirDossier();
        this.toast("Infraction enregistrée");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }
  supprimerInfraction(i: Infraction): void {
    if (!confirm("Supprimer cette infraction ? (saisies incluses)")) return;
    this.srv.supprimerInfraction(i.id).subscribe({
      next: () => {
        if (this.infractionActive?.id === i.id) this.infractionActive = null;
        this.rafraichirDossier();
        this.toast("Infraction supprimée");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  // =====================================================================
  //  SAISIES (sous une infraction)
  // =====================================================================
  ouvrirSaisies(i: Infraction): void {
    this.infractionActive = i;
    this.saisieForm = this.nouvelleSaisie();
    this.srv.listerSaisies(i.id).subscribe((r) => (this.saisies = r));
  }
  private nouvelleSaisie(): Partial<Saisie> {
    return { date_saisie: new Date().toISOString().slice(0, 10) };
  }
  ajouterSaisie(): void {
    if (!this.infractionActive) return;
    this.srv
      .creerSaisie({
        ...this.saisieForm,
        infraction_id: this.infractionActive.id,
      })
      .subscribe({
        next: () => {
          this.saisieForm = this.nouvelleSaisie();
          this.srv
            .listerSaisies(this.infractionActive!.id)
            .subscribe((r) => (this.saisies = r));
          this.rafraichirDossier();
          this.toast("Saisie ajoutée");
        },
        error: (e) => this.toast(this.messageErreur(e), true),
      });
  }
  supprimerSaisie(s: Saisie): void {
    this.srv.supprimerSaisie(s.id).subscribe({
      next: () => {
        this.srv
          .listerSaisies(this.infractionActive!.id)
          .subscribe((r) => (this.saisies = r));
        this.rafraichirDossier();
        this.toast("Saisie supprimée");
      },
      error: (e) => this.toast(this.messageErreur(e), true),
    });
  }

  // Libellés catalogue (si fournis)
  libelleType(id?: number | null): string {
    const t = this.typesInfraction.find((x) => x.id === id);
    return t ? t.libelle : id != null ? `#${id}` : "—";
  }
  libelleBateau(id?: number | null): string {
    const b = this.bateaux.find((x) => x.id === id);
    return b ? b.libelle : id != null ? `#${id}` : "—";
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

  addSearchBox(element: HTMLSelectElement, id_select: string) {
    if (!element) return;

    const instance2 = M.FormSelect.getInstance(element);
    if (!instance2) return;

    // Get the dropdown UL directly from the instance — version-safe-ish
    const dropdownContent: HTMLElement =
      instance2.dropdown?.dropdownEl ||
      instance2.dropdownEl || // some versions expose it directly on the instance
      null;

    if (!dropdownContent) {
      console.warn("Could not resolve dropdownEl for", id_select);
      return;
    }

    // Avoid inserting duplicate search inputs on repeated calls
    const existing = dropdownContent.querySelector(".search-input");
    if (existing) existing.remove();

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Rechercher...";
    searchInput.classList.add("browser-default", "search-input");
    searchInput.style.margin = "8px";
    searchInput.style.width = "90%";
    searchInput.style.boxSizing = "border-box";

    ["mousedown", "click"].forEach((evt) => {
      searchInput.addEventListener(evt, (event) => {
        event.stopPropagation();
        event.preventDefault();
      });
    });

    dropdownContent.insertBefore(searchInput, dropdownContent.firstChild);

    searchInput.addEventListener("keyup", () => {
      const filter = searchInput.value.toLowerCase();
      const items = dropdownContent.querySelectorAll("li > span");
      items.forEach((item: any) => {
        const text = item.textContent.toLowerCase();
        (item.parentElement as HTMLElement).style.display = text.includes(
          filter,
        )
          ? ""
          : "none";
      });
    });

    const instance = M.FormSelect.getInstance(element);
    if (instance && instance.dropdown) {
      instance.dropdown.options.onOpenStart = () => {
        searchInput.value = "";
        dropdownContent.querySelectorAll("li").forEach((li: HTMLElement) => {
          li.style.display = "";
        });
        setTimeout(() => searchInput.focus(), 200);
      };
    }
  }
}
