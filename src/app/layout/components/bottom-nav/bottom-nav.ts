import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { SidebarItem as SidebarItemModel } from '../../../core/models/sidebar-item';
import { SidebarAccessService } from '../../../core/services/sidebar-access-service';
import { AuthService } from '../../../features/auth/auth-service';

interface BottomNavMenuState {
  title: string;
  items: SidebarItemModel[];
}

const OVERFLOW_MENU_TITLE = 'Mas';

@Component({
  selector: 'app-bottom-nav',
  imports: [],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.scss',
})
export class BottomNav {
  private readonly sidebarAccessService = inject(SidebarAccessService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly primaryItems = this.sidebarAccessService.bottomNavItems;
  readonly overflowItems = this.sidebarAccessService.bottomNavOverflowItems;

  /** Pila de menus: permite entrar a submenus y volver atras dentro del sheet. */
  private readonly menuStack = signal<BottomNavMenuState[]>([]);

  readonly currentMenu = computed(() => {
    const stack = this.menuStack();
    return stack.length ? stack[stack.length - 1] : null;
  });

  readonly isMenuOpen = computed(() => this.menuStack().length > 0);
  readonly canGoBack = computed(() => this.menuStack().length > 1);
  readonly isOverflowMenuOpen = computed(() => this.currentMenu()?.title === OVERFLOW_MENU_TITLE);

  readonly isSheetDragging = signal(false);
  readonly sheetDragOffset = signal(0);

  private sheetDragStartY = 0;
  private sheetDragStartTime = 0;
  private sheetDragMoved = false;
  private suppressNextSheetClick = false;

  private readonly sheetCloseThresholdPx = 88;
  private readonly sheetCloseVelocityPxPerMs = 0.45;

  sheetTransform(): string {
    return `translateY(${this.sheetDragOffset()}px)`;
  }

  onPrimaryItemClick(item: SidebarItemModel): void {
    this.handleItemSelection(item);
  }

  onOverflowClick(): void {
    if (!this.overflowItems().length) {
      return;
    }

    if (this.isOverflowMenuOpen()) {
      this.closeMenu();
      return;
    }

    this.menuStack.set([
      {
        title: OVERFLOW_MENU_TITLE,
        items: this.overflowItems(),
      },
    ]);
  }

  onMenuItemClick(item: SidebarItemModel): void {
    if (this.suppressNextSheetClick) {
      this.suppressNextSheetClick = false;
      return;
    }

    this.handleItemSelection(item);
  }

  goBack(): void {
    this.menuStack.update((stack) => stack.slice(0, -1));
  }

  closeMenu(): void {
    this.resetSheetDragState();
    this.menuStack.set([]);
  }

  onSheetPointerDown(event: PointerEvent): void {
    if (!this.isMenuOpen()) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    this.sheetDragStartY = event.clientY;
    this.sheetDragStartTime = performance.now();
    this.sheetDragMoved = false;
    this.suppressNextSheetClick = false;
    this.sheetDragOffset.set(0);
    this.isSheetDragging.set(true);

    const target = event.currentTarget as HTMLElement | null;
    target?.setPointerCapture?.(event.pointerId);
  }

  onSheetPointerMove(event: PointerEvent): void {
    if (!this.isSheetDragging()) {
      return;
    }

    const deltaY = Math.max(0, event.clientY - this.sheetDragStartY);

    if (deltaY > 8) {
      this.sheetDragMoved = true;
      this.suppressNextSheetClick = true;
      event.preventDefault();
    }

    this.sheetDragOffset.set(deltaY);
  }

  onSheetPointerUp(event: PointerEvent): void {
    this.finishSheetDrag(event);
  }

  onSheetPointerCancel(event: PointerEvent): void {
    this.finishSheetDrag(event, true);
  }

  isItemActive(item: SidebarItemModel): boolean {
    if (item.children?.length) {
      return item.children.some((child) => this.isItemActive(child));
    }

    if (!item.route) {
      return false;
    }

    return item.exact ? this.router.url === item.route : this.router.url.startsWith(item.route);
  }

  private finishSheetDrag(event: PointerEvent, cancelled = false): void {
    if (!this.isSheetDragging()) {
      return;
    }

    const target = event.currentTarget as HTMLElement | null;
    target?.releasePointerCapture?.(event.pointerId);

    const deltaY = this.sheetDragOffset();
    const elapsed = Math.max(performance.now() - this.sheetDragStartTime, 1);
    const velocity = Math.max(0, event.clientY - this.sheetDragStartY) / elapsed;

    this.isSheetDragging.set(false);

    const shouldClose =
      !cancelled &&
      this.sheetDragMoved &&
      (deltaY >= this.sheetCloseThresholdPx || velocity >= this.sheetCloseVelocityPxPerMs);

    if (shouldClose) {
      this.sheetDragOffset.set(0);
      this.closeMenu();
      return;
    }

    this.sheetDragOffset.set(0);

    if (this.sheetDragMoved) {
      this.suppressNextSheetClick = true;

      window.setTimeout(() => {
        this.suppressNextSheetClick = false;
      }, 140);
    }

    this.sheetDragMoved = false;
  }

  private resetSheetDragState(): void {
    this.isSheetDragging.set(false);
    this.sheetDragOffset.set(0);
    this.sheetDragStartY = 0;
    this.sheetDragStartTime = 0;
    this.sheetDragMoved = false;
    this.suppressNextSheetClick = false;
  }

  private handleItemSelection(item: SidebarItemModel): void {
    if (item.children?.length) {
      this.menuStack.update((stack) => [
        ...stack,
        {
          title: item.label,
          items: item.children ?? [],
        },
      ]);
      return;
    }

    if (item.action === 'logout') {
      this.authService.logout();
      this.closeMenu();
      void this.router.navigate(['/login']);
      return;
    }

    if (item.route) {
      this.closeMenu();
      void this.router.navigate([item.route]);
    }
  }
}
