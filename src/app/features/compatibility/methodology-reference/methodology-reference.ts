import { Component, inject, signal } from '@angular/core';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import {
  ALERT_TYPE_BADGES,
  ALERT_TYPE_LABELS,
  CRITICALITY_LABELS,
} from '../../../core/helpers/methodology-labels';
import { AreaCriticality, EvaluationAreaResponse } from '../../../core/models/position-evaluation';
import { MethodologyReference } from '../../../core/models/methodology-reference';
import { CompatibilityApiService } from '../compatibility-api-service';

const VERSION_LABELS: Partial<Record<string, string>> = {
  MATRIZ_GAP: 'Matriz GAP (niveles de referencia)',
  REGLAS_CALCULO: 'Reglas de cálculo',
  CATALOGO_ALERTAS: 'Catálogo de alertas',
};

/**
 * Documentacion del metodo, en solo lectura.
 *
 * <p>No es un texto copiado de la guia: el backend lo arma desde los enums
 * del motor y el catalogo sembrado, asi que esta pantalla describe lo que el
 * sistema aplica de verdad. Si manana cambia un techo, cambia aqui tambien.
 */
@Component({
  selector: 'app-methodology-reference',
  imports: [],
  templateUrl: './methodology-reference.html',
  styleUrl: './methodology-reference.scss',
})
export class MethodologyReferencePage {
  private readonly api = inject(CompatibilityApiService);

  readonly alertTypeLabels = ALERT_TYPE_LABELS;
  readonly alertTypeBadges = ALERT_TYPE_BADGES;
  readonly criticalityLabels = CRITICALITY_LABELS;

  readonly reference = signal<MethodologyReference | null>(null);
  readonly areas = signal<EvaluationAreaResponse[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly expandedAreas = signal(false);
  readonly expandedAlerts = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.methodology().subscribe({
      next: (reference) => {
        this.reference.set(reference);
        this.api.evaluationAreas().subscribe({
          next: (areas) => {
            this.isLoading.set(false);
            this.areas.set(areas);
          },
          error: () => this.isLoading.set(false),
        });
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar la metodología.'));
      },
    });
  }

  /** El tipo de versión llega como nombre de enum; aquí se humaniza. */
  versionLabel(tipo: string): string {
    return VERSION_LABELS[tipo] ?? tipo;
  }

  criticalityLabel(codigo: string): string {
    return this.criticalityLabels[codigo as AreaCriticality] ?? codigo;
  }

  toggleAreas(): void {
    this.expandedAreas.update((abierto) => !abierto);
  }

  toggleAlerts(): void {
    this.expandedAlerts.update((abierto) => !abierto);
  }
}
