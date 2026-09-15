import { SidebarSection } from '../../../core/models/sidebar-item';

/**
 * Navegacion unica, agrupada en secciones como en las maquetas.
 * Cada item se filtra por rol global (`allowedGlobalRoles`) y, si depende de
 * la empresa seleccionada, por privilegios efectivos (`allowedPrivileges`).
 * Un administrador de plataforma recibe todos los privilegios desde /my-access.
 */
export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: 'general',
    label: 'General',
    items: [
      {
        id: 'home',
        label: 'Inicio',
        icon: { type: 'tabler', name: 'layout-dashboard' },
        route: '/home',
        mobileTab: true,
        mobileOrder: 1,
      },
      {
        id: 'my-companies',
        label: 'Mis empresas',
        icon: { type: 'tabler', name: 'building-community' },
        route: '/companies',
        allowedGlobalRoles: ['USUARIO'],
        mobileTab: true,
        mobileOrder: 2,
      },
    ],
  },
  {
    id: 'plataforma',
    label: 'Plataforma',
    items: [
      {
        id: 'companies',
        label: 'Empresas',
        icon: { type: 'tabler', name: 'building-community' },
        route: '/companies',
        allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
        mobileTab: true,
        mobileOrder: 2,
      },
    ],
  },
  {
    id: 'gestion',
    label: 'Gestion',
    items: [
      {
        id: 'company-profile',
        label: 'Mi empresa',
        icon: { type: 'tabler', name: 'building' },
        route: '/empresa',
        exact: true,
        allowedPrivileges: ['ADMIN_GENERAL'],
      },
      {
        id: 'company-users',
        label: 'Usuarios',
        icon: { type: 'tabler', name: 'users' },
        route: '/empresa/usuarios',
        allowedPrivileges: ['ADMIN_GENERAL'],
      },
      {
        id: 'company-positions',
        label: 'Catalogo de puestos',
        icon: { type: 'tabler', name: 'briefcase' },
        route: '/empresa/puestos',
        allowedPrivileges: ['ADMIN_GENERAL'],
      },
      {
        id: 'company-sites',
        label: 'Sedes',
        icon: { type: 'tabler', name: 'map-pin' },
        route: '/empresa/sedes',
        allowedPrivileges: ['ADMIN_GENERAL'],
      },
    ],
  },
  {
    id: 'modulos',
    label: 'Modulos',
    items: [
      {
        id: 'modulo-compatibilidad',
        label: 'Compatibilidad laboral',
        icon: { type: 'dot', color: 'var(--ts-green)' },
        route: '/modulos/compatibilidad',
        allowedPrivileges: ['CRUCE_PERFILES'],
      },
      {
        id: 'modulo-accesibilidad',
        label: 'Accesibilidad',
        icon: { type: 'dot', color: 'var(--ts-amber)' },
        route: '/modulos/accesibilidad',
        allowedPrivileges: ['PLANES_ACCESIBILIDAD'],
      },
      {
        id: 'modulo-inclusion',
        label: 'Inclusion',
        icon: { type: 'dot', color: 'var(--ts-purple)' },
        route: '/modulos/inclusion',
        allowedPrivileges: ['AJUSTES_RAZONABLES'],
      },
    ],
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    items: [
      {
        id: 'profile',
        label: 'Mi perfil',
        icon: { type: 'tabler', name: 'user' },
        route: '/profile',
        mobileTab: true,
        mobileOrder: 3,
      },
      {
        id: 'logout',
        label: 'Cerrar sesion',
        icon: { type: 'tabler', name: 'logout' },
        action: 'logout',
      },
    ],
  },
];
