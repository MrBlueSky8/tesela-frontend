import { CompanyPrivilegeResponse, MembershipStatus } from './company';
import { DocumentType } from './user-profile-response';

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
