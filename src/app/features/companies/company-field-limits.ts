/** Mismos maximos que CreateCompanyRequest en el backend. */
export const COMPANY_FIELD_LIMITS = {
  ruc: 20,
  nombre: 150,
  razonSocial: 250,
  descripcion: 500,
  direccion: 150,
  emailContacto: 150,
  urlWeb: 500,
} as const;

export type CompanyLimitedField = keyof typeof COMPANY_FIELD_LIMITS;

/** Topes numericos, iguales a los @Max del backend. */
export const COMPANY_NUMBER_LIMITS = {
  numeroEmpleados: 1_000_000,
  adminLimit: 100,
} as const;
