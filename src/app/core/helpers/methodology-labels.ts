import { HealthStatus } from '../models/applicant-evaluation';
import { AlertType, CompatibilityCategory } from '../models/compatibility-cross';
import { AreaCriticality, LearningCurve } from '../models/position-evaluation';

/** Etiquetas legibles de los valores que el backend guarda como enum. */

export const CRITICALITY_LABELS: Record<AreaCriticality, string> = {
  NORMAL: 'Normal',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

/** Peso base de cada bolsa, para que el evaluador sepa qué está decidiendo. */
export const CRITICALITY_HINTS: Record<AreaCriticality, string> = {
  NORMAL: 'Promedio simple, peso 20 %',
  ALTA: 'Promedio simple, peso 30 %',
  CRITICA: 'Media armónica, peso 50 %. Un área incompatible aquí veta el resultado',
};

export const LEARNING_CURVE_LABELS: Record<LearningCurve, string> = {
  INMEDIATA: 'Inmediata: se domina en horas, sin formación previa',
  CORTA: 'Corta: se domina en días, con formación en el puesto',
  MEDIA: 'Media: semanas o meses, requiere capacitación técnica',
  ALTA_Y_CONTINUA: 'Alta y continua: el aprendizaje es parte estructural del rol',
};

/*
 * La jornada y el entorno no tienen mapa aquí a propósito: sus etiquetas
 * vienen del backend junto con los valores, porque son el mismo vocabulario
 * que el catálogo de puestos y tenerlas en dos sitios fue lo que permitió
 * que las dos listas se separaran sin que nadie lo notara.
 */

/** Campo D: estado de salud general. No pondera, alimenta las alertas. */
export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  ESTABLE_SIN_RESTRICCIONES: 'Estable, sin restricciones',
  ESTABLE_CON_RESTRICCIONES: 'Estable, con restricciones puntuales',
  FLUCTUANTE: 'Fluctuante: alterna periodos buenos y malos',
  EN_TRATAMIENTO_ACTIVO: 'En tratamiento activo',
  CONDICION_PROGRESIVA: 'Condición progresiva',
};

export const HEALTH_STATUS_VALUES: HealthStatus[] = [
  'ESTABLE_SIN_RESTRICCIONES',
  'ESTABLE_CON_RESTRICCIONES',
  'FLUCTUANTE',
  'EN_TRATAMIENTO_ACTIVO',
  'CONDICION_PROGRESIVA',
];

/**
 * Campos A a C de la persona. La escala es 1 a 5 y es siempre la misma:
 * el texto cambia porque lo que se observa en cada campo es distinto.
 */
export const APPLICANT_SCALE_LABELS: Record<number, string> = {
  1: '1 · Muy bajo',
  2: '2 · Bajo',
  3: '3 · Medio',
  4: '4 · Alto',
  5: '5 · Muy alto',
};

/** Categoría del resultado de un cruce (guía v3.1, sección 3.6). */
export const CATEGORY_LABELS: Record<CompatibilityCategory, string> = {
  TOTALMENTE_ADAPTABLE: 'Totalmente adaptable',
  ADAPTABLE_CON_AJUSTES: 'Adaptable con ajustes',
  REQUIERE_AJUSTES_IMPORTANTES: 'Requiere ajustes importantes',
  NO_ADAPTABLE: 'No adaptable',
};

/** Clase del badge, para que el color diga lo mismo que la etiqueta. */
export const CATEGORY_BADGES: Record<CompatibilityCategory, string> = {
  TOTALMENTE_ADAPTABLE: 'bdg-green',
  ADAPTABLE_CON_AJUSTES: 'bdg-blue',
  REQUIERE_AJUSTES_IMPORTANTES: 'bdg-amber',
  NO_ADAPTABLE: 'bdg-red',
};

/** Tipos del catálogo de alertas de IA v2.0. */
export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  RIESGO_SEGURIDAD: 'Riesgo de seguridad',
  INCOMPATIBILIDAD_CANAL: 'Incompatibilidad de canal',
  ADVERTENCIA_PERFIL: 'Advertencia de perfil',
  ALERTA_MOTIVACIONAL: 'Alerta motivacional',
  RECOMENDACION_AJUSTE: 'Recomendación de ajuste',
};

export const ALERT_TYPE_BADGES: Record<AlertType, string> = {
  RIESGO_SEGURIDAD: 'bdg-red',
  INCOMPATIBILIDAD_CANAL: 'bdg-blue',
  ADVERTENCIA_PERFIL: 'bdg-amber',
  ALERTA_MOTIVACIONAL: 'bdg-orange',
  RECOMENDACION_AJUSTE: 'bdg-purple',
};
