import {
  AiAreaSuggestion,
  AiLevelSuggestion,
  AreaCriticality,
} from '../../../core/models/position-evaluation';

/** Lo que el evaluador lleva puesto en un área. */
export interface AreaValue {
  nivelExigencia: number | null;
  criticidad: AreaCriticality | null;
}

/**
 * Cómo está un área frente a lo que propuso la IA.
 *
 * - SIN_PROPUESTA: la IA no tuvo datos del área (o no hay sugerencia).
 * - PENDIENTE: el área aún no tiene nivel y criticidad completos.
 * - COINCIDE: nivel y criticidad iguales a la propuesta. Se guardará como IA.
 * - MODIFICADA: completa, pero distinta. Se guardará como IA_MODIFICADO.
 */
export type SuggestionState = 'SIN_PROPUESTA' | 'PENDIENTE' | 'COINCIDE' | 'MODIFICADA';

/**
 * Replica la regla con la que el servidor fija el origen al guardar, para que
 * lo que se ve en pantalla sea lo que se va a guardar.
 */
export function estadoFrenteASugerencia(
  valor: AreaValue | undefined,
  propuesta: AiAreaSuggestion | undefined,
): SuggestionState {
  if (!propuesta || propuesta.nivel === null) {
    return 'SIN_PROPUESTA';
  }
  if (!valor || valor.nivelExigencia === null || valor.criticidad === null) {
    return 'PENDIENTE';
  }
  return valor.nivelExigencia === propuesta.nivel && valor.criticidad === propuesta.criticidad
    ? 'COINCIDE'
    : 'MODIFICADA';
}

/**
 * Niveles a aplicar en bloque: solo en áreas sin nivel y solo el nivel. La
 * criticidad nunca se aplica en bloque (la bolsa crítica pesa 50 % y tiene
 * veto: se confirma área por área), y lo que el evaluador ya puso no se pisa.
 *
 * @returns orden del área → nivel sugerido.
 */
export function nivelesParaAreasVacias(
  draft: Record<number, AreaValue>,
  sugerencia: AiLevelSuggestion,
  descartadas: ReadonlySet<number> = new Set(),
): Record<number, number> {
  const niveles: Record<number, number> = {};
  for (const area of sugerencia.areas) {
    if (area.nivel === null || descartadas.has(area.areaOrden)) {
      continue;
    }
    if ((draft[area.areaOrden]?.nivelExigencia ?? null) === null) {
      niveles[area.areaOrden] = area.nivel;
    }
  }
  return niveles;
}
