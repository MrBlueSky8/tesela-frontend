import { DatePipe } from '@angular/common';
import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';

import { AiLevelSuggestion } from '../../../core/models/position-evaluation';

/**
 * Panel de asistencia de IA de la evaluación de puesto.
 *
 * <p>Solo presenta: el estado (sugerencia, carga, oculto) lo lleva la página,
 * que es quien conoce el borrador. La IA propone y el evaluador decide; nada
 * de lo que muestra este panel cambia el borrador hasta que se guarda.
 */
@Component({
  selector: 'app-ai-suggestion-panel',
  imports: [DatePipe],
  templateUrl: './ai-suggestion-panel.html',
  styleUrl: './ai-suggestion-panel.scss',
})
export class AiSuggestionPanel {
  readonly suggestion = input<AiLevelSuggestion | null>(null);
  readonly loading = input(false);
  readonly hidden = input(false);
  /** Cuántas áreas vacías llenaría "Aplicar niveles". */
  readonly applicableLevels = input(0);
  /** Cambia cuando llega una propuesta nueva: el foco va al resumen. */
  readonly focusToken = input(0);

  readonly suggest = output<void>();
  readonly applyLevels = output<void>();
  readonly hide = output<void>();
  readonly show = output<void>();

  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');

  constructor() {
    effect(() => {
      if (this.focusToken() > 0) {
        queueMicrotask(() => this.summary()?.nativeElement.focus());
      }
    });
  }
}
