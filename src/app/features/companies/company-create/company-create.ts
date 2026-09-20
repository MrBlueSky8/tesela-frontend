import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import {
  backendErrorMessage,
  backendFieldErrors,
} from '../../../core/helpers/backend-error-message';
import { controlErrorMessage } from '../../../core/helpers/form-error-message';
import { CreateCompanyRequest } from '../../../core/models/company';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { CompanyApiService } from '../company-api-service';
import { COMPANY_FIELD_LIMITS, CompanyLimitedField } from '../company-field-limits';

type CompanyField = keyof CreateCompanyRequest;

/**
 * Alta de empresa, reservada a ADMIN_PLATAFORMA (la ruta lo exige y el backend
 * lo vuelve a comprobar). Las validaciones replican CreateCompanyRequest para
 * dar feedback inmediato; los errores por campo del backend se muestran igual.
 */
@Component({
  selector: 'app-company-create',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './company-create.html',
  styleUrl: './company-create.scss',
})
export class CompanyCreate {
  private readonly fb = inject(FormBuilder);
  private readonly companyApi = inject(CompanyApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly router = inject(Router);

  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly serverFieldErrors = signal<Record<string, string>>({});

  readonly form = this.fb.nonNullable.group({
    ruc: ['', [Validators.required, Validators.maxLength(COMPANY_FIELD_LIMITS.ruc)]],
    nombre: ['', [Validators.required, Validators.maxLength(COMPANY_FIELD_LIMITS.nombre)]],
    razonSocial: ['', [Validators.required, Validators.maxLength(COMPANY_FIELD_LIMITS.razonSocial)]],
    descripcion: ['', [Validators.required, Validators.maxLength(COMPANY_FIELD_LIMITS.descripcion)]],
    direccion: ['', [Validators.required, Validators.maxLength(COMPANY_FIELD_LIMITS.direccion)]],
    // Opcionales, igual que en CreateCompanyRequest.
    telefonoContacto: ['', [Validators.pattern(/^$|^[0-9+() -]{6,15}$/)]],
    emailContacto: ['', [Validators.required, Validators.email, Validators.maxLength(COMPANY_FIELD_LIMITS.emailContacto)]],
    urlWeb: ['', [Validators.maxLength(COMPANY_FIELD_LIMITS.urlWeb)]],
    numeroEmpleados: [null as number | null, [Validators.min(0)]],
    adminLimit: [null as number | null, [Validators.min(1)]],
  });

  onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitError.set('Revisa los campos marcados.');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    this.serverFieldErrors.set({});

    this.companyApi.create(this.buildPayload()).subscribe({
      next: (company) => {
        this.isSubmitting.set(false);
        // El selector del encabezado debe ver la empresa recien creada.
        this.companyContext.invalidateCompanies();
        // Solo Fundades da de alta empresas: vuelve a su directorio.
        void this.router.navigate(['/plataforma/empresas'], {
          state: { createdCompany: company.nombre },
        });
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.serverFieldErrors.set(backendFieldErrors(error));
        this.submitError.set(backendErrorMessage(error, 'No pudimos registrar la empresa.'));
      },
    });
  }

  readonly limits = COMPANY_FIELD_LIMITS;

  /** "123/500" bajo un campo con maximo, para no descubrirlo al guardar. */
  counter(field: CompanyLimitedField): string {
    return `${this.lengthOf(field)}/${COMPANY_FIELD_LIMITS[field]}`;
  }

  counterIsFull(field: CompanyLimitedField): boolean {
    return this.lengthOf(field) >= COMPANY_FIELD_LIMITS[field];
  }

  private lengthOf(field: CompanyLimitedField): number {
    return this.form.controls[field].value.length;
  }

  /** Mensaje a mostrar bajo el campo: primero el del cliente, luego el del backend. */
  fieldError(field: CompanyField): string | null {
    return controlErrorMessage(this.form.controls[field], this.serverFieldErrors()[field]);
  }

  private buildPayload(): CreateCompanyRequest {
    const value = this.form.getRawValue();

    return {
      ruc: value.ruc.trim(),
      nombre: value.nombre.trim(),
      razonSocial: value.razonSocial.trim(),
      descripcion: value.descripcion.trim(),
      direccion: value.direccion.trim(),
      telefonoContacto: value.telefonoContacto.trim(),
      emailContacto: value.emailContacto.trim(),
      urlWeb: value.urlWeb.trim(),
      // Vacio significa "sin dato": no se envia.
      ...(value.numeroEmpleados != null ? { numeroEmpleados: value.numeroEmpleados } : {}),
      // Vacio significa "usar el limite por defecto del backend".
      ...(value.adminLimit != null ? { adminLimit: value.adminLimit } : {}),
    };
  }
}
