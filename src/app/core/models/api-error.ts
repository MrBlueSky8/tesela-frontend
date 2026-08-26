/**
 * Cuerpo de error del backend (shared/error/ApiError en TeselaBackend).
 * Ojo: la forma NO coincide con ApiResponse; los errores traen `code`,
 * `status`, `path` y, en validaciones, `fieldErrors`.
 */
export interface ApiError {
  success: false;
  message: string;
  code: string;
  status: number;
  path: string;
  timestamp: string;
  fieldErrors?: Record<string, string>;
}
