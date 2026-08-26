import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { LayoutStateService } from '../../../core/services/layout-state-service';

export interface Crumb {
  label: string;
  route: string | null;
}

@Component({
  selector: 'app-topbar',
  imports: [RouterLink],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  private readonly router = inject(Router);
  private readonly layoutState = inject(LayoutStateService);

  readonly collapsed = this.layoutState.sidebarCollapsed;

  /**
   * Migas construidas con `data.breadcrumb` de cada tramo de la ruta activa.
   * Se recorre el arbol de snapshots del router (no ActivatedRoute): durante la
   * primera construccion del componente los ActivatedRoute hijos todavia no
   * tienen `snapshot` asignado.
   */
  readonly crumbs = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.buildCrumbs()),
    ),
    { initialValue: this.buildCrumbs() },
  );

  readonly lastIndex = computed(() => this.crumbs().length - 1);

  toggleSidebar(): void {
    this.layoutState.toggleSidebar();
  }

  private buildCrumbs(): Crumb[] {
    const crumbs: Crumb[] = [];
    const segments: string[] = [];

    let node: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;

    while (node) {
      const path = node.url.map((segment) => segment.path).join('/');

      if (path) {
        segments.push(path);
      }

      const label = node.data['breadcrumb'] as string | undefined;

      if (label) {
        // Solo es enlazable si el tramo tiene componente propio; los tramos
        // puramente agrupadores (p. ej. /modulos) se pintan como texto.
        const linkable = !!node.component && segments.length > 0;

        crumbs.push({
          label,
          route: linkable ? `/${segments.join('/')}` : null,
        });
      }

      node = node.firstChild;
    }

    return crumbs;
  }
}
