import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';

import { AiOutputMeta } from '../../../core/models/compatibility-cross';

/**
 * Formato estándar de todo contenido asistido por IA en el informe (Hito 4,
 * entregable 7): la misma cabecera con su insignia y estado, el mismo aviso de
 * que no es un veredicto, y el mismo sello de trazabilidad (modelo, fecha,
 * quién lo pidió, si se corrigió, quién lo aprobó y cuándo).
 *
 * <p>El cuerpo y las acciones los pone cada sección por proyección de contenido.
 */
@Component({
  selector: 'app-ai-output-frame',
  imports: [DatePipe],
  templateUrl: './ai-output-frame.html',
  styleUrl: './ai-output-frame.scss',
})
export class AiOutputFrame {
  readonly titulo = input.required<string>();
  readonly headingId = input.required<string>();
  /** Nulo mientras no hay salida generada. */
  readonly meta = input<AiOutputMeta | null>(null);
  /** Durante la edición el sello no aplica todavía. */
  readonly showStamp = input(true);
  /** En el informe impreso las acciones y el aviso de pendiente no se muestran. */
  readonly printMode = input(false);
}
