import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { AuthService } from '../auth-service';

/** Mismos limites que PasswordResetConfirmRequest y PasswordResetProperties en el backend. */
const MIN_LENGTH = 8;
const MAX_LENGTH = 72;
const RESEND_SECONDS = 60;

type Step = 'email' | 'code' | 'password';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value as string;
  const confirm = group.get('confirmPassword')?.value as string;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

/**
 * Recuperacion de contrasena sin sesion: correo -> codigo -> nueva contrasena.
 * El backend responde igual exista o no la cuenta, asi que la pantalla avanza
 * siempre al paso del codigo.
 */
@Component({
  selector: 'app-password-reset',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './password-reset.html',
  styleUrl: './password-reset.scss',
})
export class PasswordReset {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private timer: ReturnType<typeof setInterval> | null = null;

  readonly minLength = MIN_LENGTH;
  readonly step = signal<Step>('email');
  readonly isSubmitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly info = signal<string | null>(null);
  readonly resendIn = signal(0);
  readonly showPasswords = signal(false);

  private resetToken = '';

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly codeForm = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      newPassword: [
        '',
        [Validators.required, Validators.minLength(MIN_LENGTH), Validators.maxLength(MAX_LENGTH)],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  constructor() {
    const email = this.route.snapshot.queryParamMap.get('email');
    if (email) {
      this.emailForm.patchValue({ email });
    }
    inject(DestroyRef).onDestroy(() => this.stopTimer());
  }

  get email(): string {
    return this.emailForm.controls.email.value.trim();
  }

  onStart(): void {
    if (this.isSubmitting()) {
      return;
    }
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      this.error.set('Ingresa un correo válido.');
      return;
    }
    this.requestCode(false);
  }

  onResend(): void {
    if (this.resendIn() > 0 || this.isSubmitting()) {
      return;
    }
    this.requestCode(true);
  }

  onVerify(): void {
    if (this.isSubmitting()) {
      return;
    }
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      this.error.set('El código tiene 6 dígitos.');
      return;
    }

    this.begin();
    this.authService.verifyPasswordResetCode(this.email, this.codeForm.controls.code.value).subscribe({
      next: (token) => {
        this.isSubmitting.set(false);
        this.resetToken = token;
        this.goTo('password');
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.codeForm.controls.code.reset('');
        this.error.set(backendErrorMessage(error, 'Código inválido o expirado.'));
      },
    });
  }

  onConfirm(): void {
    if (this.isSubmitting()) {
      return;
    }
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      this.error.set('Revisa los campos marcados.');
      return;
    }

    this.begin();
    const email = this.email;
    this.authService
      .confirmPasswordReset(email, this.resetToken, this.passwordForm.controls.newPassword.value)
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.resetToken = '';
          // Por si habia una sesion guardada en este navegador: ya no es valida.
          this.authService.logout();
          void this.router.navigate(['/login'], { queryParams: { email, passwordChanged: '1' } });
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.error.set(
            backendErrorMessage(error, 'No pudimos cambiar la contraseña. Solicita un nuevo código.'),
          );
        },
      });
  }

  onChangeEmail(): void {
    this.stopTimer();
    this.resendIn.set(0);
    this.resetToken = '';
    this.codeForm.reset();
    this.passwordForm.reset();
    this.goTo('email');
  }

  toggleVisibility(): void {
    this.showPasswords.update((value) => !value);
  }

  stepDone(index: number): boolean {
    return ['email', 'code', 'password'].indexOf(this.step()) >= index;
  }

  fieldError(name: 'email' | 'code' | 'newPassword' | 'confirmPassword'): string | null {
    const control =
      name === 'email'
        ? this.emailForm.controls.email
        : name === 'code'
          ? this.codeForm.controls.code
          : this.passwordForm.controls[name];

    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }
    if (control.hasError('email')) {
      return 'Ingresa un correo válido.';
    }
    if (control.hasError('pattern')) {
      return 'Ingresa los 6 dígitos del código.';
    }
    if (control.hasError('minlength')) {
      return `Usa al menos ${MIN_LENGTH} caracteres.`;
    }
    if (control.hasError('maxlength')) {
      return `Usa como máximo ${MAX_LENGTH} caracteres.`;
    }
    if (name === 'confirmPassword' && this.passwordForm.hasError('mismatch')) {
      return 'Las contraseñas no coinciden.';
    }
    return null;
  }

  private requestCode(resend: boolean): void {
    this.begin();
    this.authService.startPasswordReset(this.email).subscribe({
      next: (message) => {
        this.isSubmitting.set(false);
        this.startTimer();
        this.info.set(resend ? 'Si corresponde, te enviamos un nuevo código.' : message);
        if (!resend) {
          this.goTo('code', false);
        }
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.error.set(backendErrorMessage(error, 'No pudimos procesar la solicitud. Intenta nuevamente.'));
      },
    });
  }

  private begin(): void {
    this.isSubmitting.set(true);
    this.error.set(null);
    this.info.set(null);
  }

  private goTo(step: Step, clearInfo = true): void {
    this.step.set(step);
    this.error.set(null);
    if (clearInfo) {
      this.info.set(null);
    }
    // El foco va al titulo del paso para que los lectores de pantalla anuncien el cambio.
    setTimeout(() => this.heading()?.nativeElement.focus());
  }

  private startTimer(): void {
    this.stopTimer();
    this.resendIn.set(RESEND_SECONDS);
    this.timer = setInterval(() => {
      this.resendIn.update((value) => Math.max(0, value - 1));
      if (this.resendIn() === 0) {
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
