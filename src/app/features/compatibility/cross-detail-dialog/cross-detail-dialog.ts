import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import {
  CATEGORY_BADGES,
  CRITICALITY_LABELS,
} from '../../../core/helpers/methodology-labels';
import { CompatibilityCrossDetail } from '../../../core/models/compatibility-cross';
import { ModalShell } from '../../../shared/components/modal-shell/modal-shell';
import { CrossAlerts } from '../cross-alerts/cross-alerts';
import { CompatibilityApiService } from '../compatibility-api-service';

/**
 * Explicacion de un resultado de compatibilidad.
 *
 * <p>El porcentaje solo es defendible si se puede reconstruir: por eso aqui
 * estan las tres bolsas con su peso y su promedio, el techo si intervino y
 * las 30 areas con su brecha. Es lo que la guia v3.1 pide mostrar (7.5).
 */
@Component({
  selector: 'app-cross-detail-dialog',
  imports: [ModalShell, CrossAlerts],
  templateUrl: './cross-detail-dialog.html',
  styleUrl: './cross-detail-dialog.scss',
})
export class CrossDetailDialog implements OnInit {
  private readonly api = inject(CompatibilityApiService);

  readonly companyPublicId = input.required<string>();
  readonly crossPublicId = input.required<string>();

  readonly closed = output<void>();

  readonly categoryBadges = CATEGORY_BADGES;
  readonly criticalityLabels = CRITICALITY_LABELS;

  readonly cross = signal<CompatibilityCrossDetail | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  /** Sección 1 del informe: abren, con máxima visibilidad. */
  readonly alertasSeguridad = computed(
    () => this.cross()?.alertas.filter((alerta) => alerta.seguridad) ?? [],
  );

  /** Sección 3: perfil, ajustes y motivación. */
  readonly alertasInformativas = computed(
    () => this.cross()?.alertas.filter((alerta) => !alerta.seguridad) ?? [],
  );

  /** Las tres bolsas, saltando las que el puesto no usó. */
  readonly bolsas = computed(() => {
    const cross = this.cross();
    if (!cross) {
      return [];
    }
    return [
      { nombre: 'Normal', peso: cross.pesoNormal, promedio: cross.promedioNormal },
      { nombre: 'Alta', peso: cross.pesoAlto, promedio: cross.promedioAlto },
      { nombre: 'Crítica', peso: cross.pesoCritico, promedio: cross.promedioCritico },
    ].filter((bolsa) => bolsa.promedio !== null);
  });

  /** En el constructor los input.required todavia no estan enlazados. */
  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.cross(this.companyPublicId(), this.crossPublicId()).subscribe({
      next: (cross) => {
        this.isLoading.set(false);
        this.cross.set(cross);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar el detalle del cruce.'));
      },
    });
  }

  /** Los códigos de las no evaluadas, para citarlos en una línea. */
  readonly codigosNoEvaluados = computed(
    () => (this.cross()?.alertasNoEvaluadas ?? []).map((alerta) => alerta.codigo).join(', '),
  );

  /** Los pesos llegan en tanto por uno; en pantalla se leen como porcentaje. */
  porcentaje(peso: number): string {
    return `${Math.round(peso * 100)} %`;
  }

  redondear(valor: number | null): string {
    return valor === null ? '—' : valor.toFixed(2);
  }
}
