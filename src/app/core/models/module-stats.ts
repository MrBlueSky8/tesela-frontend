import { CompatibilityCategory } from './compatibility-cross';

/** Un puesto activo que todavía no tiene evaluación publicada. */
export interface PendingPosition {
  publicId: string;
  nombre: string;
  enBorrador: boolean;
}

/** Espejo de methodology/dto/ModuleStatsResponse. */
export interface ModuleStats {
  puestosActivos: number;
  puestosEvaluados: number;
  puestosEnBorrador: number;
  /** Cuáles faltan, no solo cuántos: así el aviso es accionable. */
  puestosSinEvaluar: PendingPosition[];

  postulantes: number;
  postulantesEvaluados: number;

  crucesGenericos: number;
  crucesPersonales: number;
  crucesDesactualizados: number;
  alertasSeguridad: number;

  categoriasModoA: Record<CompatibilityCategory, number>;
  categoriasModoB: Record<CompatibilityCategory, number>;
}

/** Respuesta del recálculo por tandas. */
export interface RecalculationBatch {
  procesados: number;
  restantes: number;
}
