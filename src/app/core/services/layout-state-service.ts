import { Injectable, signal } from '@angular/core';

/**
 * Estado compartido del shell autenticado. Vive fuera del sidebar porque el
 * boton de colapso esta en el topbar (las maquetas no dejan sitio para el
 * en el bloque de logo).
 */
@Injectable({
  providedIn: 'root',
})
export class LayoutStateService {
  readonly sidebarCollapsed = signal(false);

  toggleSidebar(): void {
    this.sidebarCollapsed.update((value) => !value);
  }
}
