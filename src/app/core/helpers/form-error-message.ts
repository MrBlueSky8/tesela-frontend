import { AbstractControl } from '@angular/forms';

/** Mensajes por validador, en el orden de prioridad con que se muestran. */
const VALIDATION_MESSAGES: Record<string, string> = {
  required: 'Este campo es obligatorio.',
  email: 'Ingresa un correo válido.',
  maxlength: 'Supera la longitud permitida.',
  pattern: 'El formato no es válido.',
  min: 'El valor es menor al permitido.',
};

/**
 * Mensaje del primer error de un control, solo si el usuario ya lo toco.
 * Si no hay error de cliente, devuelve el del backend para ese campo (si llego).
 */
export function controlErrorMessage(
  control: AbstractControl,
  serverError?: string | null,
): string | null {
  if ((control.touched || control.dirty) && control.errors) {
    const firstKey = Object.keys(VALIDATION_MESSAGES).find((key) => control.errors?.[key]);
    return firstKey ? VALIDATION_MESSAGES[firstKey] : 'El valor no es válido.';
  }

  return serverError ?? null;
}
