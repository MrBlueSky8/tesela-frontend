import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, forkJoin, map } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { GENDER_OPTIONS } from '../../../core/helpers/person-labels';
import { ApplicantResponse, UpdateApplicantRequest } from '../../../core/models/applicant';
import { Gender } from '../../../core/models/user-profile-response';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { ToastService } from '../../../core/services/toast-service';
import {
  CompatibilityApiService,
  DisabilityProfileCatalogItem,
} from '../compatibility-api-service';

const DOCUMENT_LABELS: Record<string, string> = {
  DNI: 'DNI',
  CE: 'Carné de extranjería',
  PASSPORT: 'Pasaporte',
};

/**
 * Ficha de un postulante dentro de la empresa.
 *
 * <p>La identidad es de solo lectura: la corrige Fundades. El contacto
 * pertenece a la persona, así que el cambio se ve en sus otras fichas y en sus
 * cuentas; la pantalla lo advierte. La evaluación de las 30 áreas llega en la
 * siguiente entrega del módulo.
 */
@Component({
  selector: 'app-applicant-detail',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './applicant-detail.html',
  styleUrl: './applicant-detail.scss',
})
export class ApplicantDetail {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CompatibilityApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(ToastService);

  readonly company = this.companyContext.company;
  readonly genderOptions = GENDER_OPTIONS;

