/**
 * Envoltorio de respuesta exitosa del backend
 * (shared/api/ApiResponse en TeselaBackend).
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}
