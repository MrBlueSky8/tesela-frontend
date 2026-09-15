import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { TokenService } from '../../../core/services/token-service';
import { AuthService } from '../auth-service';

/** Mismo rango que ChangePasswordRequest en el backend. */
const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

/**
 * Cambio obligatorio de la contrasena temporal recibida por correo.
 * Al terminar, el backend invalida las sesiones y se vuelve al login.
 */
@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule],
  templateUrl: './change-password.html',
  styleUrl: './change-password.scss',
})
export class ChangePassword {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  readonly minLength = MIN_LENGTH;
  readonly email = this.tokenService.username;

  readonly showPasswords = signal(false);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group(
    {
      currentPassword: ['', [Validators.required, Validators.maxLength(MAX_LENGTH)]],
      newPassword: [
        '',
        [Validators.required, Validators.minLength(MIN_LENGTH), Validators.maxLength(MAX_LENGTH)],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  onSubmit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.submitError.set('Revisa los campos marcados.');
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();

    if (currentPassword === newPassword) {
      this.submitError.set('La nueva contrasena debe ser distinta de la temporal.');
      return;
    }

    this.isSubmitting.set(true);
    this.submitError.set(null);
    const email = this.email();

    this.authService.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        // Las sesiones ya no valen: se limpia la local y se vuelve a entrar.
        this.authService.logout();
        void this.router.navigate(['/login'], {
          queryParams: { email, passwordChanged: '1' },
        });
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.submitError.set(this.resolveError(error));
      },
    });
  }

  onLogout(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  toggleVisibility(): void {
    this.showPasswords.update((value) => !value);
  }

  fieldError(name: 'currentPassword' | 'newPassword' | 'confirmPassword'): string | null {
    const control = this.form.controls[name];

    if (!control.touched && !control.dirty) {
      return null;
    }

    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }
    if (control.hasError('minlength')) {
      return `Usa al menos ${MIN_LENGTH} caracteres.`;
    }
    if (control.hasError('maxlength')) {
      return `Usa como maximo ${MAX_LENGTH} caracteres.`;
    }
    if (name === 'confirmPassword' && this.form.hasError('mismatch')) {
      return 'Las contrasenas no coinciden.';
    }

    return null;
  }

  private resolveError(error: unknown): string {
    // 401 aqui significa que la contrasena temporal escrita no es la correcta.
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return backendErrorMessage(error, 'La contrasena temporal no es correcta.');
    }

    return backendErrorMessage(error, 'No pudimos cambiar la contrasena. Intenta nuevamente.');
  }
}
