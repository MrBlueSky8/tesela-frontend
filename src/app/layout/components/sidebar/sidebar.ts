import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { SidebarItem as SidebarItemModel } from '../../../core/models/sidebar-item';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { LayoutStateService } from '../../../core/services/layout-state-service';
import { SidebarAccessService } from '../../../core/services/sidebar-access-service';
import { TokenService } from '../../../core/services/token-service';
import { AuthService } from '../../../features/auth/auth-service';
import { SidebarItem } from './sidebar-item';

const ROLE_LABELS: Record<string, string> = {
  ADMIN_PLATAFORMA: 'Administrador de plataforma',
  USUARIO: 'Usuario',
};

@Component({
  selector: 'app-sidebar',
  imports: [SidebarItem],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {
  private readonly sidebarAccessService = inject(SidebarAccessService);
  private readonly layoutState = inject(LayoutStateService);
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);
  private readonly companyContext = inject(CompanyContextService);

  readonly collapsed = this.layoutState.sidebarCollapsed;

  readonly sections = this.sidebarAccessService.sidebarSections;
  readonly globalRole = this.sidebarAccessService.globalRole;

  readonly company = this.companyContext.company;

  /** Inicial de la empresa para cuando no hay logo o el sidebar esta compactado. */
  readonly companyInitial = computed(
    () => this.company()?.nombre.trim().charAt(0).toUpperCase() ?? '',
  );

  readonly username = computed(() => this.tokenService.username() ?? 'Usuario');

  /** Iniciales para el avatar del pie: dos letras del correo. */
  readonly initials = computed(() =>
    this.username()
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 2)
      .toUpperCase(),
  );

  readonly roleLabel = computed(() => {
    const role = this.globalRole();
    return role ? (ROLE_LABELS[role] ?? role) : 'Sin rol global';
  });

  handleAction(item: SidebarItemModel): void {
    if (item.action === 'logout') {
      this.authService.logout();
      void this.router.navigate(['/login']);
    }
  }
}
