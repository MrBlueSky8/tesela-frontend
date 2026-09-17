import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { SiteEvaluatorResponse, SiteResponse } from '../../../core/models/site';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { SiteFormDialog } from '../site-form-dialog/site-form-dialog';
import { SitesApiService } from '../sites-api-service';

type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

/** Sedes de la empresa seleccionada y cuantos evaluadores tiene cada una. */
@Component({
  selector: 'app-sites-page',
  imports: [RouterLink, SiteFormDialog],
  templateUrl: './sites-page.html',
  styleUrl: './sites-page.scss',
})
export class SitesPage {
  private readonly api = inject(SitesApiService);
  private readonly companyContext = inject(CompanyContextService);

  readonly company = this.companyContext.company;

  readonly sites = signal<SiteResponse[]>([]);
  readonly assignments = signal<SiteEvaluatorResponse[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('ACTIVE');
  readonly formOpen = signal(false);

  /** Evaluadores activos por sede. */
  readonly evaluatorCount = computed(() => {
    const counts = new Map<string, number>();
    for (const assignment of this.assignments()) {
      if (assignment.status === 'ACTIVE') {
        counts.set(assignment.sitePublicId, (counts.get(assignment.sitePublicId) ?? 0) + 1);
      }
    }
    return counts;
  });

  readonly stats = computed(() => {
    const active = this.sites().filter((site) => site.status === 'ACTIVE');
    const counts = this.evaluatorCount();
    return {
      active: active.length,
      evaluators: active.reduce((total, site) => total + (counts.get(site.publicId) ?? 0), 0),
      withoutEvaluator: active.filter((site) => !counts.get(site.publicId)).length,
    };
  });

  readonly filtered = computed(() => {
    const term = normalize(this.search());
    const status = this.statusFilter();
    return this.sites().filter(
      (site) =>
        (status === 'ALL' || site.status === status) &&
        (!term || normalize(`${site.nombre} ${site.ciudad ?? ''}`).includes(term)),
    );
  });

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
      sites: this.api.list(company.publicId),
      assignments: this.api.assignments(company.publicId),
    }).subscribe({
      next: ({ sites, assignments }) => {
        this.sites.set(sites);
        this.assignments.set(assignments);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar las sedes.'));
        this.isLoading.set(false);
      },
    });
  }

  countFor(site: SiteResponse): number {
    return this.evaluatorCount().get(site.publicId) ?? 0;
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as StatusFilter);
  }

  clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('ACTIVE');
  }

  openNew(): void {
    this.notice.set(null);
    this.formOpen.set(true);
  }

  onSaved(site: SiteResponse): void {
    this.sites.update((sites) => [...sites, site].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    this.notice.set(`Se registro la sede ${site.nombre}.`);
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}
