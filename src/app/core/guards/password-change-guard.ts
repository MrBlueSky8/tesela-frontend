import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { TokenService } from '../services/token-service';

/**
 * Con una contrasena temporal pendiente no se entra a la app: primero hay que
 * cambiarla. Va despues de `authGuard` en el shell autenticado.
 *
 * <p>Es una guia de navegacion, no una barrera de seguridad: el dueno de la
 * cuenta es quien la tiene, y el backend sigue autorizando cada peticion.
 */
export const passwordChangeRequiredGuard: CanActivateFn = () => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  return tokenService.mustChangePassword() ? router.createUrlTree(['/change-password']) : true;
};

/** La pantalla de cambio solo tiene sentido mientras el cambio esta pendiente. */
export const passwordChangePendingGuard: CanActivateFn = () => {
  const tokenService = inject(TokenService);
  const router = inject(Router);

  return tokenService.mustChangePassword() ? true : router.createUrlTree(['/home']);
};
