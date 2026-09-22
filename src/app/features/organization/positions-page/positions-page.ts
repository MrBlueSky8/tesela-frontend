import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import {
  DepartmentResponse,
  JobConditionResponse,
  PositionResponse,
} from '../../../core/models/organization';
import { CompanyScopeService } from '../../../core/services/company-scope-service';
import { DepartmentsDialog } from '../departments-dialog/departments-dialog';
import { OrganizationApiService } from '../organization-api-service';
import { PositionFormDialog } from '../position-form-dialog/position-form-dialog';

type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

/**
 * Catalogo de puestos de la empresa seleccionada. Basado en la maqueta
 * "Perfiles de Puestos", con departamento, estado y filtros reales.
 */
@Component({
  selector: 'app-positions-page',
  imports: [RouterLink, PositionFormDialog, DepartmentsDialog],
  templateUrl: './positions-page.html',
  styleUrl: './positions-page.scss',
})
export class PositionsPage {
  private readonly api = inject(OrganizationApiService);
  private readonly companyScope = inject(CompanyScopeService);

  readonly company = this.companyScope.company;

  readonly positions = signal<PositionResponse[]>([]);
  readonly departments = signal<DepartmentResponse[]>([]);
  readonly conditions = signal<JobConditionResponse[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly search = signal('');
  readonly departmentFilter = signal('');
  readonly statusFilter = signal<StatusFilter>('ACTIVE');

  readonly formOpen = signal(false);
  readonly departmentsOpen = signal(false);


  readonly activePositions = computed(() =>
    this.positions().filter((position) => position.status === 'ACTIVE'),
  );

  readonly stats = computed(() => {
    const active = this.activePositions();
    return {
      total: active.length,
      complete: active.filter((p) => !!p.descripcion && !!p.tareasPrincipales).length,
      evaluated: active.filter((p) => p.evaluado).length,
    };
  });

  readonly filtered = computed(() => {
    const term = normalize(this.search());
    const department = this.departmentFilter();
    const status = this.statusFilter();

    return this.positions().filter(
      (position) =>
        (status === 'ALL' || position.status === status) &&
        (!department || position.departmentPublicId === department) &&
        (!term || normalize(position.nombre).includes(term)),
    );
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

    forkJoin({
      positions: this.api.listPositions(company.publicId),
      departments: this.api.listDepartments(company.publicId),
      conditions: this.api.jobConditions(),
    }).subscribe({
      next: ({ positions, departments, conditions }) => {
        this.positions.set(positions);
        this.departments.set(departments);
        this.conditions.set(conditions);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar el catálogo de puestos.'));
        this.isLoading.set(false);
      },
    });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onDepartmentFilter(event: Event): void {
    this.departmentFilter.set((event.target as HTMLSelectElement).value);
  }

  onStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  clearFilters(): void {
    this.search.set('');
    this.departmentFilter.set('');
    this.statusFilter.set('ACTIVE');
  }

  openNewPosition(): void {
    this.notice.set(null);
    this.formOpen.set(true);
  }

  openDepartments(): void {
    this.notice.set(null);
    this.departmentsOpen.set(true);
  }

  onPositionSaved(position: PositionResponse): void {
    this.positions.update((positions) =>
      [...positions, position].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
    this.notice.set(`Se registró el puesto ${position.nombre}.`);
  }

  /** Crear o editar un departamento, desde el dialogo o desde el alta de puesto. */
  onDepartmentChanged(department: DepartmentResponse): void {
    this.departments.update((departments) => {
      const exists = departments.some((d) => d.publicId === department.publicId);
      const next = exists
        ? departments.map((d) => (d.publicId === department.publicId ? department : d))
        : [...departments, department];
      return next.sort((a, b) => a.nombre.localeCompare(b.nombre));
    });

    // El nombre del departamento se muestra en cada puesto: se refresca sin recargar.
    this.positions.update((positions) =>
      positions.map((position) =>
        position.departmentPublicId === department.publicId
          ? { ...position, departmentName: department.nombre }
          : position,
      ),
    );
  }
}

/** Busqueda sin tildes ni mayusculas: "almacen" encuentra "Almacén". */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}
