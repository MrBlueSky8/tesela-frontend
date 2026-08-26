import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { AuthService } from '../../features/auth/auth-service';
import { GlobalRole } from '../models/sidebar-item';
import { TokenService } from '../services/token-service';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const tokenService = inject(TokenService);
  const router = inject(Router);

  const validateRole = (): boolean | UrlTree => {
    const expectedRoles = route.data['roles'] as GlobalRole[] | undefined;

    if (expectedRoles?.length) {
      const currentRole = authService.getCurrentRole();

      if (!currentRole || !expectedRoles.includes(currentRole)) {
        return router.createUrlTree(['/home']);
      }
    }

    return true;
  };

  if (tokenService.hasSession() && !tokenService.isAccessTokenExpired()) {
    return validateRole();
  }

  if (tokenService.hasRefreshSession() && !tokenService.isRefreshTokenExpired()) {
    return authService.refreshToken().pipe(
      map(() => validateRole()),
      catchError(() => {
        authService.logout();
        return of(router.createUrlTree(['/login']));
      }),
    );
  }

  authService.logout();
  return router.createUrlTree(['/login']);
};
