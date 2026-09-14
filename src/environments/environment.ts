export const environment = {
  production: false,
  /**
   * Base del API. Vacio en desarrollo para que las peticiones salgan como
   * rutas relativas (/api/...) y las resuelva el proxy de `ng serve`.
   */
  base: '',
  platform: 'ADAPTIA' as const,
};
