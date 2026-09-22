import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { backendErrorMessage } from '../../../../core/helpers/backend-error-message';
import { CompanyResponse } from '../../../../core/models/company';
import { CompanyContextService } from '../../../../core/services/company-context-service';
import { TokenService } from '../../../../core/services/token-service';

/** Sin buscar, el desplegable solo muestra las primeras; el resto sale al buscar. */
const VISIBLE_WITHOUT_SEARCH = 8;

/**
 * Selector de la empresa de trabajo, en el encabezado.
 *
 * <p>Es el unico punto para cambiar de empresa: el menu lateral solo muestra
 * cual esta activa. Al cambiar se vuelve a Inicio, porque la nueva empresa
 * puede no dar los privilegios de la pantalla actual.
 */
@Component({
  selector: 'app-company-switcher',
  imports: [RouterLink],
  templateUrl: './company-switcher.html',
  styleUrl: './company-switcher.scss',
})
export class CompanySwitcher {
  private readonly companyContext = inject(CompanyContextService);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly tokenService = inject(TokenService);

  /** Fundades va al directorio administrativo; el resto, a su lista de empresas. */
  readonly allCompaniesLink = computed(() =>
    this.tokenService.role() === 'ADMIN_PLATAFORMA' ? '/plataforma/empresas' : '/companies',
  );

  readonly company = this.companyContext.company;

  readonly isOpen = signal(false);
  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly selectError = signal<string | null>(null);
  readonly selectingId = signal<string | null>(null);
  readonly search = signal('');

  private readonly companies = signal<CompanyResponse[]>([]);

  readonly currentInitial = computed(
    () => this.company()?.nombre.trim().charAt(0).toUpperCase() ?? '',
  );

  readonly matches = computed(() => {
    const term = this.search().trim().toLowerCase();
    const all = this.companies();

    if (!term) {
      return all.slice(0, VISIBLE_WITHOUT_SEARCH);
    }

    return all.filter((company) =>
      [company.nombre, company.razonSocial, company.ruc].some((field) =>
        field.toLowerCase().includes(term),
      ),
    );
  });

  readonly hiddenCount = computed(() =>
    this.search().trim() ? 0 : Math.max(0, this.companies().length - VISIBLE_WITHOUT_SEARCH),
  );

  toggle(): void {
    if (this.isOpen()) {
      this.close();
      return;
    }

    this.isOpen.set(true);
    this.selectError.set(null);
    this.search.set('');
    this.load();
  }

  close(): void {
    this.isOpen.set(false);
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.companyContext.availableCompanies().subscribe({
      next: (companies) => {
        this.isLoading.set(false);
        this.companies.set(companies);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar tus empresas.'));
      },
    });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  onSelect(company: CompanyResponse): void {
    if (this.selectingId()) {
      return;
    }

    if (company.publicId === this.company()?.publicId) {
      this.close();
      return;
    }

    this.selectingId.set(company.publicId);
    this.selectError.set(null);

    this.companyContext.select(company).subscribe({
      next: () => {
        this.selectingId.set(null);
        this.close();
        // El aviso lo muestra Inicio; asi el cambio se confirma en pantalla.
        this.companyContext.justSwitchedTo.set(company.nombre);
        this.navigateAfterSwitch();
      },
      error: (error: unknown) => {
        this.selectingId.set(null);
        this.selectError.set(
          backendErrorMessage(error, 'No pudimos acceder a la empresa seleccionada.'),
        );
      },
    });
  }

  /**
   * Tras el cambio, deja al usuario donde estaba en la medida de lo posible:
   * en una seccion de la empresa vuelve al inicio de esa seccion (un detalle
   * pertenece a la empresa anterior) y fuera de ellas no navega. Si la nueva
   * empresa no da acceso a la seccion, el guard de la ruta lo lleva a Inicio.
   */
  private navigateAfterSwitch(): void {
    const segments = this.router.url.split(/[?#]/)[0].split('/').filter(Boolean);

    if (segments[0] !== 'empresa' && segments[0] !== 'modulos') {
      // Inicio, perfil o plataforma no dependen de la empresa o ya se recalculan solos.
      return;
    }

    const target = '/' + segments.slice(0, 2).join('/');

    // Las paginas cargan sus datos al crearse: se pasa por Inicio sin cambiar la URL
    // visible para que la seccion se vuelva a crear con la nueva empresa.
    void this.router
      .navigateByUrl('/home', { skipLocationChange: true })
      .then(() => this.router.navigateByUrl(target));
  }

  initial(company: CompanyResponse): string {
    return company.nombre.trim().charAt(0).toUpperCase();
  }

  /** Un clic fuera cierra el desplegable, como cualquier menu. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close();
      // Cerrar con Escape devuelve el foco al boton que lo abrio.
      const trigger = this.host.nativeElement.querySelector('.cs__trigger');
      (trigger as HTMLButtonElement | null)?.focus();
    }
  }
}
