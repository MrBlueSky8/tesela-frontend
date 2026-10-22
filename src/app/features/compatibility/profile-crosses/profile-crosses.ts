import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { CompatibilityCrossSummary } from '../../../core/models/compatibility-cross';
import { ModuleStats } from '../../../core/models/module-stats';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { CompatibilityApiService, DisabilityProfileCatalogItem } from '../compatibility-api-service';
import { CrossDetailDialog } from '../cross-detail-dialog/cross-detail-dialog';
import { CrossRanking } from '../cross-ranking/cross-ranking';

/**
 * Ranking de puestos para un perfil de discapacidad (guia v3.1, 8.2).
 *
 * <p>Es la pregunta inversa a la del puesto: dado un perfil, donde encaja
 * mejor en el catalogo de la empresa. Solo intervienen cruces genericos; los
 * personales pertenecen a la persona, no al perfil.
 */
@Component({
  selector: 'app-profile-crosses',
  imports: [CrossRanking, CrossDetailDialog],
  templateUrl: './profile-crosses.html',
  styleUrl: './profile-crosses.scss',
})
export class ProfileCrosses {
  private readonly api = inject(CompatibilityApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly company = this.companyContext.company;

  readonly profiles = signal<DisabilityProfileCatalogItem[]>([]);
  readonly selected = signal<string | null>(null);
  readonly crosses = signal<CompatibilityCrossSummary[]>([]);
  readonly stats = signal<ModuleStats | null>(null);

  readonly isLoading = signal(true);
  readonly isLoadingRanking = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly detailOf = signal<string | null>(null);

  readonly selectedName = computed(
    () => this.profiles().find((profile) => profile.publicId === this.selected())?.nombre ?? null,
  );

  /** Cuántos puestos quedan fuera del ranking por no estar evaluados. */
  readonly pendientes = computed(() => this.stats()?.puestosSinEvaluar ?? []);

  /** Nombrarlos, no solo contarlos: así el aviso dice qué hacer. */
  readonly nombresPendientes = computed(() =>
    this.pendientes().map((position) => position.nombre).join(', '),
  );

  constructor() {
    this.load();
  }

  load(): void {
    const company = this.company();

    if (!company) {
      this.isLoading.set(false);
      this.loadError.set('No hay una empresa seleccionada.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      profiles: this.api.disabilityProfiles(),
      stats: this.api.stats(company.publicId),
    }).subscribe({
      next: ({ profiles, stats }) => {
        this.isLoading.set(false);
        this.profiles.set(profiles);
        this.stats.set(stats);

        const desdeRuta = this.route.snapshot.paramMap.get('profilePublicId');
        const inicial = desdeRuta ?? profiles[0]?.publicId ?? null;
        if (inicial) {
          this.seleccionar(inicial, false);
        }
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar los perfiles.'));
      },
    });
  }

  onSelect(event: Event): void {
    this.seleccionar((event.target as HTMLSelectElement).value, true);
  }

  /** La URL lleva el perfil para que el ranking se pueda compartir. */
  private seleccionar(profilePublicId: string, navegar: boolean): void {
    const company = this.company();
    if (!company) {
      return;
    }

    this.selected.set(profilePublicId);
    if (navegar) {
      // Relativo al padre 'perfiles': asi vale tanto desde la ruta sin perfil
      // como desde una que ya lo lleva.
      void this.router.navigate([profilePublicId], { relativeTo: this.route.parent });
    }

    this.isLoadingRanking.set(true);
    this.api.profileCrosses(company.publicId, profilePublicId).subscribe({
      next: (crosses) => {
        this.isLoadingRanking.set(false);
        this.crosses.set(crosses);
      },
      error: (error: unknown) => {
        this.isLoadingRanking.set(false);
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar el ranking.'));
      },
    });
  }
}
