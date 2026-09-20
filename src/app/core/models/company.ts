/**
 * Contratos del paquete `company` de TeselaBackend
 * (company/dto y company/entity).
 */
export type CompanyStatus = 'ACTIVE' | 'INACTIVE';

export type MembershipStatus = 'ACTIVE' | 'INACTIVE';

/** Espejo de company/entity/CompanyPrivilege. */
export type CompanyPrivilege =
  | 'CRUCE_PERFILES'
  | 'PLANES_ACCESIBILIDAD'
  | 'AJUSTES_RAZONABLES'
  | 'ADMIN_SEDE'
  | 'ADMIN_GENERAL'
  | 'GESTIONAR_ADMINS';

export interface CompanyResponse {
  publicId: string;
  ruc: string;
  nombre: string;
  direccion: string;
  /** Opcional en el backend. */
  telefonoContacto: string | null;
  emailContacto: string;
  status: CompanyStatus;
  razonSocial: string;
  urlLogo: string | null;
  descripcion: string;
  /** Opcional en el backend. */
  numeroEmpleados: number | null;
  adminLimit: number;
  /** Opcional en el backend. */
  urlWeb: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyRequest {
  ruc: string;
  nombre: string;
  direccion: string;
  telefonoContacto: string;
  emailContacto: string;
  razonSocial: string;
  descripcion: string;
  /** Opcional. */
  numeroEmpleados?: number;
  urlWeb: string;
  /** Opcional: si no llega, el backend aplica el limite por defecto. */
  adminLimit?: number;
}

/**
 * PATCH parcial: solo se aplican los campos presentes. No incluye el logo
 * (va por /logo) ni el RUC, que no es editable.
 */
export type UpdateCompanyRequest = Partial<
  Pick<
    CreateCompanyRequest,
    | 'nombre'
    | 'razonSocial'
    | 'descripcion'
    | 'direccion'
    | 'telefonoContacto'
    | 'emailContacto'
    | 'urlWeb'
    | 'numeroEmpleados'
  >
>;

export interface CompanyPrivilegeResponse {
  publicId: string;
  name: CompanyPrivilege;
  description: string;
}

/**
 * Respuesta de GET /api/companies/{id}/my-access.
 * `privileges` son los asignados; `effectivePrivileges` ya incluye lo que
 * implica ADMIN_GENERAL. Para decidir que se muestra, usar siempre los efectivos.
 */
export interface CompanyMyAccessResponse {
  companyPublicId: string;
  platformAdmin: boolean;
  membershipStatus: MembershipStatus | null;
  privileges: CompanyPrivilegeResponse[];
  effectivePrivileges: CompanyPrivilege[];
}
