import { Injectable, computed, inject } from '@angular/core';

import {
  ADMIN_PLATAFORMA_SIDEBAR_SECTIONS,
  USUARIO_SIDEBAR_SECTIONS,
} from '../../layout/components/sidebar/sidebar.config';
import { GlobalRole, SidebarItem, SidebarSection } from '../models/sidebar-item';
import { TokenService } from './token-service';

/** Cantidad maxima de tabs fijos del bottom nav antes del boton "Mas". */
const MAX_BOTTOM_NAV_TABS = 4;

@Injectable({
  providedIn: 'root',
})
export class SidebarAccessService {
  private readonly tokenService = inject(TokenService);

  readonly globalRole = this.tokenService.role;

  readonly sidebarSections = computed<SidebarSection[]>(() => {
    const globalRole = this.globalRole();

    if (globalRole === 'ADMIN_PLATAFORMA') {
      return this.filterSectionsByAccess(ADMIN_PLATAFORMA_SIDEBAR_SECTIONS, globalRole);
    }

    if (globalRole === 'USUARIO') {
      return this.filterSectionsByAccess(USUARIO_SIDEBAR_SECTIONS, globalRole);
    }

    return [];
  });

  /** Todos los items visibles, sin agrupar. Lo consume el bottom nav movil. */
  readonly sidebarItems = computed<SidebarItem[]>(() =>
    this.sidebarSections().flatMap((section) => section.items),
  );

  readonly bottomNavItems = computed(() =>
    [...this.sidebarItems()]
      .filter((item) => item.mobileTab)
      .sort(
        (a, b) =>
          (a.mobileOrder ?? Number.MAX_SAFE_INTEGER) - (b.mobileOrder ?? Number.MAX_SAFE_INTEGER),
      )
      .slice(0, MAX_BOTTOM_NAV_TABS),
  );

  readonly bottomNavOverflowItems = computed(() => {
    const primaryIds = new Set(this.bottomNavItems().map((item) => item.id));

    return this.sidebarItems().filter((item) => !primaryIds.has(item.id));
  });

  private filterSectionsByAccess(
    sections: SidebarSection[],
    globalRole: GlobalRole | null,
  ): SidebarSection[] {
    return sections
      .map((section) => ({
        ...section,
        items: this.filterItemsByAccess(section.items, globalRole),
      }))
      .filter((section) => section.items.length > 0);
  }

  private filterItemsByAccess(items: SidebarItem[], globalRole: GlobalRole | null): SidebarItem[] {
    return items
      .filter((item) => this.canAccessItem(item, globalRole))
      .map((item) => ({
        ...item,
        children: item.children ? this.filterItemsByAccess(item.children, globalRole) : undefined,
      }))
      .filter((item) => !item.children || !!item.route || item.children.length > 0);
  }

  private canAccessItem(item: SidebarItem, globalRole: GlobalRole | null): boolean {
    return (
      !item.allowedGlobalRoles?.length ||
      (!!globalRole && item.allowedGlobalRoles.includes(globalRole))
    );
  }
}
