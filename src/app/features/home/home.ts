import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SidebarItem } from '../../core/models/sidebar-item';
import { CompanyContextService } from '../../core/services/company-context-service';
import { SidebarAccessService } from '../../core/services/sidebar-access-service';
import { TokenService } from '../../core/services/token-service';

/** Secciones del sidebar que se ofrecen como accesos directos en el inicio. */
const SHORTCUT_SECTIONS = ['plataforma', 'gestion', 'modulos'];

/**
 * Inicio segun el rol: accesos directos a lo que el usuario puede usar,
 * calculados con las mismas reglas que el sidebar (rol global y privilegios
 * efectivos en la empresa seleccionada).
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly tokenService = inject(TokenService);
  private readonly sidebarAccess = inject(SidebarAccessService);
  private readonly companyContext = inject(CompanyContextService);

  readonly username = computed(() => this.tokenService.username() ?? 'Usuario');

  /** Confirmacion del cambio de empresa hecho desde el encabezado. */
  readonly switchedCompany = this.companyContext.justSwitchedTo;
  readonly isPlatformAdmin = computed(() => this.tokenService.role() === 'ADMIN_PLATAFORMA');
  readonly company = this.companyContext.company;

  readonly sections = computed(() =>
    this.sidebarAccess
      .sidebarSections()
      .filter((section) => SHORTCUT_SECTIONS.includes(section.id))
      .map((section) => ({ ...section, items: section.items.filter((item) => !!item.route) }))
      .filter((section) => section.items.length > 0),
  );

  /** Nombre del icono Tabler o color del punto. */
  iconValue(item: SidebarItem): string {
    const icon = item.icon;
    return !icon ? '' : icon.type === 'tabler' ? icon.name : icon.color;
  }

  /** Usuario de empresa con empresa elegida pero sin nada que usar en ella. */
  readonly withoutPrivileges = computed(
    () =>
      !this.isPlatformAdmin() &&
      !!this.company() &&
      !this.sections().some((section) => section.id !== 'plataforma'),
  );
}
