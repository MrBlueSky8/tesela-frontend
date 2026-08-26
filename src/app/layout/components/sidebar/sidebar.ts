import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SidebarItem as SidebarItemModel } from '../../../core/models/sidebar-item';
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
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  readonly collapsed = signal(false);

  /** Acordeon controlado: solo un item con submenus abierto a la vez. */
  readonly openItemId = signal<string | null>(null);

  readonly items = this.sidebarAccessService.sidebarItems;
  readonly globalRole = this.sidebarAccessService.globalRole;

  readonly username = computed(() => this.tokenService.username() ?? 'Usuario');

  readonly initial = computed(() => this.username().charAt(0).toUpperCase());

  readonly contextLabel = computed(() => {
    const role = this.globalRole();
    return role ? (ROLE_LABELS[role] ?? role) : 'Sin rol global';
  });

  toggleCollapse(): void {
    this.collapsed.update((value) => !value);

    if (this.collapsed()) {
      this.openItemId.set(null);
    }
  }

  handleToggle(id: string): void {
    // Si el sidebar esta compactado, primero lo expandimos y abrimos el acordeon.
    if (this.collapsed()) {
      this.collapsed.set(false);
      this.openItemId.set(id);
      return;
    }

    // Single-open: abre este y cierra los demas; si ya estaba abierto, lo cierra.
    this.openItemId.update((current) => (current === id ? null : id));
  }

  handleAction(item: SidebarItemModel): void {
    if (item.action === 'logout') {
      this.authService.logout();
      void this.router.navigate(['/login']);
    }
  }
}
