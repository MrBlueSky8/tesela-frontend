import {
  CrossInterpretation,
  CrossInterpretationState,
  UpdateCrossInterpretationRequest,
} from '../../../core/models/compatibility-cross';

/** Lo que el evaluador está corrigiendo, campo a campo. */
export interface InterpretationDraft {
  resumen: string;
  factores: { areaOrden: number; areaNombre: string; explicacion: string }[];
  consideraciones: string;
  limitaciones: string;
}

export interface InterpretationActions {
  /** Pedir a la IA una interpretación (nueva o la primera). */
  generar: boolean;
  /** Corregir y aprobar: solo un borrador. Una aprobada no se toca: se genera otra. */
  revisar: boolean;
}

export function accionesDe(state: CrossInterpretationState | null): InterpretationActions {
  return {
    generar: state?.permitida ?? false,
    revisar: state?.interpretacion?.estado === 'BORRADOR',
  };
}

export function borradorDe(interpretacion: CrossInterpretation): InterpretationDraft {
  return {
    resumen: interpretacion.resumen,
    factores: interpretacion.factores.map((f) => ({ ...f })),
    consideraciones: interpretacion.consideraciones ?? '',
    limitaciones: interpretacion.limitaciones ?? '',
  };
}

/** Errores que el servidor rechazaría; se avisan antes de enviar. */
export function erroresDe(draft: InterpretationDraft): string[] {
  const errores: string[] = [];
  if (!draft.resumen.trim()) errores.push('El resumen no puede quedar vacío.');
  if (draft.resumen.length > 1200) errores.push('El resumen supera los 1200 caracteres.');
  draft.factores.forEach((f) => {
    if (!f.explicacion.trim()) errores.push(`Falta la explicación de ${f.areaNombre}.`);
    if (f.explicacion.length > 500) errores.push(`La explicación de ${f.areaNombre} supera los 500 caracteres.`);
  });
  if (draft.consideraciones.length > 800) errores.push('Las consideraciones superan los 800 caracteres.');
  if (draft.limitaciones.length > 800) errores.push('Las limitaciones superan los 800 caracteres.');
  return errores;
}

export function aSolicitud(draft: InterpretationDraft): UpdateCrossInterpretationRequest {
  return {
    resumen: draft.resumen.trim(),
    factores: draft.factores.map((f) => ({ areaOrden: f.areaOrden, explicacion: f.explicacion.trim() })),
    consideraciones: draft.consideraciones.trim(),
    limitaciones: draft.limitaciones.trim(),
  };
}
