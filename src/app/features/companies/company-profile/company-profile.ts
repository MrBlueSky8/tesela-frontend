import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import {
  backendErrorMessage,
  backendFieldErrors,
} from '../../../core/helpers/backend-error-message';
import { controlErrorMessage } from '../../../core/helpers/form-error-message';
import { transientMessage } from '../../../core/helpers/transient-message';
import { CompanyResponse, UpdateCompanyRequest } from '../../../core/models/company';
import { CompanyScopeService } from '../../../core/services/company-scope-service';
import { TokenService } from '../../../core/services/token-service';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { CompanyApiService } from '../company-api-service';
import { COMPANY_FIELD_LIMITS, CompanyLimitedField } from '../company-field-limits';

type ProfileField = keyof Required<UpdateCompanyRequest>;

/** Mismas reglas que GoogleCloudStorageService: se validan antes de subir nada. */
const LOGO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const LOGO_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const LOGO_MAX_BYTES = 5 * 1024 * 1024;

/** Campos de texto del PATCH; `numeroEmpleados` se trata aparte por ser numerico. */
const TEXT_FIELDS = [
  'nombre',
  'razonSocial',
  'descripcion',
  'direccion',
  'telefonoContacto',
  'emailContacto',
  'urlWeb',
] as const;

type PendingConfirm = 'remove-logo' | 'toggle-status';

/**
 * "Mi empresa": datos generales y logo de la empresa seleccionada.
 * La ruta exige ADMIN_GENERAL; el administrador de plataforma ve ademas el
 * limite de administradores y el estado.
 */
@Component({
  selector: 'app-company-profile',
  imports: [ReactiveFormsModule, ConfirmDialog],
  templateUrl: './company-profile.html',
  styleUrl: './company-profile.scss',
})
export class CompanyProfile {
  private readonly fb = inject(FormBuilder);
  private readonly companyApi = inject(CompanyApiService);
  private readonly companyScope = inject(CompanyScopeService);
  private readonly tokenService = inject(TokenService);

  private readonly injector = inject(Injector);

  private readonly logoInput = viewChild<ElementRef<HTMLInputElement>>('logoInput');
  private readonly logoUploadButton = viewChild<ElementRef<HTMLButtonElement>>('logoUploadButton');

  readonly acceptedLogoTypes = LOGO_MIME_TYPES.join(',');
  readonly isPlatformAdmin = computed(() => this.tokenService.role() === 'ADMIN_PLATAFORMA');

  readonly isAdminScope = this.companyScope.isAdminScope;

