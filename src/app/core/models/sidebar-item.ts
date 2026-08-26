/**
 * Roles globales emitidos por TeselaBackend en el claim `authorities`
 * (role/init/GlobalRoleInitializer).
 */
export type GlobalRole = 'ADMIN_PLATAFORMA' | 'USUARIO';

export type SidebarIcon =
  | {
      type: 'material';
      name: string;
      filled?: boolean;
    }
  | {
      type: 'svg';
      src: string;
      activeSrc?: string;
      alt?: string;
    };

export interface SidebarItem {
  id: string;
  label: string;
  icon?: SidebarIcon;
  route?: string;
  exact?: boolean;
  dividerAfter?: boolean;
  children?: SidebarItem[];

  allowedGlobalRoles?: GlobalRole[];

  action?: 'logout';

  /** Si es true, el item puede vivir como tab principal del bottom nav movil. */
  mobileTab?: boolean;

  /** Orden dentro del bottom nav movil: menor numero, mayor prioridad. */
  mobileOrder?: number;
}
