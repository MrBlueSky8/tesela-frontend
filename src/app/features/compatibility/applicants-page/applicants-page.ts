import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { ApplicantSummaryResponse } from '../../../core/models/applicant';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { ToastService } from '../../../core/services/toast-service';
import { AddApplicantDialog } from '../add-applicant-dialog/add-applicant-dialog';
import { CompatibilityApiService } from '../compatibility-api-service';

type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

const DOCUMENT_LABELS: Record<string, string> = {
  DNI: 'DNI',
  CE: 'CE',
  PASSPORT: 'Pasaporte',
};

/**
 * Postulantes de la empresa seleccionada. El padrón de personas es global,
 * pero aquí solo aparecen aquellos para los que esta empresa abrió ficha.
 */
@Component({
  selector: 'app-applicants-page',
  imports: [RouterLink, AddApplicantDialog],
  templateUrl: './applicants-page.html',
  styleUrl: './applicants-page.scss',
})
export class ApplicantsPage {
  private readonly api = inject(CompatibilityApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly toast = inject(ToastService);

  readonly company = this.companyContext.company;

  readonly applicants = signal<ApplicantSummaryResponse[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('ACTIVE');
  readonly addOpen = signal(false);

  readonly filters: { value: StatusFilter; label: string }[] = [
    { value: 'ACTIVE', label: 'Activos' },
    { value: 'INACTIVE', label: 'Inactivos' },
    { value: 'ALL', label: 'Todos' },
  ];

  readonly stats = computed(() => {
    const todos = this.applicants();
    return {
      total: todos.filter((applicant) => applicant.estado === 'ACTIVE').length,
      evaluados: todos.filter((applicant) => applicant.fichaEstado === 'VIGENTE').length,
      pendientes: todos.filter((applicant) => applicant.fichaEstado !== 'VIGENTE').length,
    };
  });

  readonly filtered = computed(() => {
    const termino = normalize(this.search());
    const estado = this.statusFilter();

    return this.applicants().filter((applicant) => {
      if (estado !== 'ALL' && applicant.estado !== estado) {
        return false;
      }
      if (!termino) {
        return true;
      }
      const texto = `${applicant.nombres} ${applicant.apellidos} ${applicant.documentNumber} ${applicant.cargoActual ?? ''}`;
      return normalize(texto).includes(termino);
    });
  });

  constructor() {
    this.load();
  }

  load(): void {
    const company = this.company();

    if (!company) {
      this.isLoading.set(false);
      this.loadError.set('No hay una empresa seleccionada.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.list(company.publicId).subscribe({
      next: (applicants) => {
        this.isLoading.set(false);
        this.applicants.set(applicants);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar los postulantes.'));
      },
    });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  onAdded(nombre: string): void {
    this.addOpen.set(false);
    this.toast.success(`${nombre} quedó registrado como postulante de la empresa.`);
    this.load();
  }

  documentLabel(applicant: ApplicantSummaryResponse): string {
    return `${DOCUMENT_LABELS[applicant.documentType] ?? applicant.documentType} ${applicant.documentNumber}`;
  }

  fichaLabel(applicant: ApplicantSummaryResponse): string {
    return applicant.fichaEstado === 'VIGENTE' ? 'Evaluación vigente' : 'Ficha en borrador';
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
