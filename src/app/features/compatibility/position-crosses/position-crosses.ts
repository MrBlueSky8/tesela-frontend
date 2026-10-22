import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { transientMessage } from '../../../core/helpers/transient-message';
import { CompatibilityCrossSummary, CrossMode } from '../../../core/models/compatibility-cross';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { CompatibilityApiService } from '../compatibility-api-service';
import { CrossDetailDialog } from '../cross-detail-dialog/cross-detail-dialog';
import { CrossRanking } from '../cross-ranking/cross-ranking';

/**
 * Resultados de compatibilidad de un puesto.
 *
 * <p>Dos listas, porque responden a preguntas distintas: el Modo A dice que
 * perfiles de discapacidad encajan con el puesto tal como esta definido, y el
 * Modo B, que personas concretas de la empresa lo hacen. El Modo A no habla
 * de nadie en particular: es el puesto mirado contra la Matriz GAP.
 */
@Component({
  selector: 'app-position-crosses',
  imports: [RouterLink, CrossRanking, CrossDetailDialog],
  templateUrl: './position-crosses.html',
  styleUrl: './position-crosses.scss',
})
export class PositionCrosses {
  private readonly api = inject(CompatibilityApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly route = inject(ActivatedRoute);

  readonly company = this.companyContext.company;

  readonly perfiles = signal<CompatibilityCrossSummary[]>([]);
  readonly personas = signal<CompatibilityCrossSummary[]>([]);
  readonly modo = signal<CrossMode>('A');

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly isRecalculating = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly notice = transientMessage();

  readonly detailOf = signal<string | null>(null);

  readonly actuales = computed(() => (this.modo() === 'A' ? this.perfiles() : this.personas()));

  /** El puesto se identifica por su nombre, que viene en cualquier cruce. */
  readonly positionNombre = computed<string | null>(
    () => this.perfiles()[0]?.puestoNombre ?? this.personas()[0]?.puestoNombre ?? null,
  );

  readonly sinResultados = computed(
    () => !this.isLoading() && this.perfiles().length === 0 && this.personas().length === 0,
  );

  constructor() {
    this.load();
  }

  load(): void {
    const company = this.company();
    const positionPublicId = this.route.snapshot.paramMap.get('positionPublicId');

    if (!company || !positionPublicId) {
      this.isLoading.set(false);
      this.loadError.set('No pudimos identificar el puesto.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      perfiles: this.api.positionCrosses(company.publicId, positionPublicId, 'A'),
      personas: this.api.positionCrosses(company.publicId, positionPublicId, 'B'),
    }).subscribe({
      next: ({ perfiles, personas }) => {
        this.isLoading.set(false);
        this.perfiles.set(perfiles);
        this.personas.set(personas);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(
          error instanceof HttpErrorResponse && error.status === 404
            ? 'Este puesto no pertenece a la empresa.'
            : backendErrorMessage(error, 'No pudimos cargar los resultados.'),
        );
      },
    });
  }

  setModo(modo: CrossMode): void {
    this.modo.set(modo);
  }

  onRecalculate(): void {
    const company = this.company();
    const positionPublicId = this.route.snapshot.paramMap.get('positionPublicId');

    if (!company || !positionPublicId || this.isRecalculating()) {
      return;
    }

    this.isRecalculating.set(true);
    this.actionError.set(null);

    this.api.recalculatePositionCrosses(company.publicId, positionPublicId).subscribe({
      next: (cuantos) => {
        this.isRecalculating.set(false);
        this.notice.set(`${cuantos} cruces recalculados con la metodología vigente.`);
        this.load();
      },
      error: (error: unknown) => {
        this.isRecalculating.set(false);
        this.actionError.set(backendErrorMessage(error, 'No pudimos recalcular los cruces.'));
      },
    });
  }
}
