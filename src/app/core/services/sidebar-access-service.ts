import { Injectable, computed, inject } from '@angular/core';

import { SIDEBAR_SECTIONS } from '../../layout/components/sidebar/sidebar.config';
import { CompanyPrivilege } from '../models/company';
import { GlobalRole, SidebarItem, SidebarSection } from '../models/sidebar-item';
import { CompanyContextService } from './company-context-service';
import { TokenService } from './token-service';

/** Cantidad maxima de tabs fijos del bottom nav antes del boton "Mas". */
const MAX_BOTTOM_NAV_TABS = 4;

/** Lo que decide si un item se ve: rol global y privilegios efectivos en la empresa. */
interface AccessSnapshot {
  globalRole: GlobalRole;
  hasCompany: boolean;
  privileges: ReadonlySet<CompanyPrivilege>;
}

@Injectable({
  providedIn: 'root',
})
export class SidebarAccessService {
  private readonly tokenService = inject(TokenService);
  private readonly companyContext = inject(CompanyContextService);

  readonly globalRole = this.tokenService.role;

  readonly sidebarSections = computed<SidebarSection[]>(() => {
    const globalRole = this.globalRole();

    if (!globalRole) {
      return [];
    }

    return this.filterSectionsByAccess(SIDEBAR_SECTIONS, {
      globalRole,
      hasCompany: this.companyContext.hasCompany(),
      privileges: this.companyContext.effectivePrivileges(),
    });
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
    access: AccessSnapshot,
  ): SidebarSection[] {
    return sections
      .map((section) => ({
        ...section,
        items: this.filterItemsByAccess(section.items, access),
      }))
      .filter((section) => section.items.length > 0);
  }

  private filterItemsByAccess(items: SidebarItem[], access: AccessSnapshot): SidebarItem[] {
    return items
      .filter((item) => this.canAccessItem(item, access))
      .map((item) => ({
        ...item,
        children: item.children ? this.filterItemsByAccess(item.children, access) : undefined,
      }))
      .filter((item) => !item.children || !!item.route || item.children.length > 0);
  }

  private canAccessItem(item: SidebarItem, access: AccessSnapshot): boolean {
    const roleAllowed =
      !item.allowedGlobalRoles?.length || item.allowedGlobalRoles.includes(access.globalRole);

    if (!roleAllowed) {
      return false;
    }

    if (!item.allowedPrivileges?.length) {
      return true;
    }

    return (
      access.hasCompany &&
      item.allowedPrivileges.some((privilege) => access.privileges.has(privilege))
    );
  }
}
