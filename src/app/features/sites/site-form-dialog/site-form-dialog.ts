import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { controlErrorMessage } from '../../../core/helpers/form-error-message';
import { SiteResponse, UpdateSiteRequest } from '../../../core/models/site';
import { ModalShell } from '../../../shared/components/modal-shell/modal-shell';
import { SitesApiService } from '../sites-api-service';

type Field = 'nombre' | 'ciudad' | 'direccion';

/** Alta y edicion de una sede. Solo el nombre es obligatorio. */
@Component({
  selector: 'app-site-form-dialog',
  imports: [ReactiveFormsModule, ModalShell],
  templateUrl: './site-form-dialog.html',
  styleUrl: './site-form-dialog.scss',
})
export class SiteFormDialog implements OnInit {
  private readonly api = inject(SitesApiService);
  private readonly fb = inject(FormBuilder);

  readonly companyPublicId = input.required<string>();
  /** null para registrar una sede nueva. */
  readonly site = input<SiteResponse | null>(null);

  readonly saved = output<SiteResponse>();
  readonly closed = output<void>();

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(200)]],
    ciudad: ['', [Validators.maxLength(150)]],
    direccion: ['', [Validators.maxLength(300)]],
  });

  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);
  readonly serverFieldErrors = signal<Partial<Record<Field, string>>>({});

  readonly isEdit = computed(() => !!this.site());

  readonly changes = computed<UpdateSiteRequest>(() => {
    this.formValue();
    const site = this.site();
    if (!site) {
      return {};
    }
    const value = this.form.getRawValue();
    const request: UpdateSiteRequest = {};
    if (value.nombre.trim() !== site.nombre) request.nombre = value.nombre.trim();
    if (value.ciudad.trim() !== (site.ciudad ?? '')) request.ciudad = value.ciudad.trim();
    if (value.direccion.trim() !== (site.direccion ?? ''))
      request.direccion = value.direccion.trim();
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
    const site = this.site();
    if (site) {
      this.form.reset({
        nombre: site.nombre,
        ciudad: site.ciudad ?? '',
        direccion: site.direccion ?? '',
      });
    }
  }

  fieldError(field: Field): string | null {
    return controlErrorMessage(this.form.controls[field], this.serverFieldErrors()[field]);
  }

  onSubmit(): void {
    if (this.isSaving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados.');
      return;
    }

    const site = this.site();
    const value = this.form.getRawValue();
    const request = site
      ? this.api.update(this.companyPublicId(), site.publicId, this.changes())
      : this.api.create(this.companyPublicId(), {
          nombre: value.nombre.trim(),
          ...(value.ciudad.trim() ? { ciudad: value.ciudad.trim() } : {}),
          ...(value.direccion.trim() ? { direccion: value.direccion.trim() } : {}),
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
        // 409 = ya existe una sede con ese nombre en la empresa.
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.serverFieldErrors.set({ nombre: backendErrorMessage(error) });
          this.form.controls.nombre.markAsTouched();
          return;
        }
        this.error.set(backendErrorMessage(error, 'No pudimos guardar la sede.'));
      },
    });
  }
}
