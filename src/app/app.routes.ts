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
      },
      {
        path: 'companies',
        component: PlaceholderPage,
        canActivate: [authGuard],
        data: {
          title: 'Empresas',
          description: 'Listado y administracion de empresas.',
        },
      },
      {
        path: 'profile',
        component: PlaceholderPage,
        canActivate: [authGuard],
        data: {
          title: 'Mi perfil',
          description: 'Datos de la cuenta y preferencias.',
        },
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
