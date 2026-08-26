import { SidebarItem } from '../../../core/models/sidebar-item';

/**
 * Navegacion por rol global. El filtrado por rol de empresa
 * (ADMIN_EMPRESA / EVALUADOR) queda pendiente: TeselaBackend todavia no expone
 * el rol de empresa del usuario autenticado.
 */
export const ADMIN_PLATAFORMA_SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: 'home',
    label: 'Inicio',
    icon: { type: 'material', name: 'home', filled: true },
    route: '/home',
    allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
    mobileTab: true,
    mobileOrder: 1,
  },
  {
    id: 'companies',
    label: 'Empresas',
    icon: { type: 'material', name: 'apartment' },
    route: '/companies',
    allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
    mobileTab: true,
    mobileOrder: 2,
  },
  {
    id: 'profile',
    label: 'Mi perfil',
    icon: { type: 'material', name: 'person' },
    route: '/profile',
    dividerAfter: true,
    allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
    mobileTab: true,
    mobileOrder: 3,
  },
  {
    id: 'logout',
    label: 'Cerrar sesion',
    icon: { type: 'material', name: 'logout' },
    action: 'logout',
    allowedGlobalRoles: ['ADMIN_PLATAFORMA'],
  },
];

export const USUARIO_SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: 'home',
    label: 'Inicio',
    icon: { type: 'material', name: 'home', filled: true },
    route: '/home',
    allowedGlobalRoles: ['USUARIO'],
    mobileTab: true,
    mobileOrder: 1,
  },
  {
    id: 'companies',
    label: 'Mis empresas',
    icon: { type: 'material', name: 'apartment' },
    route: '/companies',
    allowedGlobalRoles: ['USUARIO'],
    mobileTab: true,
    mobileOrder: 2,
  },
  {
    id: 'profile',
    label: 'Mi perfil',
    icon: { type: 'material', name: 'person' },
    route: '/profile',
    dividerAfter: true,
    allowedGlobalRoles: ['USUARIO'],
    mobileTab: true,
    mobileOrder: 3,
  },
  {
    id: 'logout',
    label: 'Cerrar sesion',
    icon: { type: 'material', name: 'logout' },
    action: 'logout',
    allowedGlobalRoles: ['USUARIO'],
  },
];
