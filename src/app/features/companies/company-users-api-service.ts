import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import { CompanyPrivilegeResponse } from '../../core/models/company';
import {
  AddCompanyUserRequest,
  AssignableUserResponse,
  CompanyMemberDetailResponse,
  CompanyMembershipResponse,
  CreateCompanyUserRequest,
  UpdateCompanyMembershipRequest,
  UpdateMemberPersonRequest,
} from '../../core/models/company-membership';

/** Miembros de una empresa. Aparte de CompanyApiService para no inflarlo. */
@Injectable({
  providedIn: 'root',
})
export class CompanyUsersApiService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.base}/api`;

  /** El catalogo no cambia en la sesion: se pide una vez. Un error no queda cacheado. */
  private privileges$: Observable<CompanyPrivilegeResponse[]> | null = null;

  privileges(): Observable<CompanyPrivilegeResponse[]> {
    this.privileges$ ??= this.http
      .get<ApiResponse<CompanyPrivilegeResponse[]>>(`${this.apiUrl}/company-privileges`)
      .pipe(
        map((response) => response.data),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.privileges$;
  }

  list(companyPublicId: string): Observable<CompanyMembershipResponse[]> {
    return this.http
      .get<ApiResponse<CompanyMembershipResponse[]>>(this.usersUrl(companyPublicId))
      .pipe(map((response) => response.data));
  }

  /** El backend exige al menos 3 caracteres y devuelve como mucho 20 resultados. */
  searchAssignable(companyPublicId: string, search: string): Observable<AssignableUserResponse[]> {
    return this.http
      .get<ApiResponse<AssignableUserResponse[]>>(
        `${this.companyUrl(companyPublicId)}/assignable-users`,
        { params: new HttpParams().set('search', search) },
      )
      .pipe(map((response) => response.data));
  }

  add(
    companyPublicId: string,
    payload: AddCompanyUserRequest,
  ): Observable<CompanyMembershipResponse> {
    return this.http
      .post<ApiResponse<CompanyMembershipResponse>>(this.usersUrl(companyPublicId), payload)
      .pipe(map((response) => response.data));
  }

  create(
    companyPublicId: string,
    payload: CreateCompanyUserRequest,
  ): Observable<CompanyMembershipResponse> {
    return this.http
      .post<ApiResponse<CompanyMembershipResponse>>(
        `${this.usersUrl(companyPublicId)}/new`,
        payload,
      )
      .pipe(map((response) => response.data));
  }

  update(
    companyPublicId: string,
    membershipPublicId: string,
    payload: UpdateCompanyMembershipRequest,
  ): Observable<CompanyMembershipResponse> {
    return this.http
      .patch<ApiResponse<CompanyMembershipResponse>>(
        `${this.usersUrl(companyPublicId)}/${encodeURIComponent(membershipPublicId)}`,
        payload,
      )
      .pipe(map((response) => response.data));
  }

  /** Ficha del miembro: incluye los datos de la persona. */
  get(companyPublicId: string, membershipPublicId: string): Observable<CompanyMemberDetailResponse> {
    return this.http
      .get<ApiResponse<CompanyMemberDetailResponse>>(this.memberUrl(companyPublicId, membershipPublicId))
      .pipe(map((response) => response.data));
  }

  /** Solo datos de contacto; el backend ignora cualquier dato de identidad. */
  updatePerson(
    companyPublicId: string,
    membershipPublicId: string,
    payload: UpdateMemberPersonRequest,
  ): Observable<CompanyMemberDetailResponse> {
    return this.http
      .patch<ApiResponse<CompanyMemberDetailResponse>>(
        `${this.memberUrl(companyPublicId, membershipPublicId)}/person`,
        payload,
      )
      .pipe(map((response) => response.data));
  }

  resendCredentials(
    companyPublicId: string,
    membershipPublicId: string,
  ): Observable<CompanyMembershipResponse> {
    return this.http
      .post<ApiResponse<CompanyMembershipResponse>>(
        `${this.usersUrl(companyPublicId)}/${encodeURIComponent(membershipPublicId)}/resend-credentials`,
        {},
      )
      .pipe(map((response) => response.data));
  }

  private memberUrl(companyPublicId: string, membershipPublicId: string): string {
    return `${this.usersUrl(companyPublicId)}/${encodeURIComponent(membershipPublicId)}`;
  }

  private companyUrl(companyPublicId: string): string {
    return `${this.apiUrl}/companies/${encodeURIComponent(companyPublicId)}`;
  }

  private usersUrl(companyPublicId: string): string {
    return `${this.companyUrl(companyPublicId)}/users`;
  }
}
