import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';

import { AuthService } from '../../features/auth/auth-service';
import { AuthTokensResponse } from '../models/auth-tokens-response';
import { TokenService } from '../services/token-service';
import { PUBLIC_ENDPOINTS } from './auth-interceptor';

/**
 * Refresh compartido: si varias peticiones fallan a la vez con 401/403, todas
 * esperan la misma renovacion en lugar de disparar una por request.
 */
let refreshRequest$: Observable<AuthTokensResponse> | null = null;

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  const isPublicRoute = PUBLIC_ENDPOINTS.some((route) => req.url.includes(route));

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      const shouldTryRefresh =
        !isPublicRoute &&
        (error.status === 401 || error.status === 403) &&
        tokenService.hasRefreshSession() &&
        !tokenService.isRefreshTokenExpired();

      if (!shouldTryRefresh) {
        return throwError(() => error);
      }

      refreshRequest$ ??= authService.refreshToken().pipe(
        shareReplay(1),
        finalize(() => {
          refreshRequest$ = null;
        }),
      );

      return refreshRequest$.pipe(
        switchMap((tokens) =>
          next(
            req.clone({
              setHeaders: {
                Authorization: `Bearer ${tokens.accessToken}`,
              },
            }),
          ),
        ),
        catchError((refreshError) => {
          authService.logout();
          void router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
