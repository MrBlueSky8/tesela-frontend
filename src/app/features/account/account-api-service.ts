import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import { Gender, UserProfileResponse } from '../../core/models/user-profile-response';

/**
 * PATCH /api/users/me. Nombres, apellidos y documento no estan: los corrige
 * Fundades. Un campo ausente no cambia; texto vacio borra telefono o direccion.
 */
export interface UpdateMyProfileRequest {
  telefono?: string;
  direccion?: string;
  fechaNacimiento?: string;
  genero?: Gender;
}

@Injectable({
  providedIn: 'root',
})
export class AccountApiService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = `${environment.base}/api/users/me`;

  me(): Observable<UserProfileResponse> {
    return this.http
      .get<ApiResponse<UserProfileResponse>>(this.apiUrl)
      .pipe(map((response) => response.data));
  }

  update(payload: UpdateMyProfileRequest): Observable<UserProfileResponse> {
    return this.http
      .patch<ApiResponse<UserProfileResponse>>(this.apiUrl, payload)
      .pipe(map((response) => response.data));
  }
}
