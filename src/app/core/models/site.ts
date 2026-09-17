import { CompanyPrivilege } from './company';
import { RecordStatus } from './organization';

/** Espejo de site/dto/SiteResponse. Ciudad y direccion son opcionales. */
export interface SiteResponse {
  publicId: string;
  nombre: string;
  ciudad: string | null;
  direccion: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSiteRequest {
  nombre: string;
  ciudad?: string;
  direccion?: string;
}

/** PATCH parcial: ausente no toca; "" vacia ciudad o direccion. */
export interface UpdateSiteRequest {
  nombre?: string;
  ciudad?: string;
  direccion?: string;
  status?: RecordStatus;
}

/** Asignacion de un evaluador a una sede (sede_evaluadores). */
export interface SiteEvaluatorResponse {
  publicId: string;
  sitePublicId: string;
  siteName: string;
  membershipPublicId: string;
  userPublicId: string;
  email: string;
  firstNames: string;
  lastNames: string;
  /** Privilegios asignados de la membresia. */
  privileges: CompanyPrivilege[];
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AssignSiteEvaluatorRequest {
  membershipPublicId: string;
  /** Si ya tiene otra sede activa: true la desactiva y asigna esta. */
  transfer?: boolean;
}
