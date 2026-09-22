import { CompanyPrivilegeResponse, MembershipStatus } from './company';
import { DocumentType, Gender, UserStatus } from './user-profile-response';

/** Espejo de company/dto/CompanyMembershipResponse. */
export interface CompanyMembershipResponse {
  publicId: string;
  companyPublicId: string;
  userPublicId: string;
  email: string;
  firstNames: string;
  lastNames: string;
  /** Privilegios asignados (no los efectivos). */
  privileges: CompanyPrivilegeResponse[];
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
  /** La cuenta aun usa la contrasena temporal: se le pueden reenviar credenciales. */
  mustChangePassword: boolean;
}

/**
 * Espejo de company/dto/CompanyMemberDetailResponse: la membresia mas los
 * datos de la persona. La persona es compartida por todas sus cuentas.
 */
export interface CompanyMemberDetailResponse {
  publicId: string;
  companyPublicId: string;
  userPublicId: string;
  email: string;
  accountStatus: UserStatus;
  status: MembershipStatus;
  privileges: CompanyPrivilegeResponse[];
  mustChangePassword: boolean;
  personPublicId: string;
  documentType: DocumentType;
  documentNumber: string;
  firstNames: string;
  lastNames: string;
  birthDate: string | null;
  gender: Gender | null;
  address: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  /** Empresas distintas de esta donde la cuenta sigue activa. */
  otherActiveCompanies: number;
  /** Si quien consulta puede eliminar la cuenta desde esta empresa. */
  deletable: boolean;
}

/**
 * PATCH de los datos de contacto de la persona. Sin identidad: nombres,
 * apellidos y documento solo los corrige Fundades.
 */
export interface UpdateMemberPersonRequest {
  telefono?: string;
  direccion?: string;
  fechaNacimiento?: string;
  genero?: Gender;
}

/**
 * Espejo de company/dto/CompanyUserLookupResponse: que hay registrado con un
 * documento. Es el primer paso del alta y decide si la identidad se
 * autocompleta o se pide.
 */
export interface CompanyUserLookupResponse {
  outcome: 'NOT_FOUND' | 'ASSIGNABLE' | 'PERSON_WITHOUT_ACCOUNT' | 'ALREADY_MEMBER';
  firstNames: string | null;
  lastNames: string | null;
  accounts: AssignableUserResponse[];
  membershipPublicId: string | null;
  membershipStatus: MembershipStatus | null;
}

/** Resultado de la busqueda de usuarios que aun no pertenecen a la empresa. */
export interface AssignableUserResponse {
  publicId: string;
  email: string;
  firstNames: string;
  lastNames: string;
  documentType: DocumentType;
  documentNumber: string;
}

export interface AddCompanyUserRequest {
  userPublicId: string;
  privilegePublicIds: string[];
}

/** La contrasena no viaja: la genera el backend y la envia por correo. */
export interface CreateCompanyUserRequest {
  email: string;
  documentType: DocumentType;
  documentNumber: string;
  firstNames: string;
  lastNames: string;
  privilegePublicIds: string[];
}

/** PATCH: `privilegePublicIds` reemplaza el conjunto completo si llega. */
export interface UpdateCompanyMembershipRequest {
  privilegePublicIds?: string[];
  status?: MembershipStatus;
}
