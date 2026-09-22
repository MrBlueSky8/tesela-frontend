import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { GENDER_OPTIONS } from '../../../core/helpers/person-labels';
import { transientMessage } from '../../../core/helpers/transient-message';
import { PRIVILEGE_LABELS } from '../../../core/helpers/privilege-labels';
import { CompanyPrivilege, CompanyResponse } from '../../../core/models/company';
import { Gender, UserProfileResponse } from '../../../core/models/user-profile-response';
import { TokenService } from '../../../core/services/token-service';
import { AuthService } from '../../auth/auth-service';
import { CompanyApiService } from '../../companies/company-api-service';
import { AccountApiService, UpdateMyProfileRequest } from '../account-api-service';

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

const DOCUMENT_LABELS: Record<string, string> = { DNI: 'DNI', CE: 'Carné de extranjería', PASSPORT: 'Pasaporte' };

interface CompanyAccess {
  company: CompanyResponse;
  privileges: CompanyPrivilege[];
}

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

/** Fecha local de hoy en formato YYYY-MM-DD, para el max del input date. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Mi perfil: identidad de solo lectura (la corrige Fundades), datos de
 * contacto editables, cambio de contrasena y las empresas a las que accede.
 */
@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss',
})
export class ProfilePage {
  private readonly fb = inject(FormBuilder);
  private readonly accountApi = inject(AccountApiService);
  private readonly companyApi = inject(CompanyApiService);
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly genderOptions = GENDER_OPTIONS;
  readonly maxBirthDate = today();
  readonly passwordMin = PASSWORD_MIN;

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly profile = signal<UserProfileResponse | null>(null);

  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  // Confirmacion: se borra sola a los pocos segundos.
  readonly saveSuccess = transientMessage();

  readonly isChangingPassword = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly showPasswords = signal(false);

  readonly accessesLoading = signal(true);
  readonly accessesError = signal<string | null>(null);
  readonly accesses = signal<CompanyAccess[]>([]);

  readonly isPlatformAdmin = computed(() => this.tokenService.role() === 'ADMIN_PLATAFORMA');

  readonly fullName = computed(() => {
    const current = this.profile();
    return current ? `${current.firstNames} ${current.lastNames}` : '';
  });

  readonly documentLabel = computed(() => {
    const type = this.profile()?.documentType;
    return type ? (DOCUMENT_LABELS[type] ?? type) : 'Documento';
  });

