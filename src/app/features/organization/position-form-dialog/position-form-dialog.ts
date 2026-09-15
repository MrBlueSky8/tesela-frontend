import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { controlErrorMessage } from '../../../core/helpers/form-error-message';
import {
  DepartmentResponse,
  JobConditionCode,
  JobConditionResponse,
  PositionResponse,
  UpdatePositionRequest,
} from '../../../core/models/organization';
import { ModalShell } from '../../../shared/components/modal-shell/modal-shell';
import { OrganizationApiService } from '../organization-api-service';

/** Limites de CreatePositionRequest / UpdatePositionRequest. */
const NAME_MAX = 200;
const TEXT_MAX = 4000;

type Field = 'nombre' | 'departmentPublicId' | 'descripcion' | 'tareasPrincipales';

/**
 * Alta y edicion de un puesto del catalogo. Parte de la maqueta "Perfiles de
 * Puestos" y agrega lo que el modelo exige: departamento y condiciones.
 */
@Component({
  selector: 'app-position-form-dialog',
  imports: [ReactiveFormsModule, ModalShell],
  templateUrl: './position-form-dialog.html',
  styleUrl: './position-form-dialog.scss',
})
export class PositionFormDialog implements OnInit {
  private readonly api = inject(OrganizationApiService);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);

  private readonly newDepartmentInput =
    viewChild<ElementRef<HTMLInputElement>>('newDepartmentInput');
  private readonly departmentSelect = viewChild<ElementRef<HTMLSelectElement>>('departmentSelect');

  readonly companyPublicId = input.required<string>();
  readonly departments = input.required<DepartmentResponse[]>();
  readonly conditions = input.required<JobConditionResponse[]>();
  /** null para registrar un puesto nuevo. */
  readonly position = input<PositionResponse | null>(null);

  readonly saved = output<PositionResponse>();
  readonly departmentCreated = output<DepartmentResponse>();
  readonly closed = output<void>();

  readonly nameMax = NAME_MAX;
  readonly textMax = TEXT_MAX;

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(NAME_MAX)]],
    departmentPublicId: ['', [Validators.required]],
    descripcion: ['', [Validators.maxLength(TEXT_MAX)]],
    tareasPrincipales: ['', [Validators.maxLength(TEXT_MAX)]],
  });

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly selectedConditions = signal<JobConditionCode[]>([]);

  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);
  readonly serverFieldErrors = signal<Partial<Record<Field, string>>>({});

  // ---- Departamento en linea
  readonly creatingDepartment = signal(false);
  readonly newDepartmentName = this.fb.nonNullable.control('', [
    Validators.required,
    Validators.maxLength(150),
  ]);
  readonly departmentBusy = signal(false);
  readonly departmentError = signal<string | null>(null);

  readonly isEdit = computed(() => !!this.position());

  /**
   * Activos, mas el actual del puesto si hoy esta inactivo: se puede conservar
   * al editar otros campos, pero no elegir para un puesto nuevo.
   */
  readonly departmentOptions = computed(() => {
    const current = this.position()?.departmentPublicId;
    return this.departments().filter(
      (department) => department.status === 'ACTIVE' || department.publicId === current,
    );
  });

  readonly modalidad = computed(() =>
    this.conditions().filter((condition) => condition.dimension === 'MODALIDAD'),
  );
  readonly entorno = computed(() =>
    this.conditions().filter((condition) => condition.dimension === 'ENTORNO'),
  );

  readonly selectedDepartmentInactive = computed(() => {
    const id = this.formValue().departmentPublicId;
    return this.departments().some((d) => d.publicId === id && d.status === 'INACTIVE');
  });

  readonly changes = computed<UpdatePositionRequest>(() => {
    this.formValue();
    const position = this.position();
    const value = this.form.getRawValue();

    if (!position) {
      return {};
    }

    const request: UpdatePositionRequest = {};
    if (value.nombre.trim() !== position.nombre) request.nombre = value.nombre.trim();
    if (value.departmentPublicId !== position.departmentPublicId) {
      request.departmentPublicId = value.departmentPublicId;
    }
    if (value.descripcion.trim() !== (position.descripcion ?? '')) {
      request.descripcion = value.descripcion.trim();
    }
    if (value.tareasPrincipales.trim() !== (position.tareasPrincipales ?? '')) {
      request.tareasPrincipales = value.tareasPrincipales.trim();
    }
    if (!sameCodes(this.selectedConditions(), position.condiciones)) {
      request.condiciones = this.orderedConditions();
    }
    return request;
  });

  readonly canSave = computed(() => !this.isEdit() || Object.keys(this.changes()).length > 0);

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (Object.keys(this.serverFieldErrors()).length) {
        this.serverFieldErrors.set({});
      }
    });
  }

  ngOnInit(): void {
    const position = this.position();

    if (position) {
      this.form.reset({
        nombre: position.nombre,
        departmentPublicId: position.departmentPublicId,
        descripcion: position.descripcion ?? '',
        tareasPrincipales: position.tareasPrincipales ?? '',
      });
      this.selectedConditions.set([...position.condiciones]);
    } else {
      // Con un solo departamento activo no hay nada que elegir.
      const active = this.departments().filter((d) => d.status === 'ACTIVE');
      if (active.length === 1) {
        this.form.controls.departmentPublicId.setValue(active[0].publicId);
      }
    }
  }

  fieldError(field: Field): string | null {
    return controlErrorMessage(this.form.controls[field], this.serverFieldErrors()[field]);
  }

  length(field: 'descripcion' | 'tareasPrincipales'): number {
    return (this.formValue()[field] ?? '').length;
  }

  isConditionSelected(code: JobConditionCode): boolean {
    return this.selectedConditions().includes(code);
  }

  toggleCondition(code: JobConditionCode, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedConditions.update((current) =>
      checked ? [...new Set([...current, code])] : current.filter((c) => c !== code),
    );
  }

  // ---------------------------------------------------------------- Departamento en linea

  startNewDepartment(): void {
    this.creatingDepartment.set(true);
    this.departmentError.set(null);
    this.newDepartmentName.reset('');
    afterNextRender(() => this.newDepartmentInput()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  cancelNewDepartment(): void {
    this.creatingDepartment.set(false);
    this.departmentError.set(null);
    afterNextRender(() => this.departmentSelect()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  createDepartment(): void {
    if (this.departmentBusy()) {
      return;
    }
    if (this.newDepartmentName.invalid) {
      this.newDepartmentName.markAsTouched();
      this.departmentError.set('Escribe el nombre del departamento.');
      return;
    }

    this.departmentBusy.set(true);
    this.departmentError.set(null);

    this.api
      .createDepartment(this.companyPublicId(), { nombre: this.newDepartmentName.value.trim() })
      .subscribe({
        next: (department) => {
          this.departmentBusy.set(false);
          this.departmentCreated.emit(department);
          this.form.controls.departmentPublicId.setValue(department.publicId);
          this.cancelNewDepartment();
        },
        error: (error: unknown) => {
          this.departmentBusy.set(false);
          this.departmentError.set(backendErrorMessage(error, 'No pudimos crear el departamento.'));
        },
      });
  }

  // ---------------------------------------------------------------- Guardar

  onSubmit(): void {
    if (this.isSaving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados.');
      return;
    }

    const position = this.position();
    const value = this.form.getRawValue();

    const request = position
      ? this.api.updatePosition(this.companyPublicId(), position.publicId, this.changes())
      : this.api.createPosition(this.companyPublicId(), {
          departmentPublicId: value.departmentPublicId,
          nombre: value.nombre.trim(),
          // Vacio no se envia: el backend lo guarda como ausente.
          ...(value.descripcion.trim() ? { descripcion: value.descripcion.trim() } : {}),
          ...(value.tareasPrincipales.trim()
            ? { tareasPrincipales: value.tareasPrincipales.trim() }
            : {}),
          condiciones: this.orderedConditions(),
        });

    this.isSaving.set(true);
    this.error.set(null);

    request.subscribe({
      next: (result) => {
        this.isSaving.set(false);
        this.saved.emit(result);
        this.closed.emit();
      },
      error: (error: unknown) => {
        this.isSaving.set(false);

        // 409 del backend = nombre repetido en ese departamento: se muestra en el campo.
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.serverFieldErrors.set({ nombre: backendErrorMessage(error) });
          this.form.controls.nombre.markAsTouched();
          this.error.set(null);
          return;
        }
        this.error.set(backendErrorMessage(error, 'No pudimos guardar el puesto.'));
      },
    });
  }

  /** En el orden del catalogo, para que la peticion sea estable. */
  private orderedConditions(): JobConditionCode[] {
    const selected = new Set(this.selectedConditions());
    return this.conditions()
      .map((condition) => condition.name)
      .filter((code) => selected.has(code));
  }
}

function sameCodes(a: readonly JobConditionCode[], b: readonly JobConditionCode[]): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((code) => right.has(code));
}
