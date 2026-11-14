import {
  AdjustmentPriority,
  CrossAdjustment,
  CrossAdjustmentsProposal,
  CrossAdjustmentsState,
  UpdateCrossAdjustmentsRequest,
} from '../../../core/models/compatibility-cross';

/** Lo que el evaluador está corrigiendo. En la versión base no se agregan ajustes. */
export interface AdjustmentsDraft {
  ajustes: CrossAdjustment[];
  notaGeneral: string;
}

export interface AdjustmentsActions {
  generar: boolean;
  revisar: boolean;
}

const ORDEN: Record<AdjustmentPriority, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };

export function accionesDe(state: CrossAdjustmentsState | null): AdjustmentsActions {
  return {
    generar: state?.permitida ?? false,
    revisar: state?.propuesta?.estado === 'BORRADOR',
  };
}

/** De mayor a menor prioridad, respetando el orden propuesto dentro de cada una. */
export function ordenados(ajustes: CrossAdjustment[]): CrossAdjustment[] {
  return ajustes
    .map((a, i) => ({ a, i }))
    .sort((x, y) => ORDEN[x.a.prioridad] - ORDEN[y.a.prioridad] || x.i - y.i)
    .map(({ a }) => a);
}

export function borradorDe(propuesta: CrossAdjustmentsProposal): AdjustmentsDraft {
  return {
    ajustes: propuesta.ajustes.map((a) => ({ ...a })),
    notaGeneral: propuesta.notaGeneral ?? '',
  };
}

/** Errores que el servidor rechazaría; se avisan antes de enviar. */
export function erroresDe(draft: AdjustmentsDraft): string[] {
  const errores: string[] = [];
  draft.ajustes.forEach((a, i) => {
    if (!a.ajuste.trim()) errores.push(`El ajuste ${i + 1} no puede quedar vacío.`);
    if (a.ajuste.length > 400) errores.push(`El ajuste ${i + 1} supera los 400 caracteres.`);
    if ((a.justificacion ?? '').length > 400) errores.push(`La justificación del ajuste ${i + 1} supera los 400 caracteres.`);
  });
  if (draft.notaGeneral.length > 800) errores.push('La nota general supera los 800 caracteres.');
  return errores;
}

export function aSolicitud(draft: AdjustmentsDraft): UpdateCrossAdjustmentsRequest {
  return {
    ajustes: draft.ajustes.map((a) => ({
      areaOrden: a.areaOrden,
      alerta: a.alerta,
      tipo: a.tipo,
      prioridad: a.prioridad,
      ajuste: a.ajuste.trim(),
      justificacion: (a.justificacion ?? '').trim(),
    })),
    notaGeneral: draft.notaGeneral.trim(),
  };
}

/** A qué responde el ajuste, para mostrarlo: área, alerta o ambas. */
export function referenciaDe(a: CrossAdjustment): string {
  const partes: string[] = [];
  if (a.areaOrden !== null) partes.push(`Área ${a.areaOrden}${a.areaNombre ? ' · ' + a.areaNombre : ''}`);
  if (a.alerta) partes.push(`Alerta ${a.alerta}`);
  return partes.join(' · ');
}
