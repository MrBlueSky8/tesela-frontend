export const environment = {
  production: true,
  /**
   * En produccion el frontend se sirve detras del mismo origen que el API,
   * o se reemplaza este valor por la URL publica del backend.
   */
  base: '',
  platform: 'TESELA' as const,
};
