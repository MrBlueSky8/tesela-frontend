import { DatePipe, Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { CATEGORY_BADGES, CRITICALITY_LABELS } from '../../../core/helpers/methodology-labels';
import {
  CompatibilityCrossDetail,
  CrossAdjustmentsState,
  CrossInterpretationState,
} from '../../../core/models/compatibility-cross';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { CompatibilityApiService } from '../compatibility-api-service';
import { CrossAiAdjustments } from '../cross-ai-adjustments/cross-ai-adjustments';
import { CrossAiInterpretation } from '../cross-ai-interpretation/cross-ai-interpretation';
import { CrossAlerts } from '../cross-alerts/cross-alerts';

/**
 * Informe de compatibilidad en formato estándar (Hito 4, entregable 7).
 *
 * <p>Sigue la estructura de la guía v3.1 (7.5): 1 alertas de seguridad,
 * 2 porcentaje y desglose, 3 alertas informativas y 4 ajustes razonables. Del
 * contenido asistido por IA solo entra lo que una persona aprobó, con su sello.
 * Se imprime o se guarda como PDF desde el navegador: el Anexo 1 excluye los
 * reportes PDF avanzados, así que no hay generador en el servidor.
 */
@Component({
  selector: 'app-compatibility-report',
  imports: [DatePipe, CrossAlerts, CrossAiInterpretation, CrossAiAdjustments],
  templateUrl: './compatibility-report.html',
  styleUrl: './compatibility-report.scss',
})
export class CompatibilityReport {
  private readonly api = inject(CompatibilityApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly companyContext = inject(CompanyContextService);

  readonly company = this.companyContext.company;
  readonly crossPublicId = this.route.snapshot.paramMap.get('crossPublicId') ?? '';
  readonly emitidoEn = new Date();
  readonly categoryBadges = CATEGORY_BADGES;
  readonly criticalityLabels = CRITICALITY_LABELS;

  readonly cross = signal<CompatibilityCrossDetail | null>(null);
  readonly interpretacion = signal<CrossInterpretationState | null>(null);
  readonly ajustes = signal<CrossAdjustmentsState | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly alertasSeguridad = computed(() => this.cross()?.alertas.filter((a) => a.seguridad) ?? []);
  readonly alertasInformativas = computed(() => this.cross()?.alertas.filter((a) => !a.seguridad) ?? []);
  readonly areasConBrecha = computed(() => this.cross()?.areas.filter((a) => a.brecha > 0) ?? []);

  readonly bolsas = computed(() => {
    const c = this.cross();
    if (!c) return [];
    return [
      { nombre: 'Normal', peso: c.pesoNormal, promedio: c.promedioNormal },
      { nombre: 'Alta', peso: c.pesoAlto, promedio: c.promedioAlto },
      { nombre: 'Crítica', peso: c.pesoCritico, promedio: c.promedioCritico },
    ].filter((b) => b.peso > 0);
  });

  /** Hay IA sin revisar: el informe lo dice en vez de omitirlo en silencio. */
  readonly iaPendiente = computed(
    () =>
      this.interpretacion()?.interpretacion?.estado === 'BORRADOR' ||
      this.ajustes()?.propuesta?.estado === 'BORRADOR',
  );
  readonly ajustesAprobados = computed(() => this.ajustes()?.propuesta?.estado === 'APROBADA');

  constructor() {
    const company = this.company();
    if (!company || !this.crossPublicId) {
      this.isLoading.set(false);
      this.loadError.set('No pudimos identificar el cruce.');
      return;
    }
    forkJoin({
      cross: this.api.cross(company.publicId, this.crossPublicId),
      interpretacion: this.api.crossInterpretation(company.publicId, this.crossPublicId).pipe(catchError(() => of(null))),
      ajustes: this.api.crossAdjustments(company.publicId, this.crossPublicId).pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ cross, interpretacion, ajustes }) => {
        this.isLoading.set(false);
        this.cross.set(cross);
        this.interpretacion.set(interpretacion);
        this.ajustes.set(ajustes);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar el informe.'));
      },
    });
  }

  imprimir(): void {
    window.print();
  }

  volver(): void {
    this.location.back();
  }

  porcentaje(peso: number): string {
    return `${Math.round(peso * 1000) / 10} %`;
  }

  redondear(valor: number | null): string {
    return valor === null ? '—' : (Math.round(valor * 100) / 100).toString();
  }
}
