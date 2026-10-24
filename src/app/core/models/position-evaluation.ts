import { EvaluationStatus } from './applicant';

/** Criticidad del área: decide la bolsa, el veto y el techo del resultado. */
export type AreaCriticality = 'NORMAL' | 'ALTA' | 'CRITICA';

/** De dónde salió el nivel. Hasta el Hito 4 siempre es EVALUADOR. */
export type LevelSource = 'EVALUADOR' | 'IA' | 'IA_MODIFICADO';

export type LearningCurve = 'INMEDIATA' | 'CORTA' | 'MEDIA' | 'ALTA_Y_CONTINUA';

/** Campo E: modalidad y condiciones de jornada. */
export type JobModality =
  | 'TURNO_NOCTURNO'
  | 'TURNO_ROTATIVO'
  | 'FINES_DE_SEMANA'
  | 'JORNADA_PARTIDA'
  | 'TRABAJO_REMOTO_TOTAL'
  | 'TRABAJO_REMOTO_PARCIAL'
  | 'VIAJES_FRECUENTES'
  | 'GUARDIAS_DISPONIBILIDAD';

/** Campo F: entorno físico del puesto. */
export type WorkEnvironment =
  | 'OFICINA'
  | 'PLANTA_O_TALLER'
  | 'EXTERIOR'
  | 'TRABAJO_EN_ALTURA'
  | 'ESPACIO_CONFINADO'
  | 'CONTACTO_CONTINUO_PUBLICO'
  | 'CONDUCCION_MOTOCICLETA'
  | 'CONDUCCION_VEHICULO_LIVIANO'
  | 'CONDUCCION_VEHICULO_PESADO'
  | 'OPERACION_MAQUINARIA_PESADA'
  | 'TRABAJO_EN_SOLITARIO'
  | 'LABORATORIO'
  | 'COCINA_O_ALIMENTOS';

/** Espejo de methodology/dto/EvaluationAreaResponse. */
export interface EvaluationAreaResponse {
  publicId: string;
  orden: number;
  nombre: string;
  grupo: string;
  definicionExigencia: string | null;
  definicionCapacidad: string | null;
  niveles: AreaLevelText[];
}

export interface AreaLevelText {
  nivel: number;
  exigencia: string;
  capacidad: string;
}

/** Valores posibles de los campos complementarios del puesto. */
/** Un valor del enumerado con el nombre que se muestra. */
export interface FieldOption<T extends string> {
  name: T;
  label: string;
}

export interface PositionEvaluationFields {
  /** Con etiqueta: es el mismo vocabulario que el catálogo de puestos. */
  jornada: FieldOption<JobModality>[];
  entorno: FieldOption<WorkEnvironment>[];
  curvaAprendizaje: LearningCurve[];
  criticidad: AreaCriticality[];
}

/** Un área ya puntuada dentro de la evaluación. */
export interface AreaLevel {
  areaPublicId: string;
  areaOrden: number;
  areaNombre: string;
  nivelExigencia: number;
  criticidad: AreaCriticality;
  origen: LevelSource;
}

/** Espejo de methodology/dto/PositionEvaluationResponse. */
export interface PositionEvaluationResponse {
  publicId: string;
  positionPublicId: string;
  positionNombre: string;
  estado: EvaluationStatus;
  evaluadorNombre: string;
  editable: boolean;
  descripcionLibre: string | null;
  notasEvaluador: string | null;
  curvaAprendizaje: LearningCurve | null;
  jornada: JobModality[];
  entorno: WorkEnvironment[];
  areas: AreaLevel[];
  areasRegistradas: number;
  areasRequeridas: number;
  /** Cuándo pasó a vigente y quién la publicó. Nulos si es borrador. */
  publicadaEn: string | null;
  publicadaPor: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Una versión de la evaluación de un puesto, para el historial. */
export interface PositionEvaluationSummary {
  publicId: string;
  estado: EvaluationStatus;
  evaluadorNombre: string;
  areasRegistradas: number;
  editable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AreaLevelRequest {
  areaOrden: number;
  nivelExigencia: number;
  criticidad: AreaCriticality;
}

export interface SavePositionEvaluationRequest {
  descripcionLibre?: string | null;
  notasEvaluador?: string | null;
  curvaAprendizaje?: LearningCurve | null;
  jornada: JobModality[];
  entorno: WorkEnvironment[];
  areas: AreaLevelRequest[];
}
