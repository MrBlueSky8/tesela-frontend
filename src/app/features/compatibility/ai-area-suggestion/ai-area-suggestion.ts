import { Component, computed, input, output } from '@angular/core';

import {
  CONFIDENCE_HINTS,
  CONFIDENCE_LABELS,
  CRITICALITY_LABELS,
} from '../../../core/helpers/methodology-labels';
import { AiAreaSuggestion } from '../../../core/models/position-evaluation';
import { AreaValue, estadoFrenteASugerencia } from '../ai-suggestion/ai-suggestion-rules';

/**
 * Lo que la IA propone para un área, dentro de la tarjeta del área.
 *
 * <p>"Aceptar" aplica nivel y criticidad: es la confirmación explícita, área
 * por área, que pide la criticidad. "Solo el nivel" deja la criticidad al
 * evaluador. El indicador replica la regla del servidor, así que lo que dice
 * es el origen con el que se guardará.
 */
@Component({
  selector: 'app-ai-area-suggestion',
  imports: [],
  templateUrl: './ai-area-suggestion.html',
  styleUrl: './ai-area-suggestion.scss',
})
export class AiAreaSuggestionCard {
  readonly suggestion = input.required<AiAreaSuggestion>();
  readonly value = input<AreaValue | undefined>(undefined);
  readonly editable = input(true);

  readonly accept = output<void>();
  readonly levelOnly = output<void>();
  readonly dismiss = output<void>();

  readonly criticalityLabels = CRITICALITY_LABELS;
  readonly confidenceLabels = CONFIDENCE_LABELS;
  readonly confidenceHints = CONFIDENCE_HINTS;

  readonly state = computed(() => estadoFrenteASugerencia(this.value(), this.suggestion()));

  /** "Solo el nivel" sobra si el nivel ya es el sugerido. */
  readonly levelAlreadySet = computed(
    () => this.value()?.nivelExigencia === this.suggestion().nivel,
  );
}
