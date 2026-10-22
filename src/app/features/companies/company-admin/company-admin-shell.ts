import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { CompanyScopeService } from '../../../core/services/company-scope-service';

/**
 * Ficha de una empresa para Fundades: cabecera con la empresa administrada y
 * pestanias hacia sus datos, usuarios, puestos y sedes.
 *
 * <p>Administrar no es lo mismo que trabajar: la empresa activa del usuario no
 * cambia al entrar aqui. El boton "Abrir espacio de trabajo" hace explicito el
 * cambio y lleva al inicio del contexto seleccionado.
 */
@Component({
  selector: 'app-company-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './company-admin-shell.html',
  styleUrl: './company-admin-shell.scss',
})
export class CompanyAdminShell {
  private readonly route = inject(ActivatedRoute);
  private readonly companyContext = inject(CompanyContextService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  readonly scope = inject(CompanyScopeService);

  readonly company = this.scope.company;
  readonly isLoading = this.scope.isLoading;
  readonly loadError = this.scope.loadError;
  readonly activeCompany = this.scope.activeCompany;

  readonly isEntering = signal(false);
  readonly enterError = signal<string | null>(null);

  /** La empresa administrada ya es la empresa de trabajo del usuario. */
  readonly isActiveCompany = computed(
    () => !!this.company() && this.activeCompany()?.publicId === this.company()?.publicId,
  );

  constructor() {
    // Ir de una empresa a otra reutiliza el componente: hay que recargar.
    this.route.paramMap
      .pipe(
        map((params) => params.get('companyPublicId')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((companyPublicId) => {
        if (companyPublicId) {
          this.scope.useCompany(companyPublicId);
        }
      });
  }

  /**
   * Hace de la empresa administrada la empresa de trabajo del usuario y abre su
   * inicio. Asi la ficha administrativa y el alcance operativo no se mezclan.
   */
  enterCompany(): void {
    const company = this.company();

    if (!company || this.isEntering() || this.isActiveCompany()) {
      return;
    }

    this.isEntering.set(true);
    this.enterError.set(null);

    this.companyContext.select(company).subscribe({
      next: () => {
        this.isEntering.set(false);
        void this.router.navigate(['/home']);
      },
      error: (error: unknown) => {
        this.isEntering.set(false);
        this.enterError.set(backendErrorMessage(error, 'No pudimos entrar a esta empresa.'));
      },
    });
  }
}
