import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import { RecordStatus } from '../../core/models/organization';
import {
  AssignSiteEvaluatorRequest,
  CreateSiteRequest,
  SiteEvaluatorResponse,
  SiteResponse,
  UpdateSiteRequest,
} from '../../core/models/site';

/** Sedes de una empresa y asignacion de evaluadores. */
@Injectable({
  providedIn: 'root',
})
export class SitesApiService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.base}/api/companies`;

  list(companyPublicId: string): Observable<SiteResponse[]> {
    return this.http
      .get<ApiResponse<SiteResponse[]>>(this.sitesUrl(companyPublicId))
      .pipe(map((response) => response.data));
  }

  get(companyPublicId: string, sitePublicId: string): Observable<SiteResponse> {
    return this.http
      .get<ApiResponse<SiteResponse>>(this.siteUrl(companyPublicId, sitePublicId))
      .pipe(map((response) => response.data));
  }

  create(companyPublicId: string, payload: CreateSiteRequest): Observable<SiteResponse> {
    return this.http
      .post<ApiResponse<SiteResponse>>(this.sitesUrl(companyPublicId), payload)
      .pipe(map((response) => response.data));
  }

  update(
    companyPublicId: string,
    sitePublicId: string,
    payload: UpdateSiteRequest,
  ): Observable<SiteResponse> {
    return this.http
      .patch<ApiResponse<SiteResponse>>(this.siteUrl(companyPublicId, sitePublicId), payload)
      .pipe(map((response) => response.data));
  }

  /** Asignaciones de toda la empresa (activas e inactivas) en una sola llamada. */
  assignments(companyPublicId: string): Observable<SiteEvaluatorResponse[]> {
    return this.http
      .get<ApiResponse<SiteEvaluatorResponse[]>>(`${this.sitesUrl(companyPublicId)}/assignments`)
      .pipe(map((response) => response.data));
  }

  evaluators(companyPublicId: string, sitePublicId: string): Observable<SiteEvaluatorResponse[]> {
    return this.http
      .get<ApiResponse<SiteEvaluatorResponse[]>>(
        `${this.siteUrl(companyPublicId, sitePublicId)}/evaluators`,
      )
      .pipe(map((response) => response.data));
  }

  assign(
    companyPublicId: string,
    sitePublicId: string,
    payload: AssignSiteEvaluatorRequest,
  ): Observable<SiteEvaluatorResponse> {
    return this.http
      .post<ApiResponse<SiteEvaluatorResponse>>(
        `${this.siteUrl(companyPublicId, sitePublicId)}/evaluators`,
        payload,
      )
      .pipe(map((response) => response.data));
  }

  setAssignmentStatus(
    companyPublicId: string,
    sitePublicId: string,
    assignmentPublicId: string,
    status: RecordStatus,
  ): Observable<SiteEvaluatorResponse> {
    return this.http
      .patch<ApiResponse<SiteEvaluatorResponse>>(
        `${this.siteUrl(companyPublicId, sitePublicId)}/evaluators/${encodeURIComponent(assignmentPublicId)}`,
        { status },
      )
      .pipe(map((response) => response.data));
  }

  private sitesUrl(companyPublicId: string): string {
    return `${this.apiUrl}/${encodeURIComponent(companyPublicId)}/sites`;
  }

  private siteUrl(companyPublicId: string, sitePublicId: string): string {
    return `${this.sitesUrl(companyPublicId)}/${encodeURIComponent(sitePublicId)}`;
  }
}
