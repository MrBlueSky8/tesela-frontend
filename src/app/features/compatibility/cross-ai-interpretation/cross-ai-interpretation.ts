import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { CrossInterpretationState } from '../../../core/models/compatibility-cross';
import { ToastService } from '../../../core/services/toast-service';
import { AiOutputFrame } from '../ai-output-frame/ai-output-frame';
import { CompatibilityApiService } from '../compatibility-api-service';
import {
  InterpretationDraft,
  aSolicitud,
  accionesDe,
  borradorDe,
  erroresDe,
} from './interpretation-rules';

/**
 * Interpretación de las brechas de un cruce, asistida por IA (Hito 4, S5).
 *
 * <p>La IA genera un borrador; una persona lo revisa, lo corrige si hace falta
 * y lo aprueba. Solo una interpretación aprobada forma parte del informe, con
 * el sello de quién la revisó. Ayuda a leer el resultado: no es un veredicto
 * de contratación.
 */
@Component({
  selector: 'app-cross-ai-interpretation',
  imports: [AiOutputFrame],
  templateUrl: './cross-ai-interpretation.html',
  styleUrl: './cross-ai-interpretation.scss',
})
export class CrossAiInterpretation implements OnInit {
  private readonly api = inject(CompatibilityApiService);
  private readonly toast = inject(ToastService);

  readonly companyPublicId = input.required<string>();
  readonly crossPublicId = input.required<string>();
  /** En el informe: solo se muestra si está aprobada, sin acciones. */
  readonly printMode = input(false);

  readonly state = signal<CrossInterpretationState | null>(null);
  readonly isLoading = signal(true);
  readonly generating = signal(false);
  readonly saving = signal(false);
  /** Borrador en edición; nulo si no se está editando. */
  readonly draft = signal<InterpretationDraft | null>(null);

  readonly interpretacion = computed(() => this.state()?.interpretacion ?? null);
  readonly acciones = computed(() => accionesDe(this.state()));
  readonly errores = computed(() => {
    const draft = this.draft();
    return draft ? erroresDe(draft) : [];
  });

  /** En el constructor los input.required todavía no están enlazados. */
  ngOnInit(): void {
    this.api.crossInterpretation(this.companyPublicId(), this.crossPublicId()).subscribe({
      next: (state) => {
        this.isLoading.set(false);
        this.state.set(state);
      },
      // Si falla, la sección simplemente no ofrece la IA: el informe sigue completo.
      error: () => {
        this.isLoading.set(false);
        this.state.set({ permitida: false, motivo: null, interpretacion: null });
      },
    });
  }

  onGenerar(): void {
    if (this.generating() || !this.acciones().generar) {
      return;
    }
    this.generating.set(true);
    this.draft.set(null);
    this.api.interpretCross(this.companyPublicId(), this.crossPublicId()).subscribe({
      next: (state) => {
        this.generating.set(false);
        this.state.set(state);
        this.toast.success('Interpretación generada. Revísala antes de aprobarla.');
      },
      error: (error: unknown) => {
        this.generating.set(false);
        this.toast.error(this.mensajeError(error));
      },
    });
  }

  onEditar(): void {
    const interpretacion = this.interpretacion();
    if (interpretacion && this.acciones().revisar) {
      this.draft.set(borradorDe(interpretacion));
    }
  }

  onCancelarEdicion(): void {
    this.draft.set(null);
  }

  /** Actualiza un campo del borrador desde un textarea. */
  setCampo(campo: 'resumen' | 'consideraciones' | 'limitaciones', event: Event): void {
    const valor = (event.target as HTMLTextAreaElement).value;
    this.draft.update((d) => (d ? { ...d, [campo]: valor } : d));
  }

  setFactor(index: number, event: Event): void {
    const valor = (event.target as HTMLTextAreaElement).value;
    this.draft.update((d) =>
      d ? { ...d, factores: d.factores.map((f, i) => (i === index ? { ...f, explicacion: valor } : f)) } : d,
    );
  }

  quitarFactor(index: number): void {
    this.draft.update((d) => (d ? { ...d, factores: d.factores.filter((_, i) => i !== index) } : d));
  }

  onGuardarEdicion(): void {
    const draft = this.draft();
    if (!draft || this.saving() || this.errores().length > 0) {
      return;
    }
    this.saving.set(true);
    this.api
      .updateCrossInterpretation(this.companyPublicId(), this.crossPublicId(), aSolicitud(draft))
      .subscribe({
        next: (state) => {
          this.saving.set(false);
          this.state.set(state);
          this.draft.set(null);
          this.toast.success('Cambios guardados. La interpretación sigue pendiente de aprobación.');
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
    this.api.approveCrossInterpretation(this.companyPublicId(), this.crossPublicId()).subscribe({
      next: (state) => {
        this.saving.set(false);
        this.state.set(state);
        this.toast.success('Interpretación aprobada: ya forma parte del informe.');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.toast.error(backendErrorMessage(error, 'No pudimos aprobar la interpretación.'));
      },
    });
  }

  private mensajeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 503) {
        return 'La asistencia de IA no está disponible en este momento. El resto del informe no cambia.';
      }
      if (error.status === 502) {
        return 'La IA no devolvió una interpretación válida. Puedes intentarlo de nuevo.';
      }
    }
    return backendErrorMessage(error, 'No pudimos generar la interpretación.');
  }
}
