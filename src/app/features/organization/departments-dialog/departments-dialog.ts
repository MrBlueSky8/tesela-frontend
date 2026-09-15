import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import {
  DepartmentResponse,
  PositionResponse,
  UpdateDepartmentRequest,
} from '../../../core/models/organization';
import { ModalShell } from '../../../shared/components/modal-shell/modal-shell';
import { OrganizationApiService } from '../organization-api-service';

/**
 * Gestion de departamentos desde el catalogo de puestos: crear, editar y
 * desactivar o reactivar. No se eliminan: conservan el historial de sus puestos.
 *
 * <p>Las confirmaciones van en linea dentro de la fila en vez de abrir otro
 * modal encima: dos trampas de foco anidadas se pelean por el Tab.
 */
@Component({
  selector: 'app-departments-dialog',
  imports: [ReactiveFormsModule, ModalShell],
  templateUrl: './departments-dialog.html',
  styleUrl: './departments-dialog.scss',
})
export class DepartmentsDialog {
  private readonly api = inject(OrganizationApiService);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly editNameInput = viewChild<ElementRef<HTMLInputElement>>('editNameInput');

  readonly companyPublicId = input.required<string>();
  readonly departments = input.required<DepartmentResponse[]>();
  readonly positions = input.required<PositionResponse[]>();

  readonly changed = output<DepartmentResponse>();
  readonly closed = output<void>();

  readonly createForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: ['', [Validators.maxLength(500)]],
  });
  readonly createBusy = signal(false);
  readonly createError = signal<string | null>(null);

  readonly editForm = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: ['', [Validators.maxLength(500)]],
  });
  readonly editingId = signal<string | null>(null);
  readonly confirmingId = signal<string | null>(null);
  readonly rowBusyId = signal<string | null>(null);
  readonly rowError = signal<{ id: string; message: string } | null>(null);
  readonly notice = signal<string | null>(null);

  /** Activos primero, luego por nombre. */
  readonly sorted = computed(() =>
    [...this.departments()].sort(
      (a, b) =>
        Number(a.status !== 'ACTIVE') - Number(b.status !== 'ACTIVE') ||
        a.nombre.localeCompare(b.nombre),
    ),
  );

  readonly activePositionCount = computed(() => {
    const counts = new Map<string, number>();
    for (const position of this.positions()) {
      if (position.status === 'ACTIVE') {
        counts.set(position.departmentPublicId, (counts.get(position.departmentPublicId) ?? 0) + 1);
      }
    }
    return counts;
  });

  countFor(department: DepartmentResponse): number {
    return this.activePositionCount().get(department.publicId) ?? 0;
  }

  rowErrorFor(department: DepartmentResponse): string | null {
    const error = this.rowError();
    return error?.id === department.publicId ? error.message : null;
  }

  // ---------------------------------------------------------------- Crear

  onCreate(): void {
    if (this.createBusy()) {
      return;
    }
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.createError.set('Escribe el nombre del departamento.');
      return;
    }

    const value = this.createForm.getRawValue();
    this.createBusy.set(true);
    this.createError.set(null);
    this.notice.set(null);

    this.api
      .createDepartment(this.companyPublicId(), {
        nombre: value.nombre.trim(),
        ...(value.descripcion.trim() ? { descripcion: value.descripcion.trim() } : {}),
      })
      .subscribe({
        next: (department) => {
          this.createBusy.set(false);
          this.createForm.reset({ nombre: '', descripcion: '' });
          this.notice.set(`Se creo el departamento ${department.nombre}.`);
          this.changed.emit(department);
        },
        error: (error: unknown) => {
          this.createBusy.set(false);
          this.createError.set(backendErrorMessage(error, 'No pudimos crear el departamento.'));
        },
      });
  }

  // ---------------------------------------------------------------- Editar

  startEdit(department: DepartmentResponse): void {
    this.confirmingId.set(null);
    this.rowError.set(null);
    this.editForm.reset({ nombre: department.nombre, descripcion: department.descripcion ?? '' });
    this.editingId.set(department.publicId);
    afterNextRender(() => this.editNameInput()?.nativeElement.focus(), { injector: this.injector });
  }

  cancelEdit(department: DepartmentResponse): void {
    this.editingId.set(null);
    this.focusRowAction(department, 'edit');
  }

  saveEdit(department: DepartmentResponse): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.rowError.set({ id: department.publicId, message: 'El nombre es obligatorio.' });
      return;
    }

    const value = this.editForm.getRawValue();
    const payload: UpdateDepartmentRequest = {};
    if (value.nombre.trim() !== department.nombre) payload.nombre = value.nombre.trim();
    if (value.descripcion.trim() !== (department.descripcion ?? '')) {
      payload.descripcion = value.descripcion.trim();
    }

    if (!Object.keys(payload).length) {
      this.cancelEdit(department);
      return;
    }

    this.update(department, payload, () => {
      this.editingId.set(null);
      this.focusRowAction(department, 'edit');
    });
  }

  // ---------------------------------------------------------------- Estado

  askDeactivate(department: DepartmentResponse): void {
    this.editingId.set(null);
    this.rowError.set(null);
    this.confirmingId.set(department.publicId);
    this.focusRowAction(department, 'confirm');
  }

  cancelDeactivate(department: DepartmentResponse): void {
    this.confirmingId.set(null);
    this.focusRowAction(department, 'status');
  }

  setStatus(department: DepartmentResponse, status: 'ACTIVE' | 'INACTIVE'): void {
    this.update(department, { status }, () => {
      this.confirmingId.set(null);
      this.focusRowAction(department, 'status');
    });
  }

  private update(
    department: DepartmentResponse,
    payload: UpdateDepartmentRequest,
    onSuccess: () => void,
  ): void {
    this.rowBusyId.set(department.publicId);
    this.rowError.set(null);
    this.notice.set(null);

    this.api.updateDepartment(this.companyPublicId(), department.publicId, payload).subscribe({
      next: (updated) => {
        this.rowBusyId.set(null);
        this.changed.emit(updated);
        onSuccess();
      },
      error: (error: unknown) => {
        this.rowBusyId.set(null);
        const fallback = 'No pudimos actualizar el departamento.';
        this.rowError.set({
          id: department.publicId,
          message:
            error instanceof HttpErrorResponse && error.status === 409
              ? backendErrorMessage(error, 'Ya existe un departamento con ese nombre.')
              : backendErrorMessage(error, fallback),
        });
      },
    });
  }

  /** La fila cambia de vista: el foco va al control equivalente para no perderse. */
  private focusRowAction(
    department: DepartmentResponse,
    action: 'edit' | 'status' | 'confirm',
  ): void {
    afterNextRender(
      () => {
        this.host.nativeElement
          .querySelector<HTMLElement>(
            `[data-dept="${department.publicId}"][data-action="${action}"]`,
          )
          ?.focus();
      },
      { injector: this.injector },
    );
  }
}
