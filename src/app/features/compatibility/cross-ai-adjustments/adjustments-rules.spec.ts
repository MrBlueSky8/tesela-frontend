import { CrossAdjustment, CrossAdjustmentsProposal } from '../../../core/models/compatibility-cross';
import { aSolicitud, accionesDe, borradorDe, erroresDe, ordenados, referenciaDe } from './adjustments-rules';

function ajuste(prioridad: CrossAdjustment['prioridad'], texto: string, area: number | null = 16): CrossAdjustment {
  return {
    areaOrden: area,
    areaNombre: area === null ? null : 'Manipulación y transporte de cargas',
    alerta: area === null ? 'S01' : null,
    tipo: 'AYUDA_TECNICA',
    prioridad,
    ajuste: texto,
    justificacion: 'Porque sí.',
  };
}

function propuesta(estado: CrossAdjustmentsProposal['estado'], ajustes: CrossAdjustment[]): CrossAdjustmentsProposal {
  return {
    publicId: 'csi_1', estado, modelo: 'gpt-6.1-sol', versionPrompt: 'ajustes-razonables-00000000',
    generadaEn: '2026-11-14T10:00:00Z', editada: false, solicitadaPor: 'Ana', aprobadaPor: null, aprobadaEn: null,
    ajustes, notaGeneral: null,
  };
}

describe('ajustes razonables', () => {
  it('ordena por prioridad sin alterar el orden dentro de cada una', () => {
    const lista = [ajuste('BAJA', 'c'), ajuste('ALTA', 'a1'), ajuste('MEDIA', 'b'), ajuste('ALTA', 'a2')];
    expect(ordenados(lista).map((a) => a.ajuste)).toEqual(['a1', 'a2', 'b', 'c']);
  });

  it('solo un borrador se revisa; generar depende de que esté permitido', () => {
    expect(accionesDe({ permitida: true, motivo: null, propuesta: propuesta('APROBADA', []) }))
      .toEqual({ generar: true, revisar: false });
    expect(accionesDe({ permitida: false, motivo: 'x', propuesta: propuesta('BORRADOR', []) }))
      .toEqual({ generar: false, revisar: true });
  });

  it('el borrador no comparte referencias con la propuesta', () => {
    const original = propuesta('BORRADOR', [ajuste('ALTA', 'Texto')]);
    const draft = borradorDe(original);
    draft.ajustes[0].ajuste = 'Cambiado';
    expect(original.ajustes[0].ajuste).toBe('Texto');
  });

  it('avisa un ajuste vacío y arma la solicitud recortada', () => {
    const draft = borradorDe(propuesta('BORRADOR', [ajuste('ALTA', '  Proveer carro.  ')]));
    expect(erroresDe(draft)).toEqual([]);
    expect(aSolicitud(draft).ajustes[0]).toEqual({
      areaOrden: 16, alerta: null, tipo: 'AYUDA_TECNICA', prioridad: 'ALTA',
      ajuste: 'Proveer carro.', justificacion: 'Porque sí.',
    });
    draft.ajustes[0].ajuste = ' ';
    expect(erroresDe(draft)).toEqual(['El ajuste 1 no puede quedar vacío.']);
  });

  it('describe a qué responde cada ajuste', () => {
    expect(referenciaDe(ajuste('ALTA', 'x'))).toBe('Área 16 · Manipulación y transporte de cargas');
    expect(referenciaDe(ajuste('ALTA', 'x', null))).toBe('Alerta S01');
  });
});
