import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { CompatibilityCrossSummary } from '../../../core/models/compatibility-cross';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { CompatibilityApiService } from '../compatibility-api-service';
import { CrossDetailDialog } from '../cross-detail-dialog/cross-detail-dialog';
import { CrossRanking } from '../cross-ranking/cross-ranking';

/**
 * Resultados de una persona: con que puestos de la empresa encaja.
 *
 * <p>Es el mismo dato que el Modo B del puesto, leido desde el otro lado. No
 * hay boton de recalculo aqui: los cruces de una persona se rehacen cuando se
 * publica su evaluacion, y los de un puesto desde el puesto.
 */
@Component({
  selector: 'app-applicant-crosses',
  imports: [RouterLink, CrossRanking, CrossDetailDialog],
  templateUrl: './applicant-crosses.html',
  styleUrl: './applicant-crosses.scss',
})
export class ApplicantCrosses {
  private readonly api = inject(CompatibilityApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly route = inject(ActivatedRoute);

  readonly company = this.companyContext.company;

  readonly crosses = signal<CompatibilityCrossSummary[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly detailOf = signal<string | null>(null);

  /** La persona se identifica por su nombre, que viene en cualquier cruce. */
  readonly applicantNombre = computed<string | null>(() => this.crosses()[0]?.contraparte ?? null);

  constructor() {
    this.load();
  }

  load(): void {
    const company = this.company();
    const applicantPublicId = this.route.snapshot.paramMap.get('applicantPublicId');

    if (!company || !applicantPublicId) {
      this.isLoading.set(false);
      this.loadError.set('No pudimos identificar al postulante.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    this.api.applicantCrosses(company.publicId, applicantPublicId).subscribe({
      next: (crosses) => {
        this.isLoading.set(false);
        this.crosses.set(crosses);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(
          error instanceof HttpErrorResponse && error.status === 404
            ? 'Este postulante no pertenece a la empresa.'
            : backendErrorMessage(error, 'No pudimos cargar los resultados.'),
        );
      },
    });
  }
}
