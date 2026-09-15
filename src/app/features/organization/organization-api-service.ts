import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import {
  CreateDepartmentRequest,
  CreatePositionRequest,
  DepartmentResponse,
  JobConditionResponse,
  PositionResponse,
  UpdateDepartmentRequest,
  UpdatePositionRequest,
} from '../../core/models/organization';

/** Departamentos, catalogo de puestos y condiciones laborales de una empresa. */
@Injectable({
  providedIn: 'root',
})
export class OrganizationApiService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.base}/api`;

  /** Sale de un enum del backend: no cambia en la sesion. Un error no queda cacheado. */
  private jobConditions$: Observable<JobConditionResponse[]> | null = null;

  jobConditions(): Observable<JobConditionResponse[]> {
    this.jobConditions$ ??= this.http
      .get<ApiResponse<JobConditionResponse[]>>(`${this.apiUrl}/catalogs/job-conditions`)
      .pipe(
        map((response) => response.data),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.jobConditions$;
  }

  // ---------------------------------------------------------------- Departamentos

  listDepartments(companyPublicId: string): Observable<DepartmentResponse[]> {
    return this.http
      .get<ApiResponse<DepartmentResponse[]>>(this.departmentsUrl(companyPublicId))
      .pipe(map((response) => response.data));
  }

  createDepartment(
    companyPublicId: string,
    payload: CreateDepartmentRequest,
  ): Observable<DepartmentResponse> {
    return this.http
      .post<ApiResponse<DepartmentResponse>>(this.departmentsUrl(companyPublicId), payload)
      .pipe(map((response) => response.data));
  }

  updateDepartment(
    companyPublicId: string,
    departmentPublicId: string,
    payload: UpdateDepartmentRequest,
  ): Observable<DepartmentResponse> {
    return this.http
      .patch<ApiResponse<DepartmentResponse>>(
        `${this.departmentsUrl(companyPublicId)}/${encodeURIComponent(departmentPublicId)}`,
        payload,
      )
      .pipe(map((response) => response.data));
  }

  // ---------------------------------------------------------------- Puestos

  listPositions(companyPublicId: string): Observable<PositionResponse[]> {
    return this.http
      .get<ApiResponse<PositionResponse[]>>(this.positionsUrl(companyPublicId))
      .pipe(map((response) => response.data));
  }

  getPosition(companyPublicId: string, positionPublicId: string): Observable<PositionResponse> {
    return this.http
      .get<ApiResponse<PositionResponse>>(
        `${this.positionsUrl(companyPublicId)}/${encodeURIComponent(positionPublicId)}`,
      )
      .pipe(map((response) => response.data));
  }

  createPosition(
    companyPublicId: string,
    payload: CreatePositionRequest,
  ): Observable<PositionResponse> {
    return this.http
      .post<ApiResponse<PositionResponse>>(this.positionsUrl(companyPublicId), payload)
      .pipe(map((response) => response.data));
  }

  updatePosition(
    companyPublicId: string,
    positionPublicId: string,
    payload: UpdatePositionRequest,
  ): Observable<PositionResponse> {
    return this.http
      .patch<ApiResponse<PositionResponse>>(
        `${this.positionsUrl(companyPublicId)}/${encodeURIComponent(positionPublicId)}`,
        payload,
      )
      .pipe(map((response) => response.data));
  }

  private companyUrl(companyPublicId: string): string {
    return `${this.apiUrl}/companies/${encodeURIComponent(companyPublicId)}`;
  }

  private departmentsUrl(companyPublicId: string): string {
    return `${this.companyUrl(companyPublicId)}/departments`;
  }

  private positionsUrl(companyPublicId: string): string {
    return `${this.companyUrl(companyPublicId)}/positions`;
  }
}
