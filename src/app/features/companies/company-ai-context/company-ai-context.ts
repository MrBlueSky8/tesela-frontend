import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { CompanyResponse } from '../../../core/models/company';
import { ToastService } from '../../../core/services/toast-service';
import { CompanyApiService } from '../company-api-service';

export const AI_CONTEXT_MAX = 2000;

/**
 * Contexto de la empresa para la IA (Hito 4, S4).
 *
 * <p>Lo define Fundades: el Anexo 1 habla de "contexto específico de la
 * empresa, cuando sea proporcionado por Fundades". La empresa lo ve en modo
 * lectura, para saber qué se le dice a la IA sobre ella.
 */
@Component({
  selector: 'app-company-ai-context',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './company-ai-context.html',
  styleUrl: './company-ai-context.scss',
})
export class CompanyAiContext {
  private readonly api = inject(CompanyApiService);
  private readonly toast = inject(ToastService);

  readonly company = input.required<CompanyResponse>();
  /** Solo el administrador de plataforma (Fundades) edita. */
  readonly editable = input(false);
  readonly updated = output<CompanyResponse>();

  readonly max = AI_CONTEXT_MAX;
  readonly control = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(AI_CONTEXT_MAX)],
  });
  readonly isSaving = signal(false);
  private readonly value = signal('');

  readonly length = computed(() => this.value().length);
  readonly changed = computed(() => this.value().trim() !== (this.company().contextoIa ?? ''));

  constructor() {
    this.control.valueChanges.subscribe((v) => this.value.set(v));
    // Al cambiar la empresa (o tras guardar), el formulario refleja lo guardado.
    effect(() => {
      const actual = this.company().contextoIa ?? '';
      this.control.reset(actual);
      this.value.set(actual);
    });
  }

  onSave(): void {
    if (!this.editable() || this.isSaving() || this.control.invalid || !this.changed()) {
      return;
    }
    this.isSaving.set(true);
    this.api.updateAiContext(this.company().publicId, this.control.value.trim()).subscribe({
      next: (company) => {
        this.isSaving.set(false);
        this.updated.emit(company);
        this.toast.success(
          company.contextoIa ? 'Contexto para la IA guardado.' : 'Contexto para la IA eliminado.',
        );
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.toast.error(backendErrorMessage(error, 'No pudimos guardar el contexto para la IA.'));
      },
    });
  }

  onCancel(): void {
    const actual = this.company().contextoIa ?? '';
    this.control.reset(actual);
    this.value.set(actual);
  }
}
