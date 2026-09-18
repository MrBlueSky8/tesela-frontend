import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  forkJoin,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
} from 'rxjs';

import { CompanyApiService } from '../../features/companies/company-api-service';
import { CompanyMyAccessResponse, CompanyPrivilege, CompanyResponse } from '../models/company';
import { TokenService } from './token-service';

/** Lo que se persiste: la empresa elegida, atada al usuario que la eligio. */
interface StoredSelection {
  userPublicId: string;
  companyPublicId: string;
}

const STORAGE_KEY = 'selected_company';

/** Espera minima entre refrescos de privilegios al volver a la ventana. */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * Empresa seleccionada y privilegios efectivos del usuario en ella.
 *
 * <p>El backend es la autoridad: esto solo decide que se muestra. Los
 * privilegios se piden a /my-access al seleccionar o restaurar; nunca se
 * guardan en el navegador, solo el publicId de la empresa.
 */
@Injectable({
  providedIn: 'root',
})
export class CompanyContextService {
  private readonly companyApi = inject(CompanyApiService);
  private readonly tokenService = inject(TokenService);

  private readonly companyState = signal<CompanyResponse | null>(null);
  private readonly accessState = signal<CompanyMyAccessResponse | null>(null);

  /** Usuario al que pertenece el contexto cargado en memoria. */
  private ownerPublicId: string | null = null;

  /** Ultimo refresco de privilegios (ms), para no pedir /my-access en cada foco. */
  private lastRefreshAt = 0;
  private refreshing = false;

  /** Restauracion en curso, compartida entre el layout y los guards. */
  private restoring$: Observable<boolean> | null = null;

  readonly company = this.companyState.asReadonly();
  readonly access = this.accessState.asReadonly();

  readonly hasCompany = computed(() => !!this.companyState() && !!this.accessState());

  readonly effectivePrivileges = computed(
    () => new Set<CompanyPrivilege>(this.accessState()?.effectivePrivileges ?? []),
  );

  constructor() {
    // Cerrar sesion o entrar con otra cuenta no debe arrastrar la empresa anterior.
    effect(() => {
      const userPublicId = this.tokenService.userPublicId();

      if (this.ownerPublicId && this.ownerPublicId !== userPublicId) {
        this.resetMemory();
      }
    });
  }

  hasAnyPrivilege(privileges: readonly CompanyPrivilege[]): boolean {
    const effective = this.effectivePrivileges();
    return privileges.some((privilege) => effective.has(privilege));
  }

  /** Selecciona una empresa: primero confirma el acceso y solo entonces la fija. */
  select(company: CompanyResponse): Observable<void> {
    return this.companyApi.myAccess(company.publicId).pipe(
      tap((access) => this.apply(company, access)),
      map(() => void 0),
    );
  }

  /**
   * Garantiza que el contexto este cargado si hay una seleccion valida.
   * Si no hay nada guardado y el usuario pertenece a una sola empresa, la
   * selecciona sola. Nunca falla: devuelve false cuando no hay contexto.
   */
  restore(): Observable<boolean> {
    const userPublicId = this.tokenService.userPublicId();

    if (!userPublicId) {
      return of(false);
    }

    if (this.hasCompany() && this.ownerPublicId === userPublicId) {
      return of(true);
    }

    this.restoring$ ??= this.load(userPublicId).pipe(
      catchError((error: unknown) => {
        // Solo se olvida la seleccion si el backend la rechaza (sin acceso o
        // empresa inexistente); una caida de red no debe borrarla.
        const rejected =
          error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);

        if (rejected) {
          this.clear();
        } else {
          this.resetMemory();
        }

        return of(false);
      }),
      finalize(() => {
        this.restoring$ = null;
      }),
      shareReplay(1),
    );

    return this.restoring$;
  }

  /**
   * Refleja en el contexto una empresa recien editada (nombre, logo, estado)
   * sin volver a pedir /my-access: los privilegios no cambian por editarla.
   */
  replaceCompany(company: CompanyResponse): void {
    if (this.companyState()?.publicId !== company.publicId) {
      return;
    }

    this.companyState.set(company);
  }

  /**
   * Vuelve a pedir /my-access de la empresa seleccionada, como mucho una vez
   * por minuto. Asi un privilegio quitado por un administrador deja de verse
   * sin cerrar sesion. Un 403/404 significa que ya no hay acceso: se olvida la
   * seleccion. Los errores de red se ignoran y se reintenta en el siguiente foco.
   */
  refreshAccess(): void {
    const company = this.companyState();
    const now = Date.now();

    if (!company || this.refreshing || now - this.lastRefreshAt < REFRESH_INTERVAL_MS) {
      return;
    }

    this.refreshing = true;
    this.lastRefreshAt = now;

    this.companyApi
      .myAccess(company.publicId)
      .pipe(
        finalize(() => {
          this.refreshing = false;
        }),
      )
      .subscribe({
        next: (access) => {
          // La seleccion pudo cambiar mientras llegaba la respuesta.
          if (this.companyState()?.publicId === company.publicId) {
            this.accessState.set(access);
          }
        },
        error: (error: unknown) => {
          const rejected =
            error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);

          if (rejected && this.companyState()?.publicId === company.publicId) {
            this.clear();
          }
        },
      });
  }

  clear(): void {
    this.resetMemory();
    localStorage.removeItem(STORAGE_KEY);
  }

  private load(userPublicId: string): Observable<boolean> {
    const stored = this.readStored();

    if (stored?.userPublicId === userPublicId) {
      return forkJoin([
        this.companyApi.get(stored.companyPublicId),
        this.companyApi.myAccess(stored.companyPublicId),
      ]).pipe(
        tap(([company, access]) => this.apply(company, access)),
        map(() => true),
      );
    }

    // Un administrador de plataforma ve todas las empresas: elegir por el seria arbitrario.
    if (this.tokenService.role() !== 'USUARIO') {
      return of(false);
    }

    return this.companyApi
      .list()
      .pipe(
        switchMap((companies) =>
          companies.length === 1 ? this.select(companies[0]).pipe(map(() => true)) : of(false),
        ),
      );
  }

  private apply(company: CompanyResponse, access: CompanyMyAccessResponse): void {
    this.lastRefreshAt = Date.now();
    const userPublicId = this.tokenService.userPublicId();

    this.ownerPublicId = userPublicId;
    this.companyState.set(company);
    this.accessState.set(access);

    if (userPublicId) {
      const selection: StoredSelection = { userPublicId, companyPublicId: company.publicId };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    }
  }

  private resetMemory(): void {
    this.ownerPublicId = null;
    this.companyState.set(null);
    this.accessState.set(null);
  }

  private readStored(): StoredSelection | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<StoredSelection>) : null;

      return parsed?.userPublicId && parsed.companyPublicId
        ? { userPublicId: parsed.userPublicId, companyPublicId: parsed.companyPublicId }
        : null;
    } catch {
      return null;
    }
  }
}
