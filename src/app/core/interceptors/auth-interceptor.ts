import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { TokenService } from '../services/token-service';

/**
 * Endpoints que TeselaBackend expone sin autenticacion
 * (auth/security/SecurityConfig): no deben llevar Authorization.
 */
export const PUBLIC_ENDPOINTS = ['/api/auth/login', '/api/auth/refresh-token'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const accessToken = tokenService.getAccessToken();

  const isPublicRoute = PUBLIC_ENDPOINTS.some((route) => req.url.includes(route));

  if (isPublicRoute || !accessToken) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`,
      },
    }),
  );
};
