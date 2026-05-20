import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
} from "@angular/core";
import { Subject } from "rxjs";
import { takeUntil, distinctUntilChanged } from "rxjs/operators";
import { AuthService } from "../services/auth.service";

@Directive({
  selector: "[appHasPermission]",
  standalone: true,
})
export class HasPermissionDirective implements OnInit, OnDestroy {
  private permissions: string[] = [];
  private requireAll = false;
  private destroy$ = new Subject<void>();
  private hasView = false;

  @Input()
  set appHasPermission(value: string | string[]) {
    this.permissions = Array.isArray(value) ? value : [value];
    this.updateView();
  }

  @Input()
  set appHasPermissionRequireAll(value: boolean) {
    this.requireAll = value;
    this.updateView();
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    // S'abonner aux changements d'utilisateur
    this.authService.currentUser$
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged(), // ✅ Éviter les duplications
      )
      .subscribe(() => {
        this.updateView();
      });

    // Vérification initiale
    this.updateView();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateView() {
    const hasPermission = this.checkPermission();

    if (hasPermission && !this.hasView) {
      // Créer la vue seulement si elle n'existe pas
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
      this.cdr.markForCheck();
    } else if (!hasPermission && this.hasView) {
      // Supprimer la vue seulement si elle existe
      this.viewContainer.clear();
      this.hasView = false;
      this.cdr.markForCheck();
    }
  }

  private checkPermission(): boolean {
    const user = this.authService.currentUserValue;

    if (!user) {
      return false;
    }

    if (!this.permissions || this.permissions.length === 0) {
      return false;
    }

    return this.requireAll
      ? this.authService.hasAllPermissions(...this.permissions)
      : this.authService.hasAnyPermission(...this.permissions);
  }
}
