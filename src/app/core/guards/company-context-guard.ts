import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { CompanyPrivilege } from '../models/company';
import { CompanyContextService } from '../services/company-context-service';

/**
 * Exige una empresa seleccionada y, si la ruta declara `data.privileges`,
 * al menos uno de esos privilegios efectivos en ella.
 * Va despues de `authGuard`: presupone sesion valida.
 */
export const companyContextGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const companyContext = inject(CompanyContextService);
  const router = inject(Router);

  return companyContext.restore().pipe(
    map((hasCompany) => {
      if (!hasCompany) {
        return router.createUrlTree(['/companies']);
      }

      const required = route.data['privileges'] as CompanyPrivilege[] | undefined;

      if (required?.length && !companyContext.hasAnyPrivilege(required)) {
        return router.createUrlTree(['/home']);
      }

      return true;
    }),
  );
};
