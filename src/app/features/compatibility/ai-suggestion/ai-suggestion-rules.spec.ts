import { AiAreaSuggestion, AiLevelSuggestion } from '../../../core/models/position-evaluation';
import { estadoFrenteASugerencia, nivelesParaAreasVacias } from './ai-suggestion-rules';

function propuesta(
  areaOrden: number,
  nivel: number | null,
  criticidad: AiAreaSuggestion['criticidad'],
  confianza: AiAreaSuggestion['confianza'] = 'MEDIA',
): AiAreaSuggestion {
  return {
    areaOrden,
    areaNombre: `Área ${areaOrden}`,
    nivel,
    criticidad,
    confianza,
    justificacion: 'Justificación.',
    estado: nivel === null ? 'SIN_INFORMACION' : 'SUGERIDA',
  };
}

function sugerencia(areas: AiAreaSuggestion[]): AiLevelSuggestion {
  return {
    publicId: 'pes_1',
    modelo: 'gpt-6.1-sol',
    versionPrompt: 'sugerencia-niveles-00000000',
    generadaEn: '2026-11-14T10:00:00Z',
    notaGeneral: null,
    areasCriticas: 0,
    avisoCriticas: false,
    areasSinInformacion: 0,
    confiabilidadAlta: 0,
    confiabilidadMedia: areas.length,
    confiabilidadBaja: 0,
    areas,
  };
}

describe('estadoFrenteASugerencia (misma regla que el servidor)', () => {
  const area = propuesta(1, 3, 'CRITICA');

  it('coincide solo si nivel y criticidad son iguales', () => {
    expect(estadoFrenteASugerencia({ nivelExigencia: 3, criticidad: 'CRITICA' }, area)).toBe('COINCIDE');
  });

  it('cambiar solo la criticidad es modificar la propuesta', () => {
    expect(estadoFrenteASugerencia({ nivelExigencia: 3, criticidad: 'ALTA' }, area)).toBe('MODIFICADA');
  });

  it('cambiar el nivel es modificar la propuesta', () => {
    expect(estadoFrenteASugerencia({ nivelExigencia: 4, criticidad: 'CRITICA' }, area)).toBe('MODIFICADA');
  });

  it('un área incompleta está pendiente', () => {
    expect(estadoFrenteASugerencia({ nivelExigencia: 3, criticidad: null }, area)).toBe('PENDIENTE');
    expect(estadoFrenteASugerencia(undefined, area)).toBe('PENDIENTE');
  });

  it('sin datos de la IA no hay propuesta que comparar', () => {
    expect(estadoFrenteASugerencia({ nivelExigencia: 3, criticidad: 'ALTA' }, propuesta(1, null, null)))
      .toBe('SIN_PROPUESTA');
    expect(estadoFrenteASugerencia({ nivelExigencia: 3, criticidad: 'ALTA' }, undefined)).toBe('SIN_PROPUESTA');
  });
});

describe('nivelesParaAreasVacias', () => {
  const s = sugerencia([
    propuesta(1, 2, 'NORMAL'),
    propuesta(2, 4, 'CRITICA'),
    propuesta(3, null, null),
    propuesta(4, 5, 'ALTA'),
  ]);

  it('solo llena áreas sin nivel y nunca pisa lo que puso el evaluador', () => {
    const draft = { 2: { nivelExigencia: 1, criticidad: 'NORMAL' as const } };
    expect(nivelesParaAreasVacias(draft, s)).toEqual({ 1: 2, 4: 5 });
  });

  it('ignora las áreas sin información y las descartadas', () => {
    expect(nivelesParaAreasVacias({}, s, new Set([4]))).toEqual({ 1: 2, 2: 4 });
  });

  it('no aplica en bloque las propuestas de confiabilidad baja', () => {
    const conBaja = sugerencia([propuesta(1, 2, 'NORMAL', 'ALTA'), propuesta(2, 3, 'NORMAL', 'BAJA')]);
    expect(nivelesParaAreasVacias({}, conBaja)).toEqual({ 1: 2 });
  });

  it('un área con criticidad pero sin nivel también se considera vacía', () => {
    const draft = { 1: { nivelExigencia: null, criticidad: 'ALTA' as const } };
    expect(nivelesParaAreasVacias(draft, s)[1]).toBe(2);
  });
});
