import { Component, computed, input, output, signal } from '@angular/core';

import { ModalShell } from '../modal-shell/modal-shell';

export type ConfirmTone = 'danger' | 'warning' | 'info';

/**
 * Dialogo de confirmacion. Envuelve a {@link ModalShell} sin titulo, que es la
 * forma del mockup: icono centrado, titulo grande y dos acciones.
 *
 * <p>Al reusar el contenedor hereda foco, Escape y bloqueo de scroll sin
 * duplicar nada.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [ModalShell],
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly message = input<string>();
  readonly tone = input<ConfirmTone>('danger');
  readonly icon = input<string>();
  readonly confirmLabel = input('Confirmar');
  readonly cancelLabel = input('Cancelar');

  /** Deshabilita las acciones mientras la operacion está en curso. */
  readonly busy = input(false);

  /** El titulo vive en el cuerpo, asi que el contenedor necesita su id para nombrar el dialogo. */
  readonly titleId = signal(`confirm-title-${Math.random().toString(36).slice(2, 10)}`);

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  readonly iconName = computed(() => {
    const explicit = this.icon();
    if (explicit) {
      return explicit;
    }

    return {
      danger: 'trash',
      warning: 'alert-triangle',
      info: 'info-circle',
    }[this.tone()];
  });

  readonly confirmButtonClass = computed(() =>
    this.tone() === 'danger' ? 'btn btn-ghost-red btn-sm' : 'btn btn-primary btn-sm',
  );
}
