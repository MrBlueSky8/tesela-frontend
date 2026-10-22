import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { PositionResponse } from '../../../core/models/organization';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { OrganizationApiService } from '../../organization/organization-api-service';

type EvaluationFilter = 'ALL' | 'SIN_EVALUAR' | 'BORRADOR' | 'VIGENTE';

/**
 * Catalogo de puestos visto desde el modulo: solo lectura, con el estado de
 * su evaluacion y el acceso a evaluarlos.
 *
 * <p>El Anexo 1 lo dice asi: el evaluador consulta el catalogo empresarial de
 * puestos, pero no lo edita. Crear o cambiar puestos sigue siendo cosa de la
 * gestion de la empresa.
 */
@Component({
  selector: 'app-module-positions-page',
  imports: [RouterLink],
  templateUrl: './module-positions-page.html',
  styleUrl: './module-positions-page.scss',
})
export class ModulePositionsPage {
  private readonly api = inject(OrganizationApiService);
  private readonly companyContext = inject(CompanyContextService);

  readonly company = this.companyContext.company;

  readonly positions = signal<PositionResponse[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly search = signal('');
  readonly filter = signal<EvaluationFilter>('ALL');

  readonly filters: { value: EvaluationFilter; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'SIN_EVALUAR', label: 'Sin evaluar' },
    { value: 'BORRADOR', label: 'En borrador' },
    { value: 'VIGENTE', label: 'Con evaluación vigente' },
  ];

  readonly activos = computed(() =>
    this.positions().filter((position) => position.status === 'ACTIVE'),
  );

  readonly stats = computed(() => {
    const activos = this.activos();
    return {
      total: activos.length,
      evaluados: activos.filter((position) => position.evaluado).length,
      borradores: activos.filter((position) => position.enBorrador).length,
    };
  });

  readonly filtered = computed(() => {
    const termino = normalize(this.search());
    const estado = this.filter();

    return this.activos().filter((position) => {
      if (estado === 'VIGENTE' && !position.evaluado) {
        return false;
      }
      if (estado === 'BORRADOR' && !position.enBorrador) {
        return false;
      }
      if (estado === 'SIN_EVALUAR' && (position.evaluado || position.enBorrador)) {
        return false;
      }
      if (!termino) {
        return true;
      }
      return normalize(`${position.nombre} ${position.departmentName}`).includes(termino);
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

    this.api.listPositions(company.publicId).subscribe({
      next: (positions) => {
        this.isLoading.set(false);
        this.positions.set(positions);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar el catálogo de puestos.'));
      },
    });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onFilter(event: Event): void {
    this.filter.set((event.target as HTMLSelectElement).value as EvaluationFilter);
  }

  estadoLabel(position: PositionResponse): string {
    if (position.evaluado) {
      return 'Evaluación vigente';
    }
    return position.enBorrador ? 'Evaluación en borrador' : 'Sin evaluar';
  }
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
