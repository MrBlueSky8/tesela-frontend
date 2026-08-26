import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authErrorInterceptor } from './core/interceptors/auth-error-interceptor';
import { authInterceptor } from './core/interceptors/auth-interceptor';
import { AuthService } from './features/auth/auth-service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, authErrorInterceptor])),
    // Resuelve la sesion (o la renueva) antes del primer render.
    provideAppInitializer(() => firstValueFrom(inject(AuthService).bootstrapSession())),
  ],
};
