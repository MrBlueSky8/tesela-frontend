import { CrossInterpretation, CrossInterpretationState } from '../../../core/models/compatibility-cross';
import { aSolicitud, accionesDe, borradorDe, erroresDe } from './interpretation-rules';

function interpretacion(estado: CrossInterpretation['estado']): CrossInterpretation {
  return {
    publicId: 'cin_1',
    estado,
    modelo: 'gpt-6.1-sol',
    versionPrompt: 'interpretacion-brechas-00000000',
    generadaEn: '2026-11-14T10:00:00Z',
    resumen: 'El área crítica fija el techo.',
    factores: [{ areaOrden: 16, areaNombre: 'Manipulación y transporte de cargas', explicacion: 'E5 frente a C3.' }],
    consideraciones: null,
    limitaciones: 'No considera ajustes.',
    editada: false,
    solicitadaPor: 'Ana',
    aprobadaPor: null,
    aprobadaEn: null,
  };
}

function estado(permitida: boolean, i: CrossInterpretation | null): CrossInterpretationState {
  return { permitida, motivo: permitida ? null : 'No disponible.', interpretacion: i };
}

describe('accionesDe', () => {
  it('sin IA disponible no se genera, pero un borrador existente se puede revisar', () => {
    expect(accionesDe(estado(false, interpretacion('BORRADOR')))).toEqual({ generar: false, revisar: true });
  });

  it('una aprobada ya no se revisa: se genera otra', () => {
    expect(accionesDe(estado(true, interpretacion('APROBADA')))).toEqual({ generar: true, revisar: false });
  });

  it('sin estado no hay acciones', () => {
    expect(accionesDe(null)).toEqual({ generar: false, revisar: false });
  });
});

describe('edición', () => {
  it('el borrador copia los textos sin compartir referencias', () => {
    const original = interpretacion('BORRADOR');
    const draft = borradorDe(original);
    draft.factores[0].explicacion = 'Cambiada';
    expect(original.factores[0].explicacion).toBe('E5 frente a C3.');
    expect(draft.consideraciones).toBe('');
  });

  it('avisa lo que el servidor rechazaría', () => {
    const draft = borradorDe(interpretacion('BORRADOR'));
    draft.resumen = '   ';
    draft.factores[0].explicacion = '';
    expect(erroresDe(draft)).toEqual([
      'El resumen no puede quedar vacío.',
      'Falta la explicación de Manipulación y transporte de cargas.',
    ]);
  });

  it('la solicitud va recortada y sin el nombre del área', () => {
    const draft = borradorDe(interpretacion('BORRADOR'));
    draft.resumen = '  Nuevo resumen.  ';
    expect(aSolicitud(draft)).toEqual({
      resumen: 'Nuevo resumen.',
      factores: [{ areaOrden: 16, explicacion: 'E5 frente a C3.' }],
      consideraciones: '',
      limitaciones: 'No considera ajustes.',
    });
  });
});
