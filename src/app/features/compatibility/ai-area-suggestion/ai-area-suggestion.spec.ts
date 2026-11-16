import { TestBed } from '@angular/core/testing';

import { AiAreaSuggestion } from '../../../core/models/position-evaluation';
import { AiAreaSuggestionCard } from './ai-area-suggestion';

/** QA 3.11 y 3.12: la tarjeta distingue la regla aplicada de la cita del puesto. */
describe('AiAreaSuggestionCard', () => {
  const REGLA = 'Conducción de motocicleta (entorno del puesto): mínimo E4 y esencial.';

  function render(s: Partial<AiAreaSuggestion>): string {
    const fixture = TestBed.createComponent(AiAreaSuggestionCard);
    fixture.componentRef.setInput('suggestion', {
      areaOrden: 1,
      areaNombre: 'Visión',
      nivel: 4,
      criticidad: 'CRITICA',
      confianza: 'ALTA',
      justificacion: '',
      estado: 'SUGERIDA',
      ...s,
    } satisfies AiAreaSuggestion);
    fixture.componentRef.setInput('editable', false);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  }

  it('la regla que confirma el nivel de la IA se muestra junto a la cita', () => {
    const t = render({ justificacion: 'Conduciendo motocicleta en tránsito urbano', regla: REGLA });
    expect(t).toContain(`Regla aplicada: ${REGLA}`);
    expect(t).toContain('Cita del puesto: «Conduciendo motocicleta en tránsito urbano»');
  });

  it('un nivel que puso la regla muestra solo la regla', () => {
    const t = render({ estado: 'REGLA', justificacion: `Regla aplicada: ${REGLA}`, regla: REGLA });
    expect(t).toContain(`Regla aplicada: ${REGLA}`);
    expect(t).not.toContain('Cita del puesto');
    expect(t.split('Regla aplicada').length - 1).toBe(1);
  });

  it('sin regla, solo la cita', () => {
    const t = render({ justificacion: 'Atiende público', regla: null });
    expect(t).toContain('Cita del puesto: «Atiende público»');
    expect(t).not.toContain('Regla aplicada');
  });

  it('una sugerencia anterior al campo regla sigue mostrando la regla de su justificación', () => {
    const t = render({ estado: 'REGLA', justificacion: 'Regla CONDUCCION: conducir es parte del puesto.' });
    expect(t).toContain('Regla CONDUCCION: conducir es parte del puesto.');
    expect(t).not.toContain('Cita del puesto');
  });
});
