import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  ApplicantLookupResponse,
  ApplicantResponse,
  ApplicantSummaryResponse,
  CreateApplicantRequest,
  UpdateApplicantRequest,
} from '../../core/models/applicant';
import { MethodologyReference } from '../../core/models/methodology-reference';
import { ModuleStats, RecalculationBatch } from '../../core/models/module-stats';
import {
  CompatibilityCrossDetail,
  CompatibilityCrossSummary,
  CrossMode,
} from '../../core/models/compatibility-cross';
import {
  ApplicantEvaluationResponse,
  ApplicantEvaluationSummary,
  SaveApplicantEvaluationRequest,
} from '../../core/models/applicant-evaluation';
import {
  EvaluationAreaResponse,
  PositionEvaluationFields,
  PositionEvaluationResponse,
  PositionEvaluationSummary,
  SavePositionEvaluationRequest,
} from '../../core/models/position-evaluation';
import { ApiResponse } from '../../core/models/api-response';
import { DocumentType } from '../../core/models/user-profile-response';

/** Perfil del catálogo metodológico (20 perfiles, orden canónico 1-20). */
export interface DisabilityProfileCatalogItem {
  publicId: string;
  nombre: string;
  category: string | null;
  order: number | null;
  active: boolean;
}

/** Módulo 1: postulantes de la empresa y catálogo de perfiles. */
@Injectable({
  providedIn: 'root',
})
export class CompatibilityApiService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.base}/api`;

  /** Salen del catálogo metodológico: no cambian durante la sesión. */
  private profiles$: Observable<DisabilityProfileCatalogItem[]> | null = null;
  private areas$: Observable<EvaluationAreaResponse[]> | null = null;
  private fields$: Observable<PositionEvaluationFields> | null = null;
  private methodology$: Observable<MethodologyReference> | null = null;

  disabilityProfiles(): Observable<DisabilityProfileCatalogItem[]> {
    this.profiles$ ??= this.http
      .get<ApiResponse<DisabilityProfileCatalogItem[]>>(`${this.apiUrl}/catalogs/disability-profiles`)
      .pipe(
        map((response) => response.data.filter((profile) => profile.active)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.profiles$;
  }

  /** Las 30 áreas con su definición y los textos de sus cinco niveles. */
  evaluationAreas(): Observable<EvaluationAreaResponse[]> {
    this.areas$ ??= this.http
      .get<ApiResponse<EvaluationAreaResponse[]>>(`${this.apiUrl}/catalogs/evaluation-areas`)
      .pipe(
        map((response) => response.data),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.areas$;
  }

  /** Valores de los campos complementarios del puesto y de la criticidad. */
  positionEvaluationFields(): Observable<PositionEvaluationFields> {
    this.fields$ ??= this.http
      .get<ApiResponse<PositionEvaluationFields>>(`${this.apiUrl}/catalogs/position-evaluation-fields`)
      .pipe(
        map((response) => response.data),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.fields$;
  }

  // ---------------------------------------------------------------- Evaluación de puesto

  /** El borrador propio si existe; si no, la evaluación vigente. Null si no hay ninguna. */
  currentPositionEvaluation(
    companyPublicId: string,
    positionPublicId: string,
  ): Observable<PositionEvaluationResponse | null> {
    return this.http
      .get<ApiResponse<PositionEvaluationResponse | null>>(
        `${this.evaluationsUrl(companyPublicId, positionPublicId)}/current`,
      )
      .pipe(map((response) => response.data));
  }

  positionEvaluations(
    companyPublicId: string,
    positionPublicId: string,
  ): Observable<PositionEvaluationSummary[]> {
    return this.http
      .get<ApiResponse<PositionEvaluationSummary[]>>(
        this.evaluationsUrl(companyPublicId, positionPublicId),
      )
      .pipe(map((response) => response.data));
  }

  /** Abre un borrador, o devuelve el que ya tenga abierto quien llama. */
  startPositionEvaluation(
    companyPublicId: string,
    positionPublicId: string,
  ): Observable<PositionEvaluationResponse> {
    return this.http
      .post<ApiResponse<PositionEvaluationResponse>>(
        this.evaluationsUrl(companyPublicId, positionPublicId),
        {},
      )
      .pipe(map((response) => response.data));
  }

  savePositionEvaluation(
    companyPublicId: string,
    positionPublicId: string,
    evaluationPublicId: string,
    payload: SavePositionEvaluationRequest,
  ): Observable<PositionEvaluationResponse> {
    return this.http
      .put<ApiResponse<PositionEvaluationResponse>>(
        `${this.evaluationsUrl(companyPublicId, positionPublicId)}/${encodeURIComponent(evaluationPublicId)}`,
        payload,
      )
      .pipe(map((response) => response.data));
  }

  publishPositionEvaluation(
    companyPublicId: string,
    positionPublicId: string,
    evaluationPublicId: string,
  ): Observable<PositionEvaluationResponse> {
    return this.http
      .post<ApiResponse<PositionEvaluationResponse>>(
        `${this.evaluationsUrl(companyPublicId, positionPublicId)}/${encodeURIComponent(evaluationPublicId)}/publish`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  // ---------------------------------------------------------------- Evaluación de persona

  /** El borrador propio si existe; si no, la evaluación vigente. Null si no hay ninguna. */
  currentApplicantEvaluation(
    companyPublicId: string,
    applicantPublicId: string,
  ): Observable<ApplicantEvaluationResponse | null> {
    return this.http
      .get<ApiResponse<ApplicantEvaluationResponse | null>>(
        `${this.applicantEvaluationsUrl(companyPublicId, applicantPublicId)}/current`,
      )
      .pipe(map((response) => response.data));
  }

  applicantEvaluations(
    companyPublicId: string,
    applicantPublicId: string,
  ): Observable<ApplicantEvaluationSummary[]> {
    return this.http
      .get<ApiResponse<ApplicantEvaluationSummary[]>>(
        this.applicantEvaluationsUrl(companyPublicId, applicantPublicId),
      )
      .pipe(map((response) => response.data));
  }

  /** Abre un borrador, o devuelve el que ya tenga abierto quien llama. */
  startApplicantEvaluation(
    companyPublicId: string,
    applicantPublicId: string,
  ): Observable<ApplicantEvaluationResponse> {
    return this.http
      .post<ApiResponse<ApplicantEvaluationResponse>>(
        this.applicantEvaluationsUrl(companyPublicId, applicantPublicId),
        {},
      )
      .pipe(map((response) => response.data));
  }

  saveApplicantEvaluation(
    companyPublicId: string,
    applicantPublicId: string,
    evaluationPublicId: string,
    payload: SaveApplicantEvaluationRequest,
  ): Observable<ApplicantEvaluationResponse> {
    return this.http
      .put<ApiResponse<ApplicantEvaluationResponse>>(
        `${this.applicantEvaluationsUrl(companyPublicId, applicantPublicId)}`
          + `/${encodeURIComponent(evaluationPublicId)}`,
        payload,
      )
      .pipe(map((response) => response.data));
  }

  publishApplicantEvaluation(
    companyPublicId: string,
    applicantPublicId: string,
    evaluationPublicId: string,
  ): Observable<ApplicantEvaluationResponse> {
    return this.http
      .post<ApiResponse<ApplicantEvaluationResponse>>(
        `${this.applicantEvaluationsUrl(companyPublicId, applicantPublicId)}`
          + `/${encodeURIComponent(evaluationPublicId)}/publish`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  // ---------------------------------------------------------------- Resumen y método

  /** Foto del módulo en la empresa: cobertura, resultados y pendientes. */
  stats(companyPublicId: string): Observable<ModuleStats> {
    return this.http
      .get<ApiResponse<ModuleStats>>(
        `${this.apiUrl}/companies/${encodeURIComponent(companyPublicId)}/compatibility/stats`,
      )
      .pipe(map((response) => response.data));
  }

  /**
   * Recalcula una tanda de puestos desactualizados. No recalcula todo de una
   * vez: miles de cruces no caben en una petición, así que la pantalla repite
   * mientras queden.
   */
  recalculateStale(companyPublicId: string): Observable<RecalculationBatch> {
    return this.http
      .post<ApiResponse<RecalculationBatch>>(
        `${this.apiUrl}/companies/${encodeURIComponent(companyPublicId)}/crosses/recalculate-stale`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  /** Documentación del método, armada desde el catálogo real. */
  methodology(): Observable<MethodologyReference> {
    this.methodology$ ??= this.http
      .get<ApiResponse<MethodologyReference>>(`${this.apiUrl}/catalogs/methodology`)
      .pipe(
        map((response) => response.data),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.methodology$;
  }

  // ---------------------------------------------------------------- Cruces

  /** Ranking de puestos para un perfil de discapacidad (guía v3.1, 8.2). */
  profileCrosses(
    companyPublicId: string,
    profilePublicId: string,
  ): Observable<CompatibilityCrossSummary[]> {
    return this.http
      .get<ApiResponse<CompatibilityCrossSummary[]>>(
        `${this.apiUrl}/companies/${encodeURIComponent(companyPublicId)}`
          + `/disability-profiles/${encodeURIComponent(profilePublicId)}/crosses`,
      )
      .pipe(map((response) => response.data));
  }

  /** Ranking del puesto: Modo A son los 20 perfiles, Modo B las personas. */
  positionCrosses(
    companyPublicId: string,
    positionPublicId: string,
    modo: CrossMode,
  ): Observable<CompatibilityCrossSummary[]> {
    return this.http
      .get<ApiResponse<CompatibilityCrossSummary[]>>(
        `${this.apiUrl}/companies/${encodeURIComponent(companyPublicId)}`
          + `/positions/${encodeURIComponent(positionPublicId)}/crosses`,
        { params: new HttpParams().set('modo', modo) },
      )
      .pipe(map((response) => response.data));
  }

  /** Ranking de puestos para una persona evaluada. */
  applicantCrosses(
    companyPublicId: string,
    applicantPublicId: string,
  ): Observable<CompatibilityCrossSummary[]> {
    return this.http
      .get<ApiResponse<CompatibilityCrossSummary[]>>(
        `${this.applicantUrl(companyPublicId, applicantPublicId)}/crosses`,
      )
      .pipe(map((response) => response.data));
  }

  /** Detalle con el desglose por bolsa y las 30 áreas. */
  cross(companyPublicId: string, crossPublicId: string): Observable<CompatibilityCrossDetail> {
    return this.http
      .get<ApiResponse<CompatibilityCrossDetail>>(
        `${this.apiUrl}/companies/${encodeURIComponent(companyPublicId)}`
          + `/crosses/${encodeURIComponent(crossPublicId)}`,
      )
      .pipe(map((response) => response.data));
  }

  /** Recalcula los cruces del puesto; devuelve cuántos quedaron. */
  recalculatePositionCrosses(
    companyPublicId: string,
    positionPublicId: string,
  ): Observable<number> {
    return this.http
      .post<ApiResponse<number>>(
        `${this.apiUrl}/companies/${encodeURIComponent(companyPublicId)}`
          + `/positions/${encodeURIComponent(positionPublicId)}/crosses/recalculate`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  // ---------------------------------------------------------------- Postulantes

  list(companyPublicId: string): Observable<ApplicantSummaryResponse[]> {
    return this.http
      .get<ApiResponse<ApplicantSummaryResponse[]>>(this.applicantsUrl(companyPublicId))
      .pipe(map((response) => response.data));
  }

  get(companyPublicId: string, applicantPublicId: string): Observable<ApplicantResponse> {
    return this.http
      .get<ApiResponse<ApplicantResponse>>(this.applicantUrl(companyPublicId, applicantPublicId))
      .pipe(map((response) => response.data));
  }

  /** Primer paso del alta: qué hay registrado con ese documento. */
  lookup(
    companyPublicId: string,
    documentType: DocumentType,
    documentNumber: string,
  ): Observable<ApplicantLookupResponse> {
    const params = new HttpParams()
      .set('documentType', documentType)
      .set('documentNumber', documentNumber);
    return this.http
      .get<ApiResponse<ApplicantLookupResponse>>(`${this.applicantsUrl(companyPublicId)}/lookup`, {
        params,
      })
      .pipe(map((response) => response.data));
  }

  create(
    companyPublicId: string,
    payload: CreateApplicantRequest,
  ): Observable<ApplicantResponse> {
    return this.http
      .post<ApiResponse<ApplicantResponse>>(this.applicantsUrl(companyPublicId), payload)
      .pipe(map((response) => response.data));
  }

  update(
    companyPublicId: string,
    applicantPublicId: string,
    payload: UpdateApplicantRequest,
  ): Observable<ApplicantResponse> {
    return this.http
      .patch<ApiResponse<ApplicantResponse>>(
        this.applicantUrl(companyPublicId, applicantPublicId),
        payload,
      )
      .pipe(map((response) => response.data));
  }

  updateProfiles(
    companyPublicId: string,
    applicantPublicId: string,
    perfilPublicIds: string[],
  ): Observable<ApplicantResponse> {
    return this.http
      .patch<ApiResponse<ApplicantResponse>>(
        `${this.applicantUrl(companyPublicId, applicantPublicId)}/profiles`,
        { perfilPublicIds },
      )
      .pipe(map((response) => response.data));
  }

  private evaluationsUrl(companyPublicId: string, positionPublicId: string): string {
    return `${this.apiUrl}/companies/${encodeURIComponent(companyPublicId)}`
      + `/positions/${encodeURIComponent(positionPublicId)}/evaluations`;
  }

  private applicantEvaluationsUrl(companyPublicId: string, applicantPublicId: string): string {
    return `${this.applicantUrl(companyPublicId, applicantPublicId)}/evaluations`;
  }

  private applicantsUrl(companyPublicId: string): string {
    return `${this.apiUrl}/companies/${encodeURIComponent(companyPublicId)}/applicants`;
  }

  private applicantUrl(companyPublicId: string, applicantPublicId: string): string {
    return `${this.applicantsUrl(companyPublicId)}/${encodeURIComponent(applicantPublicId)}`;
  }
}