  readonly company = signal<CompanyResponse | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  // ---- Datos
  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  // Confirmacion: se borra sola a los pocos segundos.
  readonly saveSuccess = transientMessage();
  readonly serverFieldErrors = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(COMPANY_FIELD_LIMITS.nombre)]],
    razonSocial: ['', [Validators.required, Validators.maxLength(COMPANY_FIELD_LIMITS.razonSocial)]],
    descripcion: ['', [Validators.required, Validators.maxLength(COMPANY_FIELD_LIMITS.descripcion)]],
    direccion: ['', [Validators.required, Validators.maxLength(COMPANY_FIELD_LIMITS.direccion)]],
    // Opcionales: vacio equivale a "sin dato", como en el backend.
    telefonoContacto: ['', [Validators.pattern(/^$|^[0-9+() -]{6,15}$/)]],
    emailContacto: ['', [Validators.required, Validators.email, Validators.maxLength(COMPANY_FIELD_LIMITS.emailContacto)]],
    urlWeb: ['', [Validators.maxLength(COMPANY_FIELD_LIMITS.urlWeb)]],
    numeroEmpleados: [null as number | null, [Validators.min(0)]],
  });

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /** Solo lo que difiere de lo guardado: el PATCH nunca reenvia campos sin tocar. */
  readonly changes = computed<UpdateCompanyRequest>(() => {
    this.formValue();
    const company = this.company();
    return company ? this.diff(company) : {};
  });

  readonly hasChanges = computed(() => Object.keys(this.changes()).length > 0);

  // ---- Logo
  readonly logoBusy = signal(false);
  readonly logoError = signal<string | null>(null);

  // ---- Plataforma
  readonly adminLimitControl = this.fb.control<number | null>(null, [
    Validators.required,
    Validators.min(1),
  ]);
  readonly adminLimitBusy = signal(false);
  readonly adminLimitError = signal<string | null>(null);
  readonly statusBusy = signal(false);
  readonly platformError = signal<string | null>(null);
  readonly platformSuccess = transientMessage();

  readonly pendingConfirm = signal<PendingConfirm | null>(null);

  readonly companyInitial = computed(
    () => this.company()?.nombre.trim().charAt(0).toUpperCase() ?? '',
  );

  readonly createdAtLabel = computed(() => {
    const createdAt = this.company()?.createdAt;
    return createdAt
      ? new Date(createdAt).toLocaleDateString('es-PE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';
  });

  constructor() {
    // Un error del servidor describe el valor que se envio: al editar deja de aplicar.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (Object.keys(this.serverFieldErrors()).length) {
        this.serverFieldErrors.set({});
      }
    });

    this.adminLimitControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.adminLimitError.set(null));

    this.load();
  }

  load(): void {
    const selected = this.companyScope.company();

    if (!selected) {
      // El guard de la ruta lo impide; queda como defensa.
      this.isLoading.set(false);
      this.loadError.set('No hay una empresa seleccionada.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    // Se relee la empresa: el contexto pudo cargarse hace rato y editar sobre datos viejos confunde.
    this.companyApi.get(selected.publicId).subscribe({
      next: (company) => {
        this.applyCompany(company);
        this.resetForm(company);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar la empresa.'));
        this.isLoading.set(false);
      },
    });
  }

  // ---------------------------------------------------------------- Datos

  readonly limits = COMPANY_FIELD_LIMITS;

  /** "123/500" bajo un campo con maximo, para no descubrirlo al guardar. */
  counter(field: CompanyLimitedField): string {
    return `${this.lengthOf(field)}/${COMPANY_FIELD_LIMITS[field]}`;
  }

  counterIsFull(field: CompanyLimitedField): boolean {
    return this.lengthOf(field) >= COMPANY_FIELD_LIMITS[field];
  }

  private lengthOf(field: CompanyLimitedField): number {
    // Se lee del signal para recalcular con cada tecla.
    const value = (this.formValue() as Record<string, unknown>)[field];
    return typeof value === 'string' ? value.length : 0;
  }

  fieldError(field: ProfileField): string | null {
    return controlErrorMessage(this.form.controls[field], this.serverFieldErrors()[field]);
  }

  onSave(): void {
    const company = this.company();

    if (!company || this.isSaving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saveError.set('Revisa los campos marcados.');
      return;
    }

    const payload = this.changes();

    if (!Object.keys(payload).length) {
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(null);
    this.serverFieldErrors.set({});

    this.companyApi.update(company.publicId, payload).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.applyCompany(updated);
        this.resetForm(updated);
        this.saveSuccess.set('Los datos de la empresa se guardaron correctamente.');
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.serverFieldErrors.set(backendFieldErrors(error));
        this.saveError.set(backendErrorMessage(error, 'No pudimos guardar los cambios.'));
      },
    });
  }

  onDiscard(): void {
    const company = this.company();

    if (company) {
      this.resetForm(company);
      this.saveError.set(null);
      this.serverFieldErrors.set({});
    }
  }

  // ---------------------------------------------------------------- Logo

  openLogoPicker(): void {
    this.logoInput()?.nativeElement.click();
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Limpiar permite volver a elegir el mismo archivo tras un error.
    input.value = '';

    const company = this.company();

    if (!file || !company || this.logoBusy()) {
      return;
    }

    const invalid = this.validateLogo(file);

    if (invalid) {
      this.logoError.set(invalid);
      return;
    }

    this.logoBusy.set(true);
    this.logoError.set(null);

    this.companyApi.uploadLogo(company.publicId, file).subscribe({
      next: (updated) => {
        this.logoBusy.set(false);
        this.applyCompany(updated);
      },
      error: (error: unknown) => {
        this.logoBusy.set(false);
        this.logoError.set(backendErrorMessage(error, 'No pudimos subir el logo.'));
      },
    });
  }

  removeLogo(): void {
    const company = this.company();
    this.pendingConfirm.set(null);

    if (!company || this.logoBusy()) {
      return;
    }

    this.logoBusy.set(true);
    this.logoError.set(null);

    this.companyApi.deleteLogo(company.publicId).subscribe({
      next: (updated) => {
        this.logoBusy.set(false);
        this.applyCompany(updated);
        // El boton "Quitar" desaparece con el logo; sin esto el foco caeria en <body>.
        afterNextRender(() => this.logoUploadButton()?.nativeElement.focus(), {
          injector: this.injector,
        });
      },
      error: (error: unknown) => {
        this.logoBusy.set(false);
        this.logoError.set(backendErrorMessage(error, 'No pudimos quitar el logo.'));
      },
    });
  }

  // ---------------------------------------------------------------- Plataforma

  adminLimitMessage(): string | null {
    return controlErrorMessage(this.adminLimitControl, this.adminLimitError());
  }

  adminLimitChanged(): boolean {
    return this.adminLimitControl.value !== (this.company()?.adminLimit ?? null);
  }

  onSaveAdminLimit(): void {
    const company = this.company();
    const adminLimit = this.adminLimitControl.value;

    if (!company || this.adminLimitBusy()) {
      return;
    }

    if (this.adminLimitControl.invalid || adminLimit == null) {
      this.adminLimitControl.markAsTouched();
      return;
    }

    this.adminLimitBusy.set(true);
    this.adminLimitError.set(null);
    this.platformError.set(null);
    this.platformSuccess.set(null);

    this.companyApi.updateAdminLimit(company.publicId, adminLimit).subscribe({
      next: (updated) => {
        this.adminLimitBusy.set(false);
        this.applyCompany(updated);
        this.platformSuccess.set('Límite de administradores actualizado.');
      },
      error: (error: unknown) => {
        this.adminLimitBusy.set(false);
        // 409 cuando ya hay mas administradores activos que el limite pedido.
        this.adminLimitError.set(backendErrorMessage(error, 'No pudimos actualizar el límite.'));
      },
    });
  }

  toggleStatus(): void {
    const company = this.company();
    this.pendingConfirm.set(null);

    if (!company || this.statusBusy()) {
      return;
    }

    const status = company.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.statusBusy.set(true);
    this.platformError.set(null);
    this.platformSuccess.set(null);

    this.companyApi.updateStatus(company.publicId, status).subscribe({
      next: (updated) => {
        this.statusBusy.set(false);
        this.applyCompany(updated);
        this.platformSuccess.set(
          updated.status === 'ACTIVE' ? 'La empresa se activó.' : 'La empresa se desactivó.',
        );
      },
      error: (error: unknown) => {
        this.statusBusy.set(false);
        this.platformError.set(backendErrorMessage(error, 'No pudimos cambiar el estado.'));
      },
    });
  }

  // ---------------------------------------------------------------- Internos

  /** Toda respuesta del backend pasa por aqui: pantalla y sidebar ven lo mismo. */
  private applyCompany(company: CompanyResponse): void {
    this.company.set(company);
    this.companyScope.replaceCompany(company);

    if (!this.adminLimitControl.dirty || this.adminLimitControl.value === company.adminLimit) {
      this.adminLimitControl.reset(company.adminLimit);
    }
  }

  private resetForm(company: CompanyResponse): void {
    this.form.reset({
      nombre: company.nombre,
      razonSocial: company.razonSocial,
      descripcion: company.descripcion,
      direccion: company.direccion,
      telefonoContacto: company.telefonoContacto ?? '',
      emailContacto: company.emailContacto,
      urlWeb: company.urlWeb ?? '',
      numeroEmpleados: company.numeroEmpleados,
    });
  }

  private diff(company: CompanyResponse): UpdateCompanyRequest {
    const value = this.form.getRawValue();
    const changes: UpdateCompanyRequest = {};

    for (const field of TEXT_FIELDS) {
      const next = value[field].trim();

      // Un campo opcional vacio llega como null desde el backend.
      if (next !== (company[field] ?? '')) {
        changes[field] = next;
      }
    }

    if (value.numeroEmpleados != null && value.numeroEmpleados !== company.numeroEmpleados) {
      changes.numeroEmpleados = value.numeroEmpleados;
    }

    return changes;
  }

  private validateLogo(file: File): string | null {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (!LOGO_MIME_TYPES.includes(file.type) || !LOGO_EXTENSIONS.includes(extension)) {
      return 'Formato no permitido. Use JPG, PNG o WEBP.';
    }

    if (file.size > LOGO_MAX_BYTES) {
      return 'El archivo supera el máximo de 5 MB.';
    }

    return null;
  }
}
