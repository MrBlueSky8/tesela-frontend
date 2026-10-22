import { Component, input, output } from '@angular/core';

import { CATEGORY_BADGES } from '../../../core/helpers/methodology-labels';
import { CompatibilityCrossSummary } from '../../../core/models/compatibility-cross';

/**
 * Lista de resultados de compatibilidad, de mayor a menor.
 *
 * <p>La usan los dos sentidos del ranking: los cruces de un puesto y los de
 * una persona. Lo unico que cambia es que nombre se muestra en la fila, asi
 * que el padre lo elige con {@link nameField} en vez de duplicar la tabla.
 */
@Component({
  selector: 'app-cross-ranking',
  imports: [],
  templateUrl: './cross-ranking.html',
  styleUrl: './cross-ranking.scss',
})
export class CrossRanking {
  readonly crosses = input.required<CompatibilityCrossSummary[]>();

  /** Que nombre identifica la fila: la contraparte del cruce o el puesto. */
  readonly nameField = input<'contraparte' | 'puestoNombre'>('contraparte');
  readonly columnLabel = input('Perfil');
  readonly emptyText = input('Todavía no hay resultados.');

  /** publicId del cruce sobre el que se pidió el detalle. */
  readonly selected = output<string>();

  readonly categoryBadges = CATEGORY_BADGES;

  nombreDe(cross: CompatibilityCrossSummary): string {
    return this.nameField() === 'puestoNombre' ? cross.puestoNombre : cross.contraparte;
  }
}
