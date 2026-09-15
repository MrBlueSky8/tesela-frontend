import { CompanyPrivilege } from './company';

/**
 * Roles globales emitidos por TeselaBackend en el claim `authorities`
 * (role/init/GlobalRoleInitializer).
 */
export type GlobalRole = 'ADMIN_PLATAFORMA' | 'USUARIO';

/**
 * Iconografia del sidebar. Los mockups de referencia usan dos formas:
 * el webfont de Tabler para acciones y un punto de color para los modulos.
 */
export type SidebarIcon =
  | {
      type: 'tabler';
      /** Nombre sin el prefijo `ti-`, p. ej. `briefcase`. */
      name: string;
    }
  | {
      type: 'dot';
      color: string;
    };

export interface SidebarItem {
  id: string;
  label: string;
  icon?: SidebarIcon;
  route?: string;
  exact?: boolean;
  children?: SidebarItem[];

  allowedGlobalRoles?: GlobalRole[];

  /**
   * Si se define, el item exige una empresa seleccionada y al menos uno de
   * estos privilegios efectivos en ella.
   */
  allowedPrivileges?: CompanyPrivilege[];

  action?: 'logout';

  /** Si es true, el item puede vivir como tab principal del bottom nav movil. */
  mobileTab?: boolean;

  /** Orden dentro del bottom nav movil: menor numero, mayor prioridad. */
  mobileOrder?: number;
}

/**
 * Grupo de items bajo un rotulo en mayusculas ("General", "Modulos"...),
 * tal como aparece en las maquetas.
 */
export interface SidebarSection {
  id: string;
  /** Rotulo del grupo. Si se omite, el grupo se pinta sin encabezado. */
  label?: string;
  items: SidebarItem[];
}
