import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import { DocumentType, Gender, UserStatus } from '../../core/models/user-profile-response';

export type PersonStatus = 'ACTIVE' | 'INACTIVE' | 'DELETED';

/** Espejo de user/dto/AdminPersonResponse. */
export interface AdminPersonResponse {
  publicId: string;
  documentType: DocumentType;
  documentNumber: string;
  firstNames: string;
  lastNames: string;
  birthDate: string | null;
  gender: Gender | null;
  address: string | null;
  phone: string | null;
  status: PersonStatus;
  accounts: { publicId: string; email: string; status: UserStatus }[];
  updatedAt: string;
}

/** PATCH parcial (UpdatePersonRequest). Texto vacio borra direccion o telefono. */
export type UpdatePersonRequest = Partial<
  Pick<
    AdminPersonResponse,
    'documentType' | 'documentNumber' | 'firstNames' | 'lastNames' | 'gender'
  > & { birthDate: string; address: string; phone: string }
>;

/** Soporte de datos personales. Solo ADMIN_PLATAFORMA (/api/admin/**). */
@Injectable({
  providedIn: 'root',
})
export class PeopleApiService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.base}/api/admin/people`;

  /** Busqueda exacta: el backend no ofrece listado ni coincidencias parciales. */
  findByDocument(documentType: DocumentType, documentNumber: string): Observable<AdminPersonResponse> {
    const params = new HttpParams().set('documentType', documentType).set('documentNumber', documentNumber);
    return this.http
      .get<ApiResponse<AdminPersonResponse>>(this.apiUrl, { params })
      .pipe(map((response) => response.data));
  }

  update(personPublicId: string, payload: UpdatePersonRequest): Observable<AdminPersonResponse> {
    return this.http
      .patch<ApiResponse<AdminPersonResponse>>(`${this.apiUrl}/${encodeURIComponent(personPublicId)}`, payload)
      .pipe(map((response) => response.data));
  }

  /**
   * Soporte de ultimo recurso: emite una contrasena temporal para una cuenta y
   * se la envia por correo en el PDF protegido.
   */
  resetAccountPassword(
    personPublicId: string,
    userPublicId: string,
  ): Observable<AdminPersonResponse> {
    return this.http
      .post<ApiResponse<AdminPersonResponse>>(
        `${this.apiUrl}/${encodeURIComponent(personPublicId)}/accounts/${encodeURIComponent(userPublicId)}/reset-password`,
        {},
      )
      .pipe(map((response) => response.data));
  }
}
