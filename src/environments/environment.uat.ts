export const environment = {
  production: true,
  /**
   * UAT: el frontend se sirve como sitio estatico y llama al backend de UAT
   * en Render (otro origen). El backend debe incluir la URL del frontend en
   * CORS_ALLOWED_ORIGINS.
   */
  base: 'https://teselabackend.onrender.com',
  platform: 'ADAPTIA' as const,
};
