import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { controlErrorMessage } from '../../../core/helpers/form-error-message';
import { ApplicantLookupResponse } from '../../../core/models/applicant';
import { DocumentType } from '../../../core/models/user-profile-response';
import { ModalShell } from '../../../shared/components/modal-shell/modal-shell';
import { CompatibilityApiService, DisabilityProfileCatalogItem } from '../compatibility-api-service';

type Mode = 'document' | 'identity';
type CreateField = 'email' | 'firstNames' | 'lastNames' | 'cargoActual' | 'telefono';

/**
 * Alta de un postulante. El documento es el dato previo: con él la pantalla
 * sabe si la persona ya está en el padrón (y completa su identidad) o si hay
 * que registrarla. Mismo recorrido que el alta de usuarios de empresa.
 */
@Component({
  selector: 'app-add-applicant-dialog',
  imports: [ReactiveFormsModule, RouterLink, ModalShell],
  templateUrl: './add-applicant-dialog.html',
  styleUrl: './add-applicant-dialog.scss',
})
export class AddApplicantDialog {
  private readonly api = inject(CompatibilityApiService);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);

  private readonly documentInput = viewChild<ElementRef<HTMLInputElement>>('documentInput');
  private readonly firstInput = viewChild<ElementRef<HTMLInputElement>>('firstInput');

  readonly companyPublicId = input.required<string>();

  /** Nombre completo del postulante registrado. */
  readonly added = output<string>();
  readonly closed = output<void>();

  readonly documentTypes: { value: DocumentType; label: string }[] = [
    { value: 'DNI', label: 'DNI' },
    { value: 'CE', label: 'Carné de extranjería' },
    { value: 'PASSPORT', label: 'Pasaporte' },
  ];

  readonly mode = signal<Mode>('document');
  readonly lookup = signal<ApplicantLookupResponse | null>(null);
  readonly isLookingUp = signal(false);
  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);

  readonly profiles = signal<DisabilityProfileCatalogItem[]>([]);
  readonly selectedProfiles = signal<string[]>([]);

  readonly documentForm = this.fb.nonNullable.group({
    documentType: ['DNI' as DocumentType, [Validators.required]],
    documentNumber: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
  });

  readonly createForm = this.fb.nonNullable.group({
    firstNames: ['', [Validators.required, Validators.maxLength(500)]],
    lastNames: ['', [Validators.required, Validators.maxLength(500)]],
    email: ['', [Validators.email, Validators.maxLength(320)]],
    cargoActual: ['', [Validators.maxLength(150)]],
    telefono: ['', [Validators.pattern(/^$|^[0-9+() -]{6,15}$/)]],
  });

  /** La persona ya está registrada: su identidad no se teclea. */
  readonly knownPerson = computed(() => !!this.lookup()?.nombres);

  readonly alreadyHasFicha = computed(() => this.lookup()?.outcome === 'YA_TIENE_FICHA');

  readonly fichaLink = computed(() => {
    const applicantPublicId = this.lookup()?.applicantPublicId;
    return applicantPublicId
      ? ['/modulos/compatibilidad/postulantes', applicantPublicId]
      : null;
  });

  readonly stepLabel = computed(() => {
    if (this.mode() === 'document') {
      return 'Paso 1 de 2: documento';
    }
    return this.alreadyHasFicha() ? 'Resultado de la consulta' : 'Paso 2 de 2: datos del postulante';
  });

  constructor() {
    this.api.disabilityProfiles().subscribe({
      next: (profiles) => this.profiles.set(profiles),
      error: () => this.profiles.set([]),
    });
  }

  // ---------------------------------------------------------------- Paso 1

  onLookup(): void {
    if (this.isLookingUp()) {
      return;
    }
    if (this.documentForm.invalid) {
      this.documentForm.markAllAsTouched();
      this.error.set('Revisa el documento.');
      return;
    }

    const { documentType, documentNumber } = this.documentForm.getRawValue();
    this.isLookingUp.set(true);
    this.error.set(null);

    this.api.lookup(this.companyPublicId(), documentType, documentNumber.trim()).subscribe({
      next: (result) => {
        this.isLookingUp.set(false);
        this.applyLookup(result);
      },
      error: (error: unknown) => {
        this.isLookingUp.set(false);
        this.error.set(backendErrorMessage(error, 'No pudimos consultar el documento.'));
      },
    });
  }

  backToDocument(): void {
    this.error.set(null);
    this.lookup.set(null);
    this.selectedProfiles.set([]);
    this.mode.set('document');
    this.focusLater(() => this.documentInput());
  }

  // ---------------------------------------------------------------- Paso 2

  toggleProfile(publicId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedProfiles.update((current) =>
      checked ? [...new Set([...current, publicId])] : current.filter((id) => id !== publicId),
    );
  }

  isProfileSelected(publicId: string): boolean {
    return this.selectedProfiles().includes(publicId);
  }

  fieldError(field: CreateField): string | null {
    return controlErrorMessage(this.createForm.controls[field]);
  }

  onSubmit(): void {
    if (this.isSaving() || this.alreadyHasFicha()) {
      return;
    }
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.error.set('Revisa los campos marcados.');
      return;
    }

    const documento = this.documentForm.getRawValue();
    const value = this.createForm.getRawValue();
    this.isSaving.set(true);
    this.error.set(null);

    this.api
      .create(this.companyPublicId(), {
        documentType: documento.documentType,
        documentNumber: documento.documentNumber.trim(),
        firstNames: value.firstNames.trim(),
        lastNames: value.lastNames.trim(),
        email: value.email.trim() || undefined,
        cargoActual: value.cargoActual.trim() || undefined,
        telefono: value.telefono.trim() || undefined,
        perfilPublicIds: this.selectedProfiles(),
      })
      .subscribe({
        next: (applicant) => {
          this.isSaving.set(false);
          this.added.emit(`${applicant.nombres} ${applicant.apellidos}`);
        },
        error: (error: unknown) => {
          this.isSaving.set(false);
          this.error.set(backendErrorMessage(error, 'No pudimos registrar al postulante.'));
        },
      });
  }

  // ---------------------------------------------------------------- Internos

  private applyLookup(result: ApplicantLookupResponse): void {
    this.lookup.set(result);
    this.createForm.reset({
      firstNames: result.nombres ?? '',
      lastNames: result.apellidos ?? '',
      email: '',
      cargoActual: '',
      telefono: '',
    });

    // La identidad registrada no se edita aquí: la corrige Fundades.
    const identidad = [this.createForm.controls.firstNames, this.createForm.controls.lastNames];
    for (const control of identidad) {
      if (result.nombres) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }

    this.mode.set('identity');
    if (!result.nombres) {
      this.focusLater(() => this.firstInput());
    }
  }

  private focusLater(target: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }
}
