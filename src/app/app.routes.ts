import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth-guard';
import { companyContextGuard } from './core/guards/company-context-guard';
import { guestGuard } from './core/guards/guest-guard';
import {
  passwordChangePendingGuard,
  passwordChangeRequiredGuard,
} from './core/guards/password-change-guard';
import { ChangePassword } from './features/auth/change-password/change-password';
import { Auth } from './features/auth/auth';
import { CompaniesPage } from './features/companies/companies-page/companies-page';
import { CompanyCreate } from './features/companies/company-create/company-create';
import { CompanyProfile } from './features/companies/company-profile/company-profile';
import { CompanyUsersPage } from './features/companies/company-users/company-users-page';
import { PositionDetail } from './features/organization/position-detail/position-detail';
import { PositionsPage } from './features/organization/positions-page/positions-page';
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
    // Fuera del layout: con la contrasena temporal no se navega por la app.
    path: 'change-password',
    component: ChangePassword,
    canActivate: [authGuard, passwordChangePendingGuard],
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard, passwordChangeRequiredGuard],
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
        component: CompaniesPage,
        canActivate: [authGuard],
        data: { breadcrumb: 'Empresas' },
      },
      {
        // Plana a proposito: un hijo de ruta vacia heredaria el breadcrumb del padre.
        path: 'companies/new',
        component: CompanyCreate,
        canActivate: [authGuard],
        data: {
          breadcrumb: 'Nueva empresa',
          roles: ['ADMIN_PLATAFORMA'],
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
        // Gestion de la empresa seleccionada. Sedes llega en la fase 5.
        path: 'empresa',
        data: { breadcrumb: 'Gestion' },
        canActivateChild: [companyContextGuard],
        children: [
          {
            path: '',
            component: CompanyProfile,
            data: {
              breadcrumb: 'Mi empresa',
              privileges: ['ADMIN_GENERAL'],
            },
          },
          {
            path: 'usuarios',
            component: CompanyUsersPage,
            data: {
              breadcrumb: 'Usuarios',
              privileges: ['ADMIN_GENERAL'],
            },
          },
          {
            // Sin componente: los hijos heredan breadcrumb y privilegios.
            path: 'puestos',
            data: {
              breadcrumb: 'Catalogo de puestos',
              privileges: ['ADMIN_GENERAL'],
            },
            children: [
              {
                path: '',
                component: PositionsPage,
                // Vacio para no repetir la miga heredada del padre.
                data: { breadcrumb: '' },
              },
              {
                path: ':positionPublicId',
                component: PositionDetail,
                data: { breadcrumb: 'Detalle del puesto' },
              },
            ],
          },
          {
            path: 'sedes',
            component: PlaceholderPage,
            data: {
              breadcrumb: 'Sedes',
              title: 'Sedes',
              description: 'Sedes de la empresa y evaluadores asignados.',
              privileges: ['ADMIN_GENERAL'],
            },
          },
        ],
      },
      {
        path: 'modulos',
        data: { breadcrumb: 'Modulos' },
        canActivateChild: [companyContextGuard],
        children: [
          {
            path: 'compatibilidad',
            component: PlaceholderPage,
            data: {
              breadcrumb: 'Compatibilidad laboral',
              title: 'Compatibilidad laboral',
              description: 'Modulo 1: evaluacion de compatibilidad entre puesto y persona.',
              privileges: ['CRUCE_PERFILES'],
            },
          },
          {
            path: 'accesibilidad',
            component: PlaceholderPage,
            data: {
              breadcrumb: 'Accesibilidad',
              title: 'Accesibilidad',
              description: 'Modulo 2: diagnostico de accesibilidad de las instalaciones.',
              privileges: ['PLANES_ACCESIBILIDAD'],
            },
          },
          {
            path: 'inclusion',
            component: PlaceholderPage,
            data: {
              breadcrumb: 'Inclusion',
              title: 'Inclusion',
              description: 'Modulo 3: cultura inclusiva de la organizacion.',
              privileges: ['AJUSTES_RAZONABLES'],
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
