import { Component, DestroyRef, inject, signal } from '@angular/core';
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
 * cambia al entrar aqui. Para eso esta el boton "Entrar a esta empresa".
 */
@Component({
  selector: 'app-company-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './company-admin-shell.html',
  styleUrl: './company-admin-shell.scss',
})
export class CompanyAdminShell {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly companyContext = inject(CompanyContextService);
  private readonly destroyRef = inject(DestroyRef);

  readonly scope = inject(CompanyScopeService);

  readonly company = this.scope.company;
  readonly isLoading = this.scope.isLoading;
  readonly loadError = this.scope.loadError;
  readonly activeCompany = this.scope.activeCompany;

  readonly isEntering = signal(false);
  readonly enterError = signal<string | null>(null);

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

  /** Cambia la empresa de trabajo del usuario a la que esta administrando. */
  enterCompany(): void {
    const company = this.company();

    if (!company || this.isEntering()) {
      return;
    }

    this.isEntering.set(true);
    this.enterError.set(null);

    this.companyContext.select(company).subscribe({
      next: () => {
        this.isEntering.set(false);
        this.companyContext.justSwitchedTo.set(company.nombre);
        void this.router.navigate(['/home']);
      },
      error: (error: unknown) => {
        this.isEntering.set(false);
        this.enterError.set(backendErrorMessage(error, 'No pudimos entrar a esta empresa.'));
      },
    });
  }
}
