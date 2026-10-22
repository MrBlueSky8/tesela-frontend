import { DocumentType, Gender } from './user-profile-response';

/** Estado de la ficha (evaluación) del postulante en una empresa. */
export type EvaluationStatus = 'BORRADOR' | 'VIGENTE' | 'REEMPLAZADA';

export type ApplicantStatus = 'ACTIVE' | 'INACTIVE';

/** Perfil de discapacidad declarado, con su número canónico del catálogo. */
export interface DeclaredProfile {
  publicId: string;
  nombre: string;
  orden: number | null;
}

/** Espejo de methodology/dto/ApplicantSummaryResponse. */
export interface ApplicantSummaryResponse {
  publicId: string;
  nombres: string;
  apellidos: string;
  documentType: DocumentType;
  documentNumber: string;
  email: string | null;
  cargoActual: string | null;
  estado: ApplicantStatus;
  fichaEstado: EvaluationStatus | null;
  perfiles: string[];
  updatedAt: string;
}

/**
 * Espejo de methodology/dto/ApplicantResponse. La identidad y el contacto son
 * de la persona, que es global; la ficha pertenece a la empresa.
 */
export interface ApplicantResponse {
  publicId: string;
  personPublicId: string;
  documentType: DocumentType;
  documentNumber: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string | null;
  genero: Gender | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  areaDepartamento: string | null;
  cargoActual: string | null;
  estado: ApplicantStatus;
  perfiles: DeclaredProfile[];
  fichaPublicId: string | null;
  fichaEstado: EvaluationStatus | null;
  createdAt: string;
  updatedAt: string;
}

/** Espejo de methodology/dto/ApplicantLookupResponse. */
export interface ApplicantLookupResponse {
  outcome: 'NOT_FOUND' | 'PERSONA_REGISTRADA' | 'YA_TIENE_FICHA';
  nombres: string | null;
  apellidos: string | null;
  applicantPublicId: string | null;
  fichaPublicId: string | null;
}

export interface CreateApplicantRequest {
  documentType: DocumentType;
  documentNumber: string;
  firstNames: string;
  lastNames: string;
  email?: string;
  areaDepartamento?: string;
  cargoActual?: string;
  telefono?: string;
  perfilPublicIds: string[];
}

/** PATCH parcial: la identidad no se edita desde la empresa. */
export interface UpdateApplicantRequest {
  email?: string;
  areaDepartamento?: string;
  cargoActual?: string;
  fechaNacimiento?: string;
  genero?: Gender;
  direccion?: string;
  telefono?: string;
  estado?: ApplicantStatus;
}
