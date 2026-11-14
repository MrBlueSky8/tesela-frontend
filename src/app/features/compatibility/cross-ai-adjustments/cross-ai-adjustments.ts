import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import {
  ADJUSTMENT_PRIORITIES,
  ADJUSTMENT_PRIORITY_BADGES,
  ADJUSTMENT_PRIORITY_LABELS,
  ADJUSTMENT_TYPE_LABELS,
} from '../../../core/helpers/methodology-labels';
import { AdjustmentPriority, CrossAdjustmentsState } from '../../../core/models/compatibility-cross';
import { ToastService } from '../../../core/services/toast-service';
import { AiOutputFrame } from '../ai-output-frame/ai-output-frame';
import { CompatibilityApiService } from '../compatibility-api-service';
import {
  AdjustmentsDraft,
  aSolicitud,
  accionesDe,
  borradorDe,
  erroresDe,
  ordenados,
  referenciaDe,
} from './adjustments-rules';

/**
 * Sección 4 del informe (guía v3.1, 7.5): ajustes razonables propuestos por la
 * IA a partir de las brechas y las alertas (Hito 4, S6).
 *
 * <p>La IA genera un borrador; una persona corrige textos o prioridades, quita
 * lo que no aplique y lo aprueba. Es una propuesta base: el seguimiento de los
 * ajustes (responsables, estados) es del Módulo 3.
 */
@Component({
  selector: 'app-cross-ai-adjustments',
  imports: [AiOutputFrame],
  templateUrl: './cross-ai-adjustments.html',
  styleUrl: './cross-ai-adjustments.scss',
})
export class CrossAiAdjustments implements OnInit {
  private readonly api = inject(CompatibilityApiService);
  private readonly toast = inject(ToastService);

  readonly companyPublicId = input.required<string>();
  readonly crossPublicId = input.required<string>();
  /** En el informe: solo se muestra si está aprobada, sin acciones. */
  readonly printMode = input(false);

  readonly typeLabels = ADJUSTMENT_TYPE_LABELS;
  readonly priorityLabels = ADJUSTMENT_PRIORITY_LABELS;
  readonly priorityBadges = ADJUSTMENT_PRIORITY_BADGES;
  readonly priorities = ADJUSTMENT_PRIORITIES;
  readonly referenciaDe = referenciaDe;

  readonly state = signal<CrossAdjustmentsState | null>(null);
  readonly isLoading = signal(true);
  readonly generating = signal(false);
  readonly saving = signal(false);
  readonly draft = signal<AdjustmentsDraft | null>(null);

  readonly propuesta = computed(() => this.state()?.propuesta ?? null);
  readonly ajustes = computed(() => ordenados(this.propuesta()?.ajustes ?? []));
  readonly acciones = computed(() => accionesDe(this.state()));
  readonly errores = computed(() => {
    const draft = this.draft();
    return draft ? erroresDe(draft) : [];
  });

  ngOnInit(): void {
    this.api.crossAdjustments(this.companyPublicId(), this.crossPublicId()).subscribe({
      next: (state) => {
        this.isLoading.set(false);
        this.state.set(state);
      },
      error: () => {
        this.isLoading.set(false);
        this.state.set({ permitida: false, motivo: null, propuesta: null });
      },
    });
  }

  onGenerar(): void {
    if (this.generating() || !this.acciones().generar) {
      return;
    }
    this.generating.set(true);
    this.draft.set(null);
    this.api.proposeCrossAdjustments(this.companyPublicId(), this.crossPublicId()).subscribe({
      next: (state) => {
        this.generating.set(false);
        this.state.set(state);
        this.toast.success('Ajustes propuestos. Revísalos antes de aprobarlos.');
      },
      error: (error: unknown) => {
        this.generating.set(false);
        this.toast.error(this.mensajeError(error));
      },
    });
  }

  onEditar(): void {
    const propuesta = this.propuesta();
    if (propuesta && this.acciones().revisar) {
      this.draft.set(borradorDe({ ...propuesta, ajustes: ordenados(propuesta.ajustes) }));
    }
  }

  onCancelarEdicion(): void {
    this.draft.set(null);
  }

  setTexto(index: number, event: Event): void {
    const valor = (event.target as HTMLTextAreaElement).value;
    this.draft.update((d) =>
      d ? { ...d, ajustes: d.ajustes.map((a, i) => (i === index ? { ...a, ajuste: valor } : a)) } : d,
    );
  }

  setPrioridad(index: number, event: Event): void {
    const valor = (event.target as HTMLSelectElement).value as AdjustmentPriority;
    this.draft.update((d) =>
      d ? { ...d, ajustes: d.ajustes.map((a, i) => (i === index ? { ...a, prioridad: valor } : a)) } : d,
    );
  }

  setNota(event: Event): void {
    const valor = (event.target as HTMLTextAreaElement).value;
    this.draft.update((d) => (d ? { ...d, notaGeneral: valor } : d));
  }

  quitar(index: number): void {
    this.draft.update((d) => (d ? { ...d, ajustes: d.ajustes.filter((_, i) => i !== index) } : d));
  }

  onGuardarEdicion(): void {
    const draft = this.draft();
    if (!draft || this.saving() || this.errores().length > 0) {
      return;
    }
    this.saving.set(true);
    this.api.updateCrossAdjustments(this.companyPublicId(), this.crossPublicId(), aSolicitud(draft)).subscribe({
      next: (state) => {
        this.saving.set(false);
        this.state.set(state);
        this.draft.set(null);
        this.toast.success('Cambios guardados. Los ajustes siguen pendientes de aprobación.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toast.error(backendErrorMessage(error, 'No pudimos guardar los cambios.'));
      },
    });
  }

  onAprobar(): void {
    if (this.saving() || !this.acciones().revisar || this.draft()) {
      return;
    }
    this.saving.set(true);
    this.api.approveCrossAdjustments(this.companyPublicId(), this.crossPublicId()).subscribe({
      next: (state) => {
        this.saving.set(false);
        this.state.set(state);
        this.toast.success('Ajustes aprobados: ya forman parte del informe.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toast.error(backendErrorMessage(error, 'No pudimos aprobar los ajustes.'));
      },
    });
  }

  private mensajeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 503) {
        return 'La asistencia de IA no está disponible en este momento. El resto del informe no cambia.';
      }
      if (error.status === 502) {
        return 'La IA no devolvió una propuesta válida. Puedes intentarlo de nuevo.';
      }
    }
    return backendErrorMessage(error, 'No pudimos generar la propuesta de ajustes.');
  }
}
