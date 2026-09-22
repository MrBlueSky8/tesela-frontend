import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { backendErrorMessage } from '../../core/helpers/backend-error-message';
import { AuthService } from './auth-service';

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './auth.html',
  styleUrl: './auth.scss',
})
export class Auth {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly showPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly loginError = signal<string | null>(null);
  readonly loginSuccess = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [true],
  });

  constructor() {
    const email = this.route.snapshot.queryParamMap.get('email');

    if (email) {
      this.form.patchValue({ email });
    }

    if (this.route.snapshot.queryParamMap.get('passwordChanged') === '1') {
      this.loginSuccess.set('Contraseña actualizada. Ingresa con tu nueva contraseña.');
    }
  }

  onLogin(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.loginError.set('Completa correctamente los campos requeridos.');
      return;
    }

    this.isSubmitting.set(true);
    this.loginError.set(null);
    this.loginSuccess.set(null);

    const { email, password, rememberMe } = this.form.getRawValue();

    this.authService.login({ email, password }, rememberMe).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigate(['/home']);
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.loginError.set(this.resolveLoginError(error));
      },
    });
  }

  onTogglePasswordVisibility(): void {
    this.showPassword.update((value) => !value);
  }

  hasFieldError(fieldName: 'email' | 'password', errorCode?: string): boolean {
    const field = this.form.controls[fieldName];

    if (!field.touched && !field.dirty) {
      return false;
    }

    if (!errorCode) {
      return field.invalid;
    }

    return !!field.errors?.[errorCode];
  }

  /**
   * TeselaBackend devuelve 401 con mensaje propio para credenciales invalidas
   * (InvalidCredentialsException -> GlobalExceptionHandler).
   */
  private resolveLoginError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      return backendErrorMessage(
        error,
        'Correo o contraseña incorrectos. Verifica tus datos e intenta nuevamente.',
      );
    }

    return backendErrorMessage(error, 'No se pudo iniciar sesión. Intenta nuevamente.');
  }
}