  readonly form = this.fb.nonNullable.group({
    telefono: ['', [Validators.pattern(/^[0-9+() -]{6,15}$/)]],
    direccion: ['', [Validators.maxLength(120)]],
    fechaNacimiento: [''],
    genero: [''],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required, Validators.maxLength(PASSWORD_MAX)]],
      newPassword: [
        '',
        [Validators.required, Validators.minLength(PASSWORD_MIN), Validators.maxLength(PASSWORD_MAX)],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    this.load();
    this.loadAccesses();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.accountApi
      .me()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.isLoading.set(false);
          this.setProfile(profile);
        },
        error: (error: unknown) => {
          this.isLoading.set(false);
          this.loadError.set(backendErrorMessage(error, 'No pudimos cargar tu perfil.'));
        },
      });
  }

  loadAccesses(): void {
    this.accessesLoading.set(true);
    this.accessesError.set(null);

    // Un administrador de plataforma ve todas las empresas: listar cada una no aporta.
    if (this.isPlatformAdmin()) {
      this.accessesLoading.set(false);
      this.accesses.set([]);
      return;
    }

    this.companyApi
      .list()
      .pipe(
        switchMap((companies) =>
          companies.length === 0
            ? of([])
            : forkJoin(
                companies.map((company) =>
                  this.companyApi.myAccess(company.publicId).pipe(
                    map((access) => ({ company, privileges: access.effectivePrivileges })),
                    // Si una membresia cambio entre ambas llamadas, se omite esa empresa.
                    catchError(() => of(null)),
                  ),
                ),
              ).pipe(map((items) => items.filter((item): item is CompanyAccess => item !== null))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (items) => {
          this.accessesLoading.set(false);
          this.accesses.set(items);
        },
        error: (error: unknown) => {
          this.accessesLoading.set(false);
          this.accessesError.set(backendErrorMessage(error, 'No pudimos cargar tus accesos.'));
        },
      });
  }

  onSave(): void {
    const current = this.profile();
    if (!current || this.isSaving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saveError.set('Revisa los campos marcados.');
      return;
    }

    const payload = this.changes(current);
    if (Object.keys(payload).length === 0) {
      this.saveSuccess.set('No hay cambios por guardar.');
      this.saveError.set(null);
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    this.accountApi.update(payload).subscribe({
      next: (profile) => {
        this.isSaving.set(false);
        this.setProfile(profile);
        this.saveSuccess.set('Datos actualizados.');
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.saveError.set(backendErrorMessage(error, 'No pudimos guardar los cambios.'));
      },
    });
  }

  onDiscard(): void {
    const current = this.profile();
    if (current) {
      this.setProfile(current);
    }
    this.saveError.set(null);
    this.saveSuccess.set(null);
  }

  onChangePassword(): void {
    if (this.isChangingPassword()) {
      return;
    }
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.passwordError.set('Revisa los campos marcados.');
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    if (currentPassword === newPassword) {
      this.passwordError.set('La nueva contraseña debe ser distinta de la actual.');
      return;
    }

    this.isChangingPassword.set(true);
    this.passwordError.set(null);
    const email = this.profile()?.email ?? this.tokenService.username();

    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        // El backend invalida todas las sesiones, incluida esta.
        this.authService.logout();
        void this.router.navigate(['/login'], { queryParams: { email, passwordChanged: '1' } });
      },
      error: (error: unknown) => {
        this.isChangingPassword.set(false);
        this.passwordError.set(
          error instanceof HttpErrorResponse && error.status === 401
            ? backendErrorMessage(error, 'La contraseña actual es incorrecta.')
            : backendErrorMessage(error, 'No pudimos cambiar la contraseña.'),
        );
      },
    });
  }

  togglePasswords(): void {
    this.showPasswords.update((value) => !value);
  }

  privilegeLabel(privilege: CompanyPrivilege): string {
    return PRIVILEGE_LABELS[privilege] ?? privilege;
  }

  fieldError(name: 'telefono' | 'direccion'): string | null {
    const control = this.form.controls[name];
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('pattern')) {
      return 'Usa entre 6 y 15 dígitos; se permiten + ( ) - y espacios.';
    }
    if (control.hasError('maxlength')) {
      return 'Usa como máximo 120 caracteres.';
    }
    return null;
  }

  passwordFieldError(name: 'currentPassword' | 'newPassword' | 'confirmPassword'): string | null {
    const control = this.passwordForm.controls[name];
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }
    if (control.hasError('minlength')) {
      return `Usa al menos ${PASSWORD_MIN} caracteres.`;
    }
    if (control.hasError('maxlength')) {
      return `Usa como máximo ${PASSWORD_MAX} caracteres.`;
    }
    if (name === 'confirmPassword' && this.passwordForm.hasError('mismatch')) {
      return 'Las contraseñas no coinciden.';
    }
    return null;
  }

  private setProfile(profile: UserProfileResponse): void {
    this.profile.set(profile);
    this.form.reset({
      telefono: profile.phone ?? '',
      direccion: profile.address ?? '',
      fechaNacimiento: profile.birthDate ?? '',
      genero: profile.gender ?? '',
    });
  }

  /** Solo lo que cambio. Fecha y genero no se pueden vaciar: el backend ignora los nulos. */
  private changes(current: UserProfileResponse): UpdateMyProfileRequest {
    const value = this.form.getRawValue();
    const payload: UpdateMyProfileRequest = {};

    if (value.telefono.trim() !== (current.phone ?? '')) {
      payload.telefono = value.telefono.trim();
    }
    if (value.direccion.trim() !== (current.address ?? '')) {
      payload.direccion = value.direccion.trim();
    }
    if (value.fechaNacimiento && value.fechaNacimiento !== current.birthDate) {
      payload.fechaNacimiento = value.fechaNacimiento;
    }
    if (value.genero && value.genero !== current.gender) {
      payload.genero = value.genero as Gender;
    }
    return payload;
  }
}
