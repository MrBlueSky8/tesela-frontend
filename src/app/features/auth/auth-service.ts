import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/models/api-response';
import { AuthTokensResponse } from '../../core/models/auth-tokens-response';
import { LoginRequest } from '../../core/models/login-request';
import { RefreshTokenRequest } from '../../core/models/refresh-token-request';
import { GlobalRole } from '../../core/models/sidebar-item';
import { TokenService } from '../../core/services/token-service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenService = inject(TokenService);

  private readonly apiUrl = `${environment.base}/api/auth`;

  login(payload: LoginRequest, rememberMe = true): Observable<AuthTokensResponse> {
    return this.http.post<ApiResponse<AuthTokensResponse>>(`${this.apiUrl}/login`, payload).pipe(
      tap((response) => {
        this.tokenService.setTokens(
          response.data.accessToken,
          response.data.refreshToken,
          rememberMe,
        );
      }),
      map((response) => response.data),
    );
  }

  refreshToken(): Observable<AuthTokensResponse> {
    const payload: RefreshTokenRequest = {
      refreshToken: this.tokenService.getRefreshToken() ?? '',
    };

    return this.http
      .post<ApiResponse<AuthTokensResponse>>(`${this.apiUrl}/refresh-token`, payload)
      .pipe(
        tap((response) => {
          this.tokenService.setTokens(
            response.data.accessToken,
            response.data.refreshToken,
            this.tokenService.isPersistentSession(),
          );
        }),
        map((response) => response.data),
      );
  }

  logout(): void {
    this.tokenService.clearTokens();
  }

  isAuthenticated(): boolean {
    return this.tokenService.hasSession() && !this.tokenService.isAccessTokenExpired();
  }

  getCurrentUsername(): string | null {
    return this.tokenService.getUsername();
  }

  getCurrentRole(): GlobalRole | null {
    return this.tokenService.getRole();
  }

  /**
   * Resuelve la sesion antes del primer render (ver `provideAppInitializer`).
   * Si el access token sigue vigente no hace nada; si solo queda refresh valido
   * intenta renovar; en cualquier otro caso limpia la sesion.
   */
  bootstrapSession(): Observable<void> {
    if (this.isAuthenticated()) {
      return of(void 0);
    }

    const canRefresh =
      this.tokenService.hasRefreshSession() && !this.tokenService.isRefreshTokenExpired();

    if (canRefresh) {
      return this.refreshToken().pipe(
        map(() => void 0),
        catchError((error) => {
          console.error('Error renovando la sesion durante el arranque', error);
          this.logout();
          return of(void 0);
        }),
      );
    }

    this.logout();
    return of(void 0);
  }
}
