import { SidebarSection } from '../../../core/models/sidebar-item';

/**
 * Navegacion por rol global, agrupada en secciones como en las maquetas.
 * El filtrado por rol de empresa (ADMIN_EMPRESA / EVALUADOR) sigue pendiente:
 * TeselaBackend aun no expone el rol de empresa del usuario autenticado.
 */
export const ADMIN_PLATAFORMA_SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: 'general',
    label: 'General',
    items: [
      {
        id: 'home',
        label: 'Inicio',
        icon: { type: 'tabler', name: 'layout-dashboard' },
        route: '/home',
        allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
        mobileTab: true,
        mobileOrder: 1,
      },
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
    id: 'modulos',
    label: 'Modulos',
    items: [
      {
        id: 'modulo-compatibilidad',
        label: 'Compatibilidad laboral',
        icon: { type: 'dot', color: 'var(--ts-green)' },
        route: '/modulos/compatibilidad',
        allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
      },
      {
        id: 'modulo-accesibilidad',
        label: 'Accesibilidad',
        icon: { type: 'dot', color: 'var(--ts-amber)' },
        route: '/modulos/accesibilidad',
        allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
      },
      {
        id: 'modulo-inclusion',
        label: 'Inclusion',
        icon: { type: 'dot', color: 'var(--ts-purple)' },
        route: '/modulos/inclusion',
        allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
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
        allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
        mobileTab: true,
        mobileOrder: 3,
      },
      {
        id: 'logout',
        label: 'Cerrar sesion',
        icon: { type: 'tabler', name: 'logout' },
        action: 'logout',
        allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
      },
    ],
  },
];

export const USUARIO_SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    id: 'general',
    label: 'General',
    items: [
      {
        id: 'home',
        label: 'Inicio',
        icon: { type: 'tabler', name: 'layout-dashboard' },
        route: '/home',
        allowedGlobalRoles: ['USUARIO'],
        mobileTab: true,
        mobileOrder: 1,
      },
      {
        id: 'companies',
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
    id: 'modulos',
    label: 'Modulos',
    items: [
      {
        id: 'modulo-compatibilidad',
        label: 'Compatibilidad laboral',
        icon: { type: 'dot', color: 'var(--ts-green)' },
        route: '/modulos/compatibilidad',
        allowedGlobalRoles: ['USUARIO'],
      },
      {
        id: 'modulo-accesibilidad',
        label: 'Accesibilidad',
        icon: { type: 'dot', color: 'var(--ts-amber)' },
        route: '/modulos/accesibilidad',
        allowedGlobalRoles: ['USUARIO'],
      },
      {
        id: 'modulo-inclusion',
        label: 'Inclusion',
        icon: { type: 'dot', color: 'var(--ts-purple)' },
        route: '/modulos/inclusion',
        allowedGlobalRoles: ['USUARIO'],
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
        allowedGlobalRoles: ['USUARIO'],
        mobileTab: true,
        mobileOrder: 3,
      },
      {
        id: 'logout',
        label: 'Cerrar sesion',
        icon: { type: 'tabler', name: 'logout' },
        action: 'logout',
        allowedGlobalRoles: ['USUARIO'],
      },
    ],
  },
];
