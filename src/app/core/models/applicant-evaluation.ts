import { EvaluationStatus } from './applicant';

/** Campo D, parte 1: estado de salud general declarado por el evaluador. */
export type HealthStatus =
  | 'ESTABLE_SIN_RESTRICCIONES'
  | 'ESTABLE_CON_RESTRICCIONES'
  | 'FLUCTUANTE'
  | 'EN_TRATAMIENTO_ACTIVO'
  | 'CONDICION_PROGRESIVA';

/** Un área ya puntuada dentro de la evaluación de la persona. */
export interface AreaCapacity {
  areaPublicId: string;
  areaOrden: number;
  areaNombre: string;
  nivelCapacidad: number;
}

/** Espejo de methodology/dto/ApplicantEvaluationResponse. */
export interface ApplicantEvaluationResponse {
  publicId: string;
  applicantPublicId: string;
  applicantNombre: string;
  estado: EvaluationStatus;
  evaluadorNombre: string;
  editable: boolean;
  autocontrol: number | null;
  adaptacion: number | null;
  motivacion: number | null;
  estadoSalud: HealthStatus | null;
  detalleSalud: string | null;
  observacionesEvaluador: string | null;
  areas: AreaCapacity[];
  areasRegistradas: number;
  areasRequeridas: number;
  /** Cuándo pasó a vigente y quién la publicó. Nulos si es borrador. */
  publicadaEn: string | null;
  publicadaPor: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Una versión de la evaluación de una persona, para el historial. */
export interface ApplicantEvaluationSummary {
  publicId: string;
  estado: EvaluationStatus;
  evaluadorNombre: string;
  areasRegistradas: number;
  editable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AreaCapacityRequest {
  areaOrden: number;
  nivelCapacidad: number;
}

export interface SaveApplicantEvaluationRequest {
  autocontrol?: number | null;
  adaptacion?: number | null;
  motivacion?: number | null;
  estadoSalud?: HealthStatus | null;
  detalleSalud?: string | null;
  observacionesEvaluador?: string | null;
  areas: AreaCapacityRequest[];
}
