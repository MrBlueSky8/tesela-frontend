import { DestroyRef, inject, signal } from '@angular/core';

/** Se lee como un signal (`mensaje()`) y se escribe como antes (`mensaje.set(...)`). */
export type TransientMessage = (() => string | null) & {
  set(value: string | null): void;
};

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Aviso que se borra solo pasados unos segundos, para que un "guardado
 * correctamente" no quede fijo en pantalla el resto de la sesion.
 *
 * <p>Solo para confirmaciones: un error debe permanecer hasta que el usuario
 * actue. Debe crearse en un contexto de inyeccion (campo del componente) para
 * poder cancelar el temporizador al destruirlo.
 */
export function transientMessage(timeoutMs = DEFAULT_TIMEOUT_MS): TransientMessage {
  const state = signal<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  inject(DestroyRef).onDestroy(cancel);

  const message = (() => state()) as TransientMessage;

  message.set = (value: string | null) => {
    cancel();
    state.set(value);

    if (value) {
      timer = setTimeout(() => {
        timer = null;
        state.set(null);
      }, timeoutMs);
    }
  };

  return message;
}
