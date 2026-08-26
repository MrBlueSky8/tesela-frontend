import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

/**
 * Pantalla provisional reutilizada por las rutas del sidebar que todavia no
 * tienen feature propia. El titulo y la descripcion vienen de `route.data`.
 */
@Component({
  selector: 'app-placeholder-page',
  imports: [],
  templateUrl: './placeholder-page.html',
  styleUrl: './placeholder-page.scss',
})
export class PlaceholderPage {
  private readonly route = inject(ActivatedRoute);

  private readonly data = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data,
  });

  readonly title = computed(
    () => (this.data()['title'] as string | undefined) ?? 'En construccion',
  );

  readonly description = computed(
    () =>
      (this.data()['description'] as string | undefined) ??
      'Esta seccion todavia no esta implementada.',
  );
}
