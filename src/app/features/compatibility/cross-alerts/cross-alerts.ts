import { Component, input } from '@angular/core';

import {
  ALERT_TYPE_BADGES,
  ALERT_TYPE_LABELS,
} from '../../../core/helpers/methodology-labels';
import { CrossAlert } from '../../../core/models/compatibility-cross';

/**
 * Lista de alertas de un cruce.
 *
 * <p>La usan las dos secciones del informe que pide la guia v3.1 (7.5): las
 * de seguridad, que abren, y las informativas. Lo unico que cambia es el
 * enfasis, asi que el padre pasa el subconjunto ya filtrado y dice cual es.
 */
@Component({
  selector: 'app-cross-alerts',
  imports: [],
  templateUrl: './cross-alerts.html',
  styleUrl: './cross-alerts.scss',
})
export class CrossAlerts {
  readonly alerts = input.required<CrossAlert[]>();

  /** Las de seguridad se pintan con el enfasis maximo que pide la guia. */
  readonly emphasis = input(false);

  readonly typeLabels = ALERT_TYPE_LABELS;
  readonly typeBadges = ALERT_TYPE_BADGES;
}
