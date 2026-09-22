import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, forkJoin, map } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import {
  DepartmentResponse,
  JobConditionResponse,
  PositionResponse,
} from '../../../core/models/organization';
import { CompanyScopeService } from '../../../core/services/company-scope-service';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { OrganizationApiService } from '../organization-api-service';
import { PositionFormDialog } from '../position-form-dialog/position-form-dialog';

/** Detalle de un puesto del catalogo. Ruta propia: se puede enlazar y recargar. */
@Component({
  selector: 'app-position-detail',
  imports: [RouterLink, PositionFormDialog, ConfirmDialog],
  templateUrl: './position-detail.html',
  styleUrl: './position-detail.scss',
})
export class PositionDetail {
  private readonly api = inject(OrganizationApiService);
  private readonly companyScope = inject(CompanyScopeService);
  private readonly route = inject(ActivatedRoute);

  readonly company = this.companyScope.company;

  private readonly positionId = signal('');

  readonly position = signal<PositionResponse | null>(null);
  readonly departments = signal<DepartmentResponse[]>([]);
  readonly conditions = signal<JobConditionResponse[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly editOpen = signal(false);
  readonly confirmStatus = signal(false);
  readonly statusBusy = signal(false);

  readonly createdAtLabel = computed(() => {
    const createdAt = this.position()?.createdAt;
    return createdAt
      ? new Date(createdAt).toLocaleDateString('es-PE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
  });

  /** Condiciones del puesto agrupadas, con la etiqueta del catalogo. */
  readonly conditionGroups = computed(() => {
    const selected = new Set(this.position()?.condiciones ?? []);
    const chosen = this.conditions().filter((condition) => selected.has(condition.name));

    return [
      { label: 'Modalidad', items: chosen.filter((c) => c.dimension === 'MODALIDAD') },
      { label: 'Entorno', items: chosen.filter((c) => c.dimension === 'ENTORNO') },
    ];
  });

  readonly hasConditions = computed(() => (this.position()?.condiciones.length ?? 0) > 0);

  constructor() {
    // Angular reutiliza el componente si solo cambia el parametro (p. ej. con
    // Atras/Adelante entre dos detalles): hay que recargar en cada cambio.
    this.route.paramMap
      .pipe(
        map((params) => params.get('positionPublicId') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        this.editOpen.set(false);
        this.confirmStatus.set(false);
        this.notice.set(null);
        this.actionError.set(null);
        this.positionId.set(id);
        this.load();
      });
  }

  load(): void {
    const company = this.company();
    const positionId = this.positionId();

    if (!company || !positionId) {
      this.isLoading.set(false);
      this.loadError.set('No hay una empresa seleccionada.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      position: this.api.getPosition(company.publicId, positionId),
      departments: this.api.listDepartments(company.publicId),
      conditions: this.api.jobConditions(),
    }).subscribe({
      next: ({ position, departments, conditions }) => {
        this.position.set(position);
        this.departments.set(departments);
        this.conditions.set(conditions);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar el puesto.'));
        this.isLoading.set(false);
      },
    });
  }

  openEdit(): void {
    this.notice.set(null);
    this.actionError.set(null);
    this.editOpen.set(true);
  }

  onSaved(position: PositionResponse): void {
    this.position.set(position);
    this.notice.set('Los cambios del puesto se guardaron correctamente.');
  }

  onDepartmentCreated(department: DepartmentResponse): void {
    this.departments.update((departments) =>
      [...departments, department].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    );
  }

  askStatusChange(): void {
    this.notice.set(null);
    this.actionError.set(null);
    this.confirmStatus.set(true);
  }

  changeStatus(): void {
    const company = this.company();
    const position = this.position();
    this.confirmStatus.set(false);

    if (!company || !position || this.statusBusy()) {
      return;
    }

    const status = position.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.statusBusy.set(true);

    this.api.updatePosition(company.publicId, position.publicId, { status }).subscribe({
      next: (updated) => {
        this.statusBusy.set(false);
        this.position.set(updated);
        this.notice.set(
          updated.status === 'ACTIVE' ? 'El puesto se reactivó.' : 'El puesto se desactivó.',
        );
      },
      error: (error: unknown) => {
        this.statusBusy.set(false);
        this.actionError.set(
          backendErrorMessage(error, 'No pudimos cambiar el estado del puesto.'),
        );
      },
    });
  }
}
