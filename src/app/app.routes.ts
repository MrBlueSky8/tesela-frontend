import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth-guard';
import { guestGuard } from './core/guards/guest-guard';
import { Auth } from './features/auth/auth';
import { Home } from './features/home/home';
import { PlaceholderPage } from './features/placeholder/placeholder-page';
import { MainLayout } from './layout/main-layout/main-layout';

export const routes: Routes = [
  {
    path: 'login',
    component: Auth,
    canActivate: [guestGuard],
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full',
      },
      {
        path: 'home',
        component: Home,
        data: { breadcrumb: 'Inicio' },
      },
      {
        path: 'companies',
        component: PlaceholderPage,
        canActivate: [authGuard],
        data: {
          breadcrumb: 'Empresas',
          title: 'Empresas',
          description: 'Listado y administracion de empresas.',
        },
      },
      {
        path: 'profile',
        component: PlaceholderPage,
        canActivate: [authGuard],
        data: {
          breadcrumb: 'Mi perfil',
          title: 'Mi perfil',
          description: 'Datos de la cuenta y preferencias.',
        },
      },
      {
        path: 'modulos',
        data: { breadcrumb: 'Modulos' },
        children: [
          {
            path: 'compatibilidad',
            component: PlaceholderPage,
            canActivate: [authGuard],
            data: {
              breadcrumb: 'Compatibilidad laboral',
              title: 'Compatibilidad laboral',
              description: 'Modulo 1: evaluacion de compatibilidad entre puesto y persona.',
            },
          },
          {
            path: 'accesibilidad',
            component: PlaceholderPage,
            canActivate: [authGuard],
            data: {
              breadcrumb: 'Accesibilidad',
              title: 'Accesibilidad',
              description: 'Modulo 2: diagnostico de accesibilidad de las instalaciones.',
            },
          },
          {
            path: 'inclusion',
            component: PlaceholderPage,
            canActivate: [authGuard],
            data: {
              breadcrumb: 'Inclusion',
              title: 'Inclusion',
              description: 'Modulo 3: cultura inclusiva de la organizacion.',
            },
          },
        ],
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
