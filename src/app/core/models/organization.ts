/**
 * Contratos del paquete `organization` de TeselaBackend: departamentos,
 * catalogo de puestos y condiciones laborales.
 */
export type RecordStatus = 'ACTIVE' | 'INACTIVE';

/** Espejo de organization/entity/CondicionPuesto (codigos de "Reglas del modelo de datos" 3.1). */
export type JobConditionCode =
  | 'TURNO_DIURNO'
  | 'TURNO_NOCTURNO'
  | 'TURNO_ROTATIVO'
  | 'FINES_DE_SEMANA'
  | 'JORNADA_PARTIDA'
  | 'REMOTO_TOTAL'
  | 'REMOTO_PARCIAL'
  | 'VIAJES_FRECUENTES'
  | 'GUARDIAS_DISPONIBILIDAD'
  | 'OFICINA_CLIMATIZADA'
  | 'PLANTA_TALLER'
  | 'EXTERIOR'
  | 'TRABAJO_EN_ALTURA'
  | 'ESPACIO_CONFINADO'
  | 'CONTACTO_CONTINUO_PUBLICO'
  | 'CONDUCCION_VEHICULOS'
  | 'TRABAJO_EN_SOLITARIO'
  | 'LABORATORIO'
  | 'COCINA_ALIMENTOS';

export type JobConditionDimension = 'MODALIDAD' | 'ENTORNO';

/** Las etiquetas vienen del backend: catalogo y Modulo 1 muestran el mismo texto. */
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
  condiciones: JobConditionCode[];
  /** Tiene evaluacion vigente en el Modulo 1. */
  evaluado: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePositionRequest {
  departmentPublicId: string;
  nombre: string;
  descripcion?: string;
  tareasPrincipales?: string;
  condiciones: JobConditionCode[];
}

/** PATCH parcial: ausente no toca; "" vacia descripcion o tareas. */
export interface UpdatePositionRequest {
  departmentPublicId?: string;
  nombre?: string;
  descripcion?: string;
  tareasPrincipales?: string;
  status?: RecordStatus;
  condiciones?: JobConditionCode[];
}
