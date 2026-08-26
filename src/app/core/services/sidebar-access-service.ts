import { Injectable, computed, inject } from '@angular/core';

import {
  ADMIN_PLATAFORMA_SIDEBAR_ITEMS,
  USUARIO_SIDEBAR_ITEMS,
} from '../../layout/components/sidebar/sidebar.config';
import { GlobalRole, SidebarItem } from '../models/sidebar-item';
import { TokenService } from './token-service';

/** Cantidad maxima de tabs fijos del bottom nav antes del boton "Mas". */
const MAX_BOTTOM_NAV_TABS = 4;

@Injectable({
  providedIn: 'root',
})
export class SidebarAccessService {
  private readonly tokenService = inject(TokenService);

  readonly globalRole = this.tokenService.role;

  readonly sidebarItems = computed<SidebarItem[]>(() => {
    const globalRole = this.globalRole();

    if (globalRole === 'ADMIN_PLATAFORMA') {
      return this.filterItemsByAccess(ADMIN_PLATAFORMA_SIDEBAR_ITEMS, globalRole);
    }

    if (globalRole === 'USUARIO') {
      return this.filterItemsByAccess(USUARIO_SIDEBAR_ITEMS, globalRole);
    }

    return [];
  });

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
