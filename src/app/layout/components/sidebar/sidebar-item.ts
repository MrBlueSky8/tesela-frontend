import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { SidebarItem as SidebarItemModel } from '../../../core/models/sidebar-item';

@Component({
  selector: 'app-sidebar-item',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar-item.html',
  styleUrl: './sidebar-item.scss',
})
export class SidebarItem {
  private readonly router = inject(Router);

  readonly item = input.required<SidebarItemModel>();
  readonly collapsed = input(false);
  readonly expandedId = input<string | null>(null);

  readonly actionTriggered = output<SidebarItemModel>();
  readonly toggleExpand = output<string>();

  onClick(): void {
    const item = this.item();

    if (item.children?.length) {
      this.toggleExpand.emit(item.id);
      return;
    }

    if (item.action) {
      this.actionTriggered.emit(item);
    }
  }

  isRouteActive(): boolean {
    const item = this.item();

    if (!item.route) {
      return false;
    }

    return item.exact ? this.router.url === item.route : this.router.url.startsWith(item.route);
  }
}
