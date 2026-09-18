import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CompanyContextService } from '../../core/services/company-context-service';
import { BottomNav } from '../components/bottom-nav/bottom-nav';
import { Sidebar } from '../components/sidebar/sidebar';
import { Topbar } from '../components/topbar/topbar';

/**
 * Shell autenticado. En escritorio replica el layout de las maquetas
 * (alto fijo, sidebar + topbar, scroll interno en `.content`).
 * Por debajo de 1024px el sidebar se oculta y navega el bottom nav.
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Sidebar, Topbar, BottomNav],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {
  private readonly companyContext = inject(CompanyContextService);

  constructor() {
    // Carga la empresa guardada (o la unica del usuario) para que el sidebar
    // muestre la gestion y los modulos sin esperar a una ruta protegida.
    this.companyContext.restore().subscribe();
  }

  /** Al volver a la pestana se refrescan los privilegios (con limite de frecuencia). */
  @HostListener('window:focus')
  onWindowFocus(): void {
    this.companyContext.refreshAccess();
  }
}
