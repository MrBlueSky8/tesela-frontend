import { EvaluationStatus } from './applicant';

/** Criticidad del área: decide la bolsa, el veto y el techo del resultado. */
export type AreaCriticality = 'NORMAL' | 'ALTA' | 'CRITICA';

/**
 * De dónde salió el nivel. Lo decide el servidor al guardar, comparando con la
 * última sugerencia de la IA: IA si coincide nivel y criticidad, IA_MODIFICADO
 * si había propuesta y se cambió, EVALUADOR en el resto.
 */
export type LevelSource = 'EVALUADOR' | 'IA' | 'IA_MODIFICADO';

/** Cuánto se apoya la sugerencia en la información del puesto. */
export type AiConfidence = 'ALTA' | 'MEDIA' | 'BAJA';

/** Espejo de GET /api/ai/status. */
export interface AiStatus {
  activa: boolean;
  modelo: string | null;
}

/**
 * De dónde sale la propuesta de un área (manual BlueBody v1.4): con cita del
 * puesto, inferida por el tipo de puesto o fijada por una regla. Los tres
 * últimos valores solo aparecen en sugerencias anteriores, cuando la IA podía
 * dejar áreas sin propuesta.
 */
export type AiSuggestionState =
  | 'SUGERIDA'
  | 'INFERIDA'
  | 'REGLA'
  | 'SIN_INFORMACION'
  | 'SIN_CONSENSO'
  | 'NO_HABILITADA';

export interface AiAreaSuggestion {
  areaOrden: number;
  areaNombre: string;
  nivel: number | null;
  criticidad: AreaCriticality | null;
  confianza: AiConfidence;
  /** Cita textual del puesto; la regla aplicada si es REGLA; el fundamento de la estimación si es INFERIDA. */
  justificacion: string;
  /** Nulo en sugerencias anteriores al manual BlueBody. */
  estado: AiSuggestionState | null;
  /**
   * Reglas de jornada o entorno que intervinieron en el área, también cuando solo
   * confirman el nivel de la IA (entonces `justificacion` sigue siendo la cita).
   * Ausente en sugerencias anteriores a este campo.
   */
  regla?: string | null;
}

/** Espejo de methodology/dto/AiLevelSuggestionResponse. */
export interface AiLevelSuggestion {
  publicId: string;
  modelo: string;
  versionPrompt: string;
  generadaEn: string;
  notaGeneral: string | null;
  areasCriticas: number;
  /** La IA propone más áreas críticas que el umbral configurado. */
  avisoCriticas: boolean;
  /** Solo en sugerencias anteriores al manual v1.4. */
  areasSinInformacion: number;
  confiabilidadAlta: number;
  confiabilidadMedia: number;
  confiabilidadBaja: number;
  areas: AiAreaSuggestion[];
}

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

/** Un área ya puntuada dentro de la evaluación. Sin criticidad: guardada a medias en el borrador. */
export interface AreaLevel {
  areaPublicId: string;
  areaOrden: number;
  areaNombre: string;
  nivelExigencia: number;
  criticidad: AreaCriticality | null;
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
  /** Opcional en el borrador; publicar exige las 30 completas. */
  criticidad: AreaCriticality | null;
}

export interface SavePositionEvaluationRequest {
  descripcionLibre?: string | null;
  notasEvaluador?: string | null;
  curvaAprendizaje?: LearningCurve | null;
  jornada: JobModality[];
  entorno: WorkEnvironment[];
  areas: AreaLevelRequest[];
}
