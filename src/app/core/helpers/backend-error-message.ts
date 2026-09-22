import { HttpErrorResponse } from '@angular/common/http';

import { ApiError } from '../models/api-error';

/**
 * Extrae el mensaje util de un error del backend.
 * TeselaBackend responde los errores con la forma `ApiError`, que trae
 * `message` ya redactado en espanol desde GlobalExceptionHandler.
 */
export function backendErrorMessage(
  error: unknown,
  fallback = 'Ocurrió un error inesperado. Intenta nuevamente.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'No pudimos conectar con el servidor. Verifica tu conexión o intenta nuevamente en unos minutos.';
  }

  const body = error.error as Partial<ApiError> | null | undefined;

  if (body && typeof body.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }

  return fallback;
}

/**
 * Errores de validacion por campo (`MethodArgumentNotValidException` -> 400).
 */
export function backendFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof HttpErrorResponse)) {
    return {};
  }

  const body = error.error as Partial<ApiError> | null | undefined;

  return body?.fieldErrors ?? {};
}
