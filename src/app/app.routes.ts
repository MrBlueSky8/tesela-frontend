import { Routes } from '@angular/router';

import { authGuard } from './core/guards/auth-guard';
import { companyContextGuard } from './core/guards/company-context-guard';
import { CompanyScopeService } from './core/services/company-scope-service';
import { guestGuard } from './core/guards/guest-guard';
import {
  passwordChangePendingGuard,
  passwordChangeRequiredGuard,
} from './core/guards/password-change-guard';
import { ChangePassword } from './features/auth/change-password/change-password';
import { Auth } from './features/auth/auth';
import { PeoplePage } from './features/platform/people-page/people-page';
import { ProfilePage } from './features/account/profile-page/profile-page';
import { PasswordReset } from './features/auth/password-reset/password-reset';
import { CompaniesPage } from './features/companies/companies-page/companies-page';
import { CompanyAdminShell } from './features/companies/company-admin/company-admin-shell';
import { CompanyCreate } from './features/companies/company-create/company-create';
import { CompanyProfile } from './features/companies/company-profile/company-profile';
import { CompanyUsersPage } from './features/companies/company-users/company-users-page';
import { MemberDetail } from './features/companies/company-users/member-detail/member-detail';
import { PositionDetail } from './features/organization/position-detail/position-detail';
import { PositionsPage } from './features/organization/positions-page/positions-page';
import { SiteDetail } from './features/sites/site-detail/site-detail';
import { SitesPage } from './features/sites/sites-page/sites-page';
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
    path: 'recuperar-contrasena',
    component: PasswordReset,
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
        // Directorio de empresas y ficha de cada una. Administrar una empresa
        // no cambia la empresa de trabajo del usuario.
        path: 'plataforma/empresas',
        canActivate: [authGuard],
        data: {
          breadcrumb: 'Empresas',
          roles: ['ADMIN_PLATAFORMA'],
        },
        children: [
          {
            path: '',
            component: CompaniesPage,
            data: { breadcrumb: '' },
          },
          {
            path: ':companyPublicId',
            component: CompanyAdminShell,
            // Instancia propia: aqui el alcance es la empresa de la ruta.
            providers: [CompanyScopeService],
            data: { breadcrumb: 'Ficha' },
            children: [
              { path: '', component: CompanyProfile, data: { breadcrumb: '' } },
              {
                path: 'usuarios',
                data: { breadcrumb: 'Usuarios' },
                children: [
                  { path: '', component: CompanyUsersPage, data: { breadcrumb: '' } },
                  {
                    path: ':membershipPublicId',
                    component: MemberDetail,
                    data: { breadcrumb: 'Detalle del usuario' },
                  },
                ],
              },
              {
                path: 'puestos',
                data: { breadcrumb: 'Puestos' },
                children: [
                  { path: '', component: PositionsPage, data: { breadcrumb: '' } },
                  {
                    path: ':positionPublicId',
                    component: PositionDetail,
                    data: { breadcrumb: 'Detalle del puesto' },
                  },
                ],
              },
              {
                path: 'sedes',
                data: { breadcrumb: 'Sedes' },
                children: [
                  { path: '', component: SitesPage, data: { breadcrumb: '' } },
                  {
                    path: ':sitePublicId',
                    component: SiteDetail,
                    data: { breadcrumb: 'Detalle de la sede' },
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        path: 'plataforma/personas',
        component: PeoplePage,
        canActivate: [authGuard],
        data: {
          breadcrumb: 'Personas',
          roles: ['ADMIN_PLATAFORMA'],
        },
      },
      {
        path: 'profile',
        component: ProfilePage,
        canActivate: [authGuard],
        data: { breadcrumb: 'Mi perfil' },
      },
      {
        // Gestion de la empresa seleccionada.
        path: 'empresa',
        data: { breadcrumb: 'Gestion' },
        canActivateChild: [companyContextGuard],
        // El alcance de esta rama es la empresa seleccionada.
        providers: [CompanyScopeService],
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
            // Sin componente: los hijos heredan breadcrumb y privilegios.
            path: 'usuarios',
            data: {
              breadcrumb: 'Usuarios',
              privileges: ['ADMIN_GENERAL'],
            },
            children: [
              {
                path: '',
                component: CompanyUsersPage,
                // Vacio para no repetir la miga heredada del padre.
                data: { breadcrumb: '' },
              },
              {
                path: ':membershipPublicId',
                component: MemberDetail,
                data: { breadcrumb: 'Detalle del usuario' },
              },
            ],
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
            // Sin componente: los hijos heredan breadcrumb y privilegios.
            path: 'sedes',
            data: {
              breadcrumb: 'Sedes',
              privileges: ['ADMIN_GENERAL'],
            },
            children: [
              {
                path: '',
                component: SitesPage,
                // Vacio para no repetir la miga heredada del padre.
                data: { breadcrumb: '' },
              },
              {
                path: ':sitePublicId',
                component: SiteDetail,
                data: { breadcrumb: 'Detalle de la sede' },
              },
            ],
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
