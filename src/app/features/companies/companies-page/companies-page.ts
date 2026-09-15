import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { CompanyResponse } from '../../../core/models/company';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { TokenService } from '../../../core/services/token-service';
import { CompanyApiService } from '../company-api-service';

/**
 * Listado de empresas y punto de seleccion del contexto.
 * Un USUARIO ve solo sus empresas activas; ADMIN_PLATAFORMA ve todas y puede
 * dar de alta nuevas. En ambos casos, elegir una fija el contexto de trabajo.
 */
@Component({
  selector: 'app-companies-page',
  imports: [RouterLink],
  templateUrl: './companies-page.html',
  styleUrl: './companies-page.scss',
})
export class CompaniesPage {
  private readonly companyApi = inject(CompanyApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  readonly isPlatformAdmin = computed(() => this.tokenService.role() === 'ADMIN_PLATAFORMA');

  readonly companies = signal<CompanyResponse[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly selectError = signal<string | null>(null);

  /** publicId de la empresa que se esta seleccionando, para bloquear dobles clics. */
  readonly selectingId = signal<string | null>(null);

  readonly search = signal('');

  /** Nombre de la empresa recien creada, llega por `history.state` desde el alta. */
  readonly createdName = signal<string | null>(
    (history.state as { createdCompany?: string } | null)?.createdCompany ?? null,
  );

  readonly currentCompanyId = computed(() => this.companyContext.company()?.publicId ?? null);

  readonly filteredCompanies = computed(() => {
    const term = this.search().trim().toLowerCase();

    if (!term) {
      return this.companies();
    }

    return this.companies().filter((company) =>
      [company.nombre, company.razonSocial, company.ruc].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  });

  constructor() {
    // El aviso de alta se muestra una sola vez: recargar no debe repetirlo.
    if (this.createdName()) {
      history.replaceState({ ...history.state, createdCompany: undefined }, '');
    }

    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.companyApi.list().subscribe({
      next: (companies) => {
        this.companies.set(companies);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar las empresas.'));
        this.isLoading.set(false);
      },
    });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  selectCompany(company: CompanyResponse): void {
    if (this.selectingId()) {
      return;
    }

    this.selectingId.set(company.publicId);
    this.selectError.set(null);

    this.companyContext.select(company).subscribe({
      next: () => {
        this.selectingId.set(null);
        void this.router.navigate(['/home']);
      },
      error: (error: unknown) => {
        this.selectingId.set(null);
        this.selectError.set(
          backendErrorMessage(error, 'No pudimos acceder a la empresa seleccionada.'),
        );
      },
    });
  }

  initial(company: CompanyResponse): string {
    return company.nombre.trim().charAt(0).toUpperCase();
  }
}
