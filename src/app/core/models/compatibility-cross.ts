import { AreaCriticality } from './position-evaluation';

/** Modo de evaluación de la guía v3.1: A genérico por perfil, B individual. */
export type CrossMode = 'A' | 'B';

export type CompatibilityCategory =
  | 'TOTALMENTE_ADAPTABLE'
  | 'ADAPTABLE_CON_AJUSTES'
  | 'REQUIERE_AJUSTES_IMPORTANTES'
  | 'NO_ADAPTABLE';

/** Tipo de alerta del catálogo v2.0. */
export type AlertType =
  | 'RIESGO_SEGURIDAD'
  | 'INCOMPATIBILIDAD_CANAL'
  | 'ADVERTENCIA_PERFIL'
  | 'ALERTA_MOTIVACIONAL'
  | 'RECOMENDACION_AJUSTE';

/** Espejo de methodology/dto/CrossAlertResponse. */
export interface CrossAlert {
  codigo: string;
  tipo: AlertType;
  seccion: string;
  /** Si abre el informe: sección 1 de la guía v3.1 (7.5). */
  seguridad: boolean;
  mensaje: string;
  accionRecomendada: string;
  /** Perfil que la activó, o null si la condición no mira el perfil. */
  perfilDisparador: string | null;
}

/** Alerta que el cruce genérico no pudo evaluar. */
export interface UnevaluatedAlert {
  codigo: string;
  motivo: string;
}

/** Espejo de methodology/dto/CompatibilityCrossSummaryResponse. */
export interface CompatibilityCrossSummary {
  publicId: string;
  modo: CrossMode;
  /** Nombre de lo que está al otro lado: el perfil o la persona. */
  contraparte: string;
  contrapartePublicId: string;
  puestoPublicId: string;
  puestoNombre: string;

  resultadoFinal: number;
  valorMostrado: number;
  categoria: CompatibilityCategory;
  categoriaEtiqueta: string;
  techoAplicado: number | null;
  techoIntervino: boolean;
  vetoActivado: boolean;
  desactualizado: boolean;
  alertasSeguridad: number;
  alertasTotales: number;

  createdAt: string;
}

/** Detalle de un área dentro del cruce. */
export interface CrossAreaOutcome {
  areaOrden: number;
  areaNombre: string;
  nivelExigencia: number;
  nivelCapacidad: number;
  criticidad: AreaCriticality;
  brecha: number;
  /** 100 compatible, 75 ajustes menores, 25 importantes, 0 no adaptable. */
  valor: number;
  gradoEtiqueta: string;
}

/** Espejo de methodology/dto/CompatibilityCrossResponse. */
export interface CompatibilityCrossDetail extends CompatibilityCrossSummary {
  /** Ponderado antes del techo: lo que permite auditar el resultado. */
  puntaje: number;
  promedioNormal: number | null;
  promedioAlto: number | null;
  promedioCritico: number | null;
  pesoNormal: number;
  pesoAlto: number;
  pesoCritico: number;
  versionMatriz: string;
  versionReglas: string;
  areas: CrossAreaOutcome[];
  alertas: CrossAlert[];
  alertasNoEvaluadas: UnevaluatedAlert[];
  sinPerfilDeclarado: boolean;
}

// ---------------------------------------------------------------- Interpretación con IA (Hito 4, S5)

/** BORRADOR: generada o editada, sin revisar. APROBADA: forma parte del informe. */
export type InterpretationStatus = 'BORRADOR' | 'APROBADA';

export interface InterpretationFactor {
  areaOrden: number;
  areaNombre: string;
  explicacion: string;
}

export interface CrossInterpretation {
  publicId: string;
  estado: InterpretationStatus;
  modelo: string;
  versionPrompt: string;
  generadaEn: string;
  resumen: string;
  factores: InterpretationFactor[];
  consideraciones: string | null;
  limitaciones: string | null;
  /** El evaluador cambió algo de lo que generó la IA. */
  editada: boolean;
  solicitadaPor: string | null;
  aprobadaPor: string | null;
  aprobadaEn: string | null;
}

/** Espejo de methodology/dto/CrossAiInterpretationResponse. */
export interface CrossInterpretationState {
  /** La IA está activa y el cruce puede interpretarse. */
  permitida: boolean;
  motivo: string | null;
  interpretacion: CrossInterpretation | null;
}

export interface UpdateCrossInterpretationRequest {
  resumen: string;
  factores: { areaOrden: number; explicacion: string }[];
  consideraciones: string;
  limitaciones: string;
}

// ---------------------------------------------------------------- Ajustes razonables con IA (Hito 4, S6)

/** Lo común a toda salida de IA sobre un cruce: estado y sello de revisión. */
export interface AiOutputMeta {
  publicId: string;
  estado: InterpretationStatus;
  modelo: string;
  versionPrompt: string;
  generadaEn: string;
  editada: boolean;
  solicitadaPor: string | null;
  aprobadaPor: string | null;
  aprobadaEn: string | null;
}

export type AdjustmentType =
  | 'ENTORNO_FISICO'
  | 'AYUDA_TECNICA'
  | 'COMUNICACION'
  | 'ORGANIZACION_TAREAS'
  | 'JORNADA'
  | 'APOYO_Y_FORMACION';

export type AdjustmentPriority = 'ALTA' | 'MEDIA' | 'BAJA';

/** Un ajuste propuesto. Cita un área con brecha, una alerta disparada o ambas. */
export interface CrossAdjustment {
  areaOrden: number | null;
  areaNombre: string | null;
  alerta: string | null;
  tipo: AdjustmentType;
  prioridad: AdjustmentPriority;
  ajuste: string;
  justificacion: string | null;
}

export interface CrossAdjustmentsProposal extends AiOutputMeta {
  ajustes: CrossAdjustment[];
  notaGeneral: string | null;
}

/** Espejo de methodology/dto/CrossAiAdjustmentsResponse. */
export interface CrossAdjustmentsState {
  permitida: boolean;
  motivo: string | null;
  propuesta: CrossAdjustmentsProposal | null;
}

export interface UpdateCrossAdjustmentsRequest {
  ajustes: {
    areaOrden: number | null;
    alerta: string | null;
    tipo: AdjustmentType;
    prioridad: AdjustmentPriority;
    ajuste: string;
    justificacion: string;
  }[];
  notaGeneral: string;
}