  readonly applicant = signal<ApplicantResponse | null>(null);
  readonly profiles = signal<DisabilityProfileCatalogItem[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly isSavingProfiles = signal(false);
  readonly selectedProfiles = signal<string[]>([]);

  readonly fullName = computed(() => {
    const applicant = this.applicant();
    return applicant ? `${applicant.nombres} ${applicant.apellidos}` : '';
  });

  readonly documentLabel = computed(() => {
    const type = this.applicant()?.documentType;
    return type ? (DOCUMENT_LABELS[type] ?? type) : 'Documento';
  });

  readonly profilesChanged = computed(() => {
    const actuales = (this.applicant()?.perfiles ?? []).map((perfil) => perfil.publicId).sort();
    const elegidos = [...this.selectedProfiles()].sort();
    return (
      actuales.length !== elegidos.length ||
      actuales.some((publicId, index) => publicId !== elegidos[index])
    );
  });

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.email, Validators.maxLength(320)]],
    cargoActual: ['', [Validators.maxLength(150)]],
    areaDepartamento: ['', [Validators.maxLength(150)]],
    telefono: ['', [Validators.pattern(/^$|^[0-9+() -]{6,15}$/)]],
    direccion: ['', [Validators.maxLength(120)]],
    fechaNacimiento: [''],
    genero: [''],
  });

  constructor() {
    // Ir de un postulante a otro reutiliza el componente: hay que recargar.
    this.route.paramMap
      .pipe(
        map((params) => params.get('applicantPublicId')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.load());
  }

  load(): void {
    const company = this.company();
    const applicantPublicId = this.route.snapshot.paramMap.get('applicantPublicId');

    if (!company || !applicantPublicId) {
      this.isLoading.set(false);
      this.loadError.set('No pudimos identificar al postulante.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      applicant: this.api.get(company.publicId, applicantPublicId),
      profiles: this.api.disabilityProfiles(),
    }).subscribe({
      next: ({ applicant, profiles }) => {
        this.isLoading.set(false);
        this.profiles.set(profiles);
        this.setApplicant(applicant);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(
          error instanceof HttpErrorResponse && error.status === 404
            ? 'Este postulante no pertenece a la empresa.'
            : backendErrorMessage(error, 'No pudimos cargar al postulante.'),
        );
      },
    });
  }

  onSave(): void {
    const company = this.company();
    const applicant = this.applicant();

    if (!company || !applicant || this.isSaving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saveError.set('Revisa los campos marcados.');
      return;
    }

    const payload = this.changes(applicant);
    if (Object.keys(payload).length === 0) {
      this.saveError.set(null);
      this.toast.info('No hay cambios por guardar.');
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);

    this.api.update(company.publicId, applicant.publicId, payload).subscribe({
      next: (actualizado) => {
        this.isSaving.set(false);
        this.setApplicant(actualizado);
        this.toast.success('Datos del postulante actualizados.');
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.toast.error(backendErrorMessage(error, 'No pudimos guardar los cambios.'));
      },
    });
  }

  onDiscard(): void {
    const applicant = this.applicant();
    if (applicant) {
      this.setApplicant(applicant);
    }
    this.saveError.set(null);
  }

  toggleProfile(publicId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedProfiles.update((current) =>
      checked ? [...new Set([...current, publicId])] : current.filter((id) => id !== publicId),
    );
  }

  isProfileSelected(publicId: string): boolean {
    return this.selectedProfiles().includes(publicId);
  }

  onSaveProfiles(): void {
    const company = this.company();
    const applicant = this.applicant();

    if (!company || !applicant || this.isSavingProfiles()) {
      return;
    }

    this.isSavingProfiles.set(true);
    this.saveError.set(null);

    this.api
      .updateProfiles(company.publicId, applicant.publicId, this.selectedProfiles())
      .subscribe({
        next: (actualizado) => {
          this.isSavingProfiles.set(false);
          this.setApplicant(actualizado);
          this.toast.success('Perfiles declarados actualizados.');
        },
        error: (error: unknown) => {
          this.isSavingProfiles.set(false);
          this.toast.error(backendErrorMessage(error, 'No pudimos guardar los perfiles.'));
        },
      });
  }

  onToggleEstado(): void {
    const company = this.company();
    const applicant = this.applicant();

    if (!company || !applicant || this.isSaving()) {
      return;
    }

    const estado = applicant.estado === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.isSaving.set(true);
    this.saveError.set(null);

    this.api.update(company.publicId, applicant.publicId, { estado }).subscribe({
      next: (actualizado) => {
        this.isSaving.set(false);
        this.setApplicant(actualizado);
        this.toast.success(
          estado === 'ACTIVE' ? 'Postulante reactivado.' : 'Postulante marcado como inactivo.',
        );
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.toast.error(backendErrorMessage(error, 'No pudimos cambiar el estado.'));
      },
    });
  }

  fieldError(
    name: 'email' | 'telefono' | 'direccion' | 'cargoActual' | 'areaDepartamento',
  ): string | null {
    const control = this.form.controls[name];

    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('email')) {
      return 'Escribe un correo válido.';
    }
    if (control.hasError('pattern')) {
      return 'Usa entre 6 y 15 dígitos; se permiten + ( ) - y espacios.';
    }
    if (control.hasError('maxlength')) {
      return 'El texto es demasiado largo.';
    }
    return null;
  }

  private setApplicant(applicant: ApplicantResponse): void {
    this.applicant.set(applicant);
    this.selectedProfiles.set(applicant.perfiles.map((perfil) => perfil.publicId));
    this.form.reset({
      email: applicant.email ?? '',
      cargoActual: applicant.cargoActual ?? '',
      areaDepartamento: applicant.areaDepartamento ?? '',
      telefono: applicant.telefono ?? '',
      direccion: applicant.direccion ?? '',
      fechaNacimiento: applicant.fechaNacimiento ?? '',
      genero: applicant.genero ?? '',
    });
  }

  /** Solo lo que cambió. Fecha y género no pueden vaciarse: el backend ignora los nulos. */
  private changes(applicant: ApplicantResponse): UpdateApplicantRequest {
    const value = this.form.getRawValue();
    const payload: UpdateApplicantRequest = {};

    if (value.email.trim() !== (applicant.email ?? '')) {
      payload.email = value.email.trim();
    }
    if (value.cargoActual.trim() !== (applicant.cargoActual ?? '')) {
      payload.cargoActual = value.cargoActual.trim();
    }
    if (value.areaDepartamento.trim() !== (applicant.areaDepartamento ?? '')) {
      payload.areaDepartamento = value.areaDepartamento.trim();
    }
    if (value.telefono.trim() !== (applicant.telefono ?? '')) {
      payload.telefono = value.telefono.trim();
    }
    if (value.direccion.trim() !== (applicant.direccion ?? '')) {
      payload.direccion = value.direccion.trim();
    }
    if (value.fechaNacimiento && value.fechaNacimiento !== applicant.fechaNacimiento) {
      payload.fechaNacimiento = value.fechaNacimiento;
    }
    if (value.genero && value.genero !== applicant.genero) {
      payload.genero = value.genero as Gender;
    }
    return payload;
  }
}
