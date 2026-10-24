import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { CATEGORY_BADGES, CATEGORY_LABELS } from '../../../core/helpers/methodology-labels';
import { CompatibilityCategory } from '../../../core/models/compatibility-cross';
import { ModuleStats } from '../../../core/models/module-stats';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { ToastService } from '../../../core/services/toast-service';
import { CompatibilityApiService } from '../compatibility-api-service';

/** Una categoría con su cuenta y su porcentaje dentro del modo. */
interface CategoryBar {
  categoria: CompatibilityCategory;
  etiqueta: string;
  badge: string;
  total: number;
  porcentaje: number;
}

/**
 * Resumen del Modulo 1: que esta cubierto, como se reparten los resultados y
 * que queda pendiente.
 *
 * <p>El recalculo de cruces desactualizados va por tandas: el backend procesa
 * unos pocos puestos y dice cuantos quedan, y esta pantalla repite hasta
 * terminar. No es un capricho: una empresa mediana son miles de cruces y en
 * una sola peticion no caben.
 */
@Component({
  selector: 'app-module-overview',
  imports: [RouterLink],
  templateUrl: './module-overview.html',
  styleUrl: './module-overview.scss',
})
export class ModuleOverview {
  private readonly api = inject(CompatibilityApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly toast = inject(ToastService);

  readonly company = this.companyContext.company;

  readonly stats = signal<ModuleStats | null>(null);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly isRecalculating = signal(false);
  readonly restantes = signal<number | null>(null);

  readonly cobertura = computed(() => {
    const stats = this.stats();
    if (!stats || stats.puestosActivos === 0) {
      return 0;
    }
    return Math.round((stats.puestosEvaluados / stats.puestosActivos) * 100);
  });

  readonly modoA = computed(() => this.barras(this.stats()?.categoriasModoA));
  readonly modoB = computed(() => this.barras(this.stats()?.categoriasModoB));

  constructor() {
    this.load();
  }

  load(): void {
    const company = this.company();

    if (!company) {
      this.isLoading.set(false);
      this.loadError.set('No hay una empresa seleccionada.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.stats(company.publicId).subscribe({
      next: (stats) => {
        this.isLoading.set(false);
        this.stats.set(stats);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar el resumen.'));
      },
    });
  }

  /** Lanza la primera tanda; las siguientes se encadenan solas. */
  onRecalculate(): void {
    if (this.isRecalculating()) {
      return;
    }
    this.isRecalculating.set(true);
    this.siguienteTanda(0);
  }

  private siguienteTanda(acumulado: number): void {
    const company = this.company();

    if (!company) {
      this.isRecalculating.set(false);
      return;
    }

    this.api.recalculateStale(company.publicId).subscribe({
      next: (tanda) => {
        const total = acumulado + tanda.procesados;
        this.restantes.set(tanda.restantes);

        // Sin avance no se reintenta: repetir una tanda vacía sería un bucle.
        if (tanda.restantes > 0 && tanda.procesados > 0) {
          this.siguienteTanda(total);
          return;
        }
        this.isRecalculating.set(false);
        this.restantes.set(null);
        this.toast.success(`${total} puestos recalculados con la metodología vigente.`);
        this.load();
      },
      error: (error: unknown) => {
        this.isRecalculating.set(false);
        this.restantes.set(null);
        this.toast.error(backendErrorMessage(error, 'No pudimos recalcular los cruces.'));
      },
    });
  }

  private barras(conteo: Record<CompatibilityCategory, number> | undefined): CategoryBar[] {
    if (!conteo) {
      return [];
    }
    const total = Object.values(conteo).reduce((suma, valor) => suma + valor, 0);
    if (total === 0) {
      return [];
    }
    return (Object.keys(CATEGORY_LABELS) as CompatibilityCategory[]).map((categoria) => ({
      categoria,
      etiqueta: CATEGORY_LABELS[categoria],
      badge: CATEGORY_BADGES[categoria],
      total: conteo[categoria] ?? 0,
      porcentaje: Math.round(((conteo[categoria] ?? 0) / total) * 100),
    }));
  }
}
