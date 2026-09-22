import { Injectable, computed, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CompanyApiService } from '../../features/companies/company-api-service';
import { backendErrorMessage } from '../helpers/backend-error-message';
import { CompanyPrivilege, CompanyResponse } from '../models/company';
import { CompanyContextService } from './company-context-service';

/** Secciones de la empresa que existen en las dos ramas de rutas. */
export type CompanySection = 'usuarios' | 'puestos' | 'sedes';

/** Parametro de ruta que marca el modo administracion. */
const COMPANY_PARAM = 'companyPublicId';

/**
 * Empresa sobre la que actua la pantalla, en dos modos:
 *
 * <ul>
 *   <li><b>Espacio de trabajo</b> (/empresa/...): es la empresa seleccionada,
 *       igual que hasta ahora.</li>
 *   <li><b>Administracion</b> (/plataforma/empresas/:id/...): es la empresa de
 *       la ruta, sin tocar la empresa activa del usuario. Solo Fundades entra
 *       aqui; el backend la autoriza sin exigir membresia.</li>
 * </ul>
 *
 * <p>Se declara en `providers` de la rama de rutas, asi cada rama tiene su
 * instancia y las pantallas no necesitan saber en cual estan.
 */
@Injectable()
export class CompanyScopeService {
  private readonly context = inject(CompanyContextService);
  private readonly companyApi = inject(CompanyApiService);
  private readonly router = inject(Router);

  private readonly adminCompanyId = signal<string | null>(
    findParam(this.router.routerState.snapshot.root),
  );
  private readonly adminCompany = signal<CompanyResponse | null>(null);
  private readonly adminPrivileges = signal<ReadonlySet<CompanyPrivilege>>(new Set());

  readonly isLoading = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly isAdminScope = computed(() => !!this.adminCompanyId());

  readonly company = computed(() =>
    this.isAdminScope() ? this.adminCompany() : this.context.company(),
  );

  /** Empresa activa del usuario, para avisar cuando no es la que administra. */
  readonly activeCompany = this.context.company;

  constructor() {
    if (this.adminCompanyId()) {
      this.reload();
    }
  }

  /** La llama el shell cuando cambia el :companyPublicId de la ruta. */
  useCompany(companyPublicId: string): void {
    if (this.adminCompanyId() === companyPublicId && this.adminCompany()) {
      return;
    }

    this.adminCompanyId.set(companyPublicId);
    this.adminCompany.set(null);
    this.reload();
  }

  reload(): void {
    const companyPublicId = this.adminCompanyId();

    if (!companyPublicId) {
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin([
      this.companyApi.get(companyPublicId),
      this.companyApi.myAccess(companyPublicId),
    ]).subscribe({
      next: ([company, access]) => {
        this.isLoading.set(false);
        this.adminCompany.set(company);
        this.adminPrivileges.set(new Set(access.effectivePrivileges));
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar la empresa.'));
      },
    });
  }

  /**
   * Enlace a una seccion de la empresa en la rama actual. Asi un enlace a Sedes
   * o Usuarios no saca a Fundades de la empresa que esta administrando.
   */
  sectionLink(section: CompanySection, id?: string): string[] {
    const tail = id ? [section, id] : [section];
    const companyPublicId = this.adminCompanyId();

    return this.isAdminScope() && companyPublicId
      ? ['/plataforma/empresas', companyPublicId, ...tail]
      : ['/empresa', ...tail];
  }

  hasAnyPrivilege(privileges: readonly CompanyPrivilege[]): boolean {
    if (!this.isAdminScope()) {
      return this.context.hasAnyPrivilege(privileges);
    }

    const effective = this.adminPrivileges();
    return privileges.some((privilege) => effective.has(privilege));
  }

  /** Refleja una empresa recien editada sin volver a pedirla. */
  replaceCompany(company: CompanyResponse): void {
    if (this.isAdminScope()) {
      this.adminCompany.set(company);
    }

    // Tambien puede ser la empresa activa del usuario (Fundades editando la suya).
    this.context.replaceCompany(company);
  }
}

/** Busca el :companyPublicId en la rama de rutas activa. */
function findParam(node: ActivatedRouteSnapshot | null): string | null {
  while (node) {
    const value = node.params[COMPANY_PARAM];

    if (value) {
      return value;
    }

    node = node.firstChild;
  }

  return null;
}
