import { CompanyPrivilege } from '../models/company';

/** Nombres cortos para la UI. El orden es el del enum del backend. */
export const PRIVILEGE_LABELS: Record<CompanyPrivilege, string> = {
  CRUCE_PERFILES: 'Cruce de perfiles',
  PLANES_ACCESIBILIDAD: 'Planes de accesibilidad',
  AJUSTES_RAZONABLES: 'Ajustes razonables',
  ADMIN_SEDE: 'Admin. de sede',
  ADMIN_GENERAL: 'Admin. general',
  GESTIONAR_ADMINS: 'Gestionar admins',
};

const ORDER = Object.keys(PRIVILEGE_LABELS) as CompanyPrivilege[];

/** CompanyPrivilege.Tipo.MODULO */
export const MODULE_PRIVILEGES: readonly CompanyPrivilege[] = [
  'CRUCE_PERFILES',
  'PLANES_ACCESIBILIDAD',
  'AJUSTES_RAZONABLES',
];

/** CompanyPrivilege.Tipo.ADMINISTRACION */
export const ADMINISTRATION_PRIVILEGES: readonly CompanyPrivilege[] = [
  'ADMIN_SEDE',
  'ADMIN_GENERAL',
  'GESTIONAR_ADMINS',
];

/**
 * Dar, quitar o tocar a quien los tiene exige GESTIONAR_ADMINS
 * (CompanyService.PRIVILEGIOS_DE_ADMINISTRACION).
 */
export const ADMIN_MANAGEMENT_PRIVILEGES: readonly CompanyPrivilege[] = [
  'ADMIN_GENERAL',
  'GESTIONAR_ADMINS',
];

/** Lo que ADMIN_GENERAL ya concede (CompanyPrivilege.IMPLICITOS_ADMIN_GENERAL). */
export function isImpliedByAdminGeneral(privilege: CompanyPrivilege): boolean {
  return privilege !== 'ADMIN_GENERAL' && privilege !== 'GESTIONAR_ADMINS';
}

export function touchesAdministration(privileges: readonly CompanyPrivilege[]): boolean {
  return privileges.some((privilege) => ADMIN_MANAGEMENT_PRIVILEGES.includes(privilege));
}

/**
 * Lo que se envia al backend: sin duplicados, en orden y sin lo que ya
 * incluye ADMIN_GENERAL, que seria redundante.
 */
export function explicitPrivileges(selected: readonly CompanyPrivilege[]): CompanyPrivilege[] {
  const unique = new Set(selected);
  const adminGeneral = unique.has('ADMIN_GENERAL');

  return ORDER.filter(
    (privilege) => unique.has(privilege) && !(adminGeneral && isImpliedByAdminGeneral(privilege)),
  );
}

export function samePrivileges(
  a: readonly CompanyPrivilege[],
  b: readonly CompanyPrivilege[],
): boolean {
  const left = explicitPrivileges(a);
  const right = explicitPrivileges(b);
  return left.length === right.length && left.every((privilege, i) => privilege === right[i]);
}

/**
 * Puede asignarse a una sede como responsable de evaluar: Admin. de sede,
 * algun modulo o Admin. general (que incluye los modulos). La asignacion no da
 * acceso; marca quien evalua. Espejo de SiteEvaluatorService.requireAssignable;
 * el estado activo de la membresia se valida aparte.
 */
export function isSiteAssignable(privileges: readonly CompanyPrivilege[]): boolean {
  return privileges.some(
    (privilege) =>
      privilege === 'ADMIN_GENERAL' ||
      privilege === 'ADMIN_SEDE' ||
      MODULE_PRIVILEGES.includes(privilege),
  );
}
