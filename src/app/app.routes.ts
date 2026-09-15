import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth-guard';
import { companyContextGuard } from './core/guards/company-context-guard';
import { guestGuard } from './core/guards/guest-guard';
import { Auth } from './features/auth/auth';
import { CompaniesPage } from './features/companies/companies-page/companies-page';
import { CompanyCreate } from './features/companies/company-create/company-create';
import { CompanyProfile } from './features/companies/company-profile/company-profile';
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
        // Gestion de la empresa seleccionada. Usuarios, puestos y sedes llegan en las fases 3 a 5.
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
            component: PlaceholderPage,
            data: {
              breadcrumb: 'Usuarios',
              title: 'Usuarios',
              description: 'Miembros de la empresa y sus privilegios.',
              privileges: ['ADMIN_GENERAL'],
            },
          },
          {
            path: 'puestos',
            component: PlaceholderPage,
            data: {
              breadcrumb: 'Puestos',
              title: 'Puestos',
              description: 'Catalogo de puestos y departamentos.',
              privileges: ['ADMIN_GENERAL'],
            },
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
