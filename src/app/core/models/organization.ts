import { JobModality, WorkEnvironment } from './position-evaluation';

/**
 * Contratos del paquete `organization` de TeselaBackend: departamentos,
 * catalogo de puestos y condiciones laborales.
 */
export type RecordStatus = 'ACTIVE' | 'INACTIVE';

/**
 * Las condiciones del puesto son el mismo vocabulario que los campos E y F
 * de la evaluación del Módulo 1, así que se reutilizan sus tipos en vez de
 * declarar una lista paralela.
 */
export type JobConditionCode = JobModality | WorkEnvironment;

export type JobConditionDimension = 'JORNADA' | 'ENTORNO';

/** Las etiquetas vienen del backend: catálogo y Módulo 1 muestran el mismo texto. */
export interface JobConditionResponse {
  name: JobConditionCode;
  dimension: JobConditionDimension;
  label: string;
}

export interface DepartmentResponse {
  publicId: string;
  nombre: string;
  descripcion: string | null;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentRequest {
  nombre: string;
  descripcion?: string;
}

/** PATCH parcial: en descripcion, un texto vacio la borra. */
export interface UpdateDepartmentRequest {
  nombre?: string;
  descripcion?: string;
  status?: RecordStatus;
}

export interface PositionResponse {
  publicId: string;
  departmentPublicId: string;
  departmentName: string;
  nombre: string;
  descripcion: string | null;
  tareasPrincipales: string | null;
  /** Nulo si el puesto lo registró Fundades, que no pertenece a la empresa. */
  createdByMembershipPublicId: string | null;
  createdByName: string;
  status: RecordStatus;
  jornada: JobModality[];
  entorno: WorkEnvironment[];
  /** Tiene evaluacion vigente en el Modulo 1. */
  evaluado: boolean;
  /** Hay una evaluación en borrador abierta para este puesto. */
  enBorrador: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePositionRequest {
  departmentPublicId: string;
  nombre: string;
  descripcion?: string;
  tareasPrincipales?: string;
  jornada: JobModality[];
  entorno: WorkEnvironment[];
}

/** PATCH parcial: ausente no toca; "" vacia descripcion o tareas. */
export interface UpdatePositionRequest {
  departmentPublicId?: string;
  nombre?: string;
  descripcion?: string;
  tareasPrincipales?: string;
  status?: RecordStatus;
  jornada?: JobModality[];
  entorno?: WorkEnvironment[];
}
