import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import {
  CompanyMyAccessResponse,
  CompanyResponse,
  CompanyStatus,
  CreateCompanyRequest,
  UpdateCompanyRequest,
} from '../../core/models/company';

@Injectable({
  providedIn: 'root',
})
export class CompanyApiService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.base}/api/companies`;

  /** ADMIN_PLATAFORMA recibe todas; un usuario, solo sus empresas activas. */
  list(): Observable<CompanyResponse[]> {
    return this.http
      .get<ApiResponse<CompanyResponse[]>>(this.apiUrl)
      .pipe(map((response) => response.data));
  }

  get(companyPublicId: string): Observable<CompanyResponse> {
    return this.http
      .get<ApiResponse<CompanyResponse>>(this.companyUrl(companyPublicId))
      .pipe(map((response) => response.data));
  }

  create(payload: CreateCompanyRequest): Observable<CompanyResponse> {
    return this.http
      .post<ApiResponse<CompanyResponse>>(this.apiUrl, payload)
      .pipe(map((response) => response.data));
  }

  update(companyPublicId: string, payload: UpdateCompanyRequest): Observable<CompanyResponse> {
    return this.http
      .patch<ApiResponse<CompanyResponse>>(this.companyUrl(companyPublicId), payload)
      .pipe(map((response) => response.data));
  }

  /** Sin Content-Type explicito: con FormData el navegador pone el boundary. */
  uploadLogo(companyPublicId: string, file: File): Observable<CompanyResponse> {
    const body = new FormData();
    body.append('file', file);

    return this.http
      .post<ApiResponse<CompanyResponse>>(`${this.companyUrl(companyPublicId)}/logo`, body)
      .pipe(map((response) => response.data));
  }

  deleteLogo(companyPublicId: string): Observable<CompanyResponse> {
    return this.http
      .delete<ApiResponse<CompanyResponse>>(`${this.companyUrl(companyPublicId)}/logo`)
      .pipe(map((response) => response.data));
  }

  /** Solo ADMIN_PLATAFORMA. */
  updateStatus(companyPublicId: string, status: CompanyStatus): Observable<CompanyResponse> {
    return this.http
      .patch<ApiResponse<CompanyResponse>>(`${this.companyUrl(companyPublicId)}/status`, { status })
      .pipe(map((response) => response.data));
  }

  /** Solo ADMIN_PLATAFORMA. */
  updateAdminLimit(companyPublicId: string, adminLimit: number): Observable<CompanyResponse> {
    return this.http
      .patch<ApiResponse<CompanyResponse>>(`${this.companyUrl(companyPublicId)}/admin-limit`, {
        adminLimit,
      })
      .pipe(map((response) => response.data));
  }

  myAccess(companyPublicId: string): Observable<CompanyMyAccessResponse> {
    return this.http
      .get<ApiResponse<CompanyMyAccessResponse>>(`${this.companyUrl(companyPublicId)}/my-access`)
      .pipe(map((response) => response.data));
  }

  private companyUrl(companyPublicId: string): string {
    return `${this.apiUrl}/${encodeURIComponent(companyPublicId)}`;
  }
}
