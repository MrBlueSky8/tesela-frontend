import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import {
  CompanyMyAccessResponse,
  CompanyResponse,
  CreateCompanyRequest,
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
      .get<ApiResponse<CompanyResponse>>(`${this.apiUrl}/${encodeURIComponent(companyPublicId)}`)
      .pipe(map((response) => response.data));
  }

  create(payload: CreateCompanyRequest): Observable<CompanyResponse> {
    return this.http
      .post<ApiResponse<CompanyResponse>>(this.apiUrl, payload)
      .pipe(map((response) => response.data));
  }

  myAccess(companyPublicId: string): Observable<CompanyMyAccessResponse> {
    return this.http
      .get<ApiResponse<CompanyMyAccessResponse>>(
        `${this.apiUrl}/${encodeURIComponent(companyPublicId)}/my-access`,
      )
      .pipe(map((response) => response.data));
  }
}
