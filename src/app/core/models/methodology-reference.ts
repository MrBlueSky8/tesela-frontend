import { AlertType } from './compatibility-cross';

export interface MethodologyVersionItem {
  tipo: string;
  codigo: string;
  descripcion: string;
}

/** Grado de compatibilidad por brecha, con el techo que impone si es crítica. */
export interface MethodologyGrade {
  numero: number;
  etiqueta: string;
  brecha: string;
  valor: number;
  techo: number | null;
}

export interface MethodologyBucket {
  criticidad: string;
  pesoBase: number;
  promedio: string;
  veta: boolean;
}

export interface MethodologyCategory {
  codigo: string;
  etiqueta: string;
  intervalo: string;
}

export interface MethodologyAlertItem {
  codigo: string;
  tipo: AlertType;
  seccion: string;
  evaluaModoA: boolean;
  mensaje: string;
  accionRecomendada: string;
}

/**
 * Espejo de methodology/dto/MethodologyReferenceResponse. Documenta lo que el
 * sistema aplica de verdad: se arma desde los enums del motor y el catálogo
 * sembrado, no desde texto copiado de la guía.
 */
export interface MethodologyReference {
  versiones: MethodologyVersionItem[];
  grados: MethodologyGrade[];
  bolsas: MethodologyBucket[];
  categorias: MethodologyCategory[];
  alertas: MethodologyAlertItem[];
}
