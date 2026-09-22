import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Observable,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';

import {
  backendErrorMessage,
  backendFieldErrors,
} from '../../../../core/helpers/backend-error-message';
import { controlErrorMessage } from '../../../../core/helpers/form-error-message';
import { explicitPrivileges } from '../../../../core/helpers/privilege-labels';
import { ApiError } from '../../../../core/models/api-error';
import { CompanyPrivilege, CompanyPrivilegeResponse } from '../../../../core/models/company';
import {
  AssignableUserResponse,
  CompanyMembershipResponse,
  CompanyUserLookupResponse,
} from '../../../../core/models/company-membership';
import { DocumentType } from '../../../../core/models/user-profile-response';
import { ModalShell } from '../../../../shared/components/modal-shell/modal-shell';
import { CompanyScopeService } from '../../../../core/services/company-scope-service';
import { CompanyUsersApiService } from '../../company-users-api-service';
import { PrivilegePicker } from '../privilege-picker/privilege-picker';

/**
 * - `document`: paso 1, el documento decide el resto del camino.
 * - `identity`: paso 2, autocompletado o pidiendo lo que falte.
 * - `search`: camino de respaldo cuando no se tiene el documento.
 * - `done`: confirmacion del envio de credenciales.
 */
type Mode = 'document' | 'identity' | 'search' | 'done';
type SearchState = 'idle' | 'short' | 'loading' | 'results' | 'empty' | 'error';
type CreateField = 'email' | 'documentType' | 'documentNumber' | 'firstNames' | 'lastNames';

const MIN_SEARCH_LENGTH = 3;

export interface MemberAddedEvent {
  membership: CompanyMembershipResponse;
  /** true si se creo una cuenta nueva (las credenciales van por correo). */
  created: boolean;
}

/**
 * Agregar un miembro. El documento es el dato previo: con el, la pantalla sabe
 * si la persona ya existe y autocompleta su identidad, o si hay que
 * registrarla. El administrador nunca elige entre "cuenta existente" y "cuenta
 * nueva": esa decision la toma el resultado de la consulta.
 */
@Component({
  selector: 'app-add-member-dialog',
  imports: [ReactiveFormsModule, RouterLink, ModalShell, PrivilegePicker],
  templateUrl: './add-member-dialog.html',
  styleUrl: './add-member-dialog.scss',
})
export class AddMemberDialog {
  private readonly api = inject(CompanyUsersApiService);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly companyScope = inject(CompanyScopeService);

  private readonly documentInput = viewChild<ElementRef<HTMLInputElement>>('documentInput');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');
  private readonly doneButton = viewChild<ElementRef<HTMLButtonElement>>('doneButton');

  readonly companyPublicId = input.required<string>();
  readonly catalog = input.required<CompanyPrivilegeResponse[]>();
  readonly canManageAdmins = input(false);
  readonly adminLimitReached = input(false);

  readonly added = output<MemberAddedEvent>();
  readonly closed = output<void>();

  readonly minSearchLength = MIN_SEARCH_LENGTH;
  readonly mode = signal<Mode>('document');

  readonly documentTypes: { value: DocumentType; label: string }[] = [
    { value: 'DNI', label: 'DNI' },
    { value: 'CE', label: 'Carné de extranjería' },
    { value: 'PASSPORT', label: 'Pasaporte' },
  ];

  // ---- Paso 1: documento
  readonly documentForm = this.fb.nonNullable.group({
    documentType: ['DNI' as DocumentType, [Validators.required]],
    documentNumber: [
      '',
      [Validators.required, Validators.minLength(MIN_SEARCH_LENGTH), Validators.maxLength(30)],
    ],
  });
  readonly isLookingUp = signal(false);
  readonly lookup = signal<CompanyUserLookupResponse | null>(null);

  // ---- Paso 2: identidad
  readonly createForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    documentType: ['DNI' as DocumentType, [Validators.required]],
    documentNumber: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
    firstNames: ['', [Validators.required, Validators.maxLength(500)]],
    lastNames: ['', [Validators.required, Validators.maxLength(500)]],
  });

  /** Cuenta elegida: la que trae la consulta o la del buscador de respaldo. */
  readonly selectedUser = signal<AssignableUserResponse | null>(null);
  /** true cuando la persona ya tiene cuenta pero se prefiere crearle otra con otro correo. */
  readonly forceNewAccount = signal(false);

  // ---- Respaldo: buscar por nombre o correo
  readonly searchControl = this.fb.nonNullable.control('');
  readonly searchState = signal<SearchState>('idle');
  readonly results = signal<AssignableUserResponse[]>([]);

  // ---- Comun
  readonly privileges = signal<CompanyPrivilege[]>([]);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly serverFieldErrors = signal<Record<string, string>>({});
  /** Pistas accionables para ciertos 409 del alta. */
  readonly errorHint = signal<'duplicate-email' | 'names-mismatch' | null>(null);
  readonly deliveredTo = signal<string | null>(null);

  /** La persona existe: su identidad viene del registro y no se teclea. */
  readonly knownPerson = computed(() => {
    const result = this.lookup();
    return result?.outcome === 'ASSIGNABLE' || result?.outcome === 'PERSON_WITHOUT_ACCOUNT';
  });

  /** Se crea una cuenta cuando no hay ninguna disponible o se pidió otra. */
  readonly willCreateAccount = computed(
    () => this.mode() === 'identity' && (!this.selectedUser() || this.forceNewAccount()),
  );

  readonly alreadyMember = computed(() => this.lookup()?.outcome === 'ALREADY_MEMBER');

  /** Ficha del miembro que ya pertenece a la empresa. */
  readonly memberLink = computed(() => {
    const membershipPublicId = this.lookup()?.membershipPublicId;
    return membershipPublicId ? this.companyScope.sectionLink('usuarios', membershipPublicId) : null;
  });

  readonly stepLabel = computed(() => {
    switch (this.mode()) {
      case 'document':
        return 'Paso 1 de 3: documento';
      case 'search':
        return 'Buscar sin documento';
      default:
        return this.alreadyMember() ? 'Resultado de la consulta' : 'Pasos 2 y 3: datos y privilegios';
    }
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => this.selectedUser.set(null)),
        // switchMap cancela la busqueda anterior: nunca pisa resultados nuevos con viejos.
        switchMap((term) => this.search(term)),
        takeUntilDestroyed(),
      )
      .subscribe(({ state, results }) => {
        this.results.set(results);
        this.searchState.set(state);
      });

    this.createForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (Object.keys(this.serverFieldErrors()).length) {
        this.serverFieldErrors.set({});
      }
    });
  }

  // ---------------------------------------------------------------- Paso 1

  onLookup(): void {
    if (this.isLookingUp()) {
      return;
    }
    if (this.documentForm.invalid) {
      this.documentForm.markAllAsTouched();
      this.submitError.set('Revisa el documento.');
      return;
    }

    const { documentType, documentNumber } = this.documentForm.getRawValue();
    const document = documentNumber.trim();

    this.isLookingUp.set(true);
    this.clearErrors();

    this.api.lookup(this.companyPublicId(), documentType, document).subscribe({
      next: (result) => {
        this.isLookingUp.set(false);
        this.applyLookup(result, documentType, document);
      },
      error: (error: unknown) => {
        this.isLookingUp.set(false);
        this.submitError.set(backendErrorMessage(error, 'No pudimos consultar el documento.'));
      },
    });
  }

  /** Vuelve al documento: es el unico paso atras del alta. */
  backToDocument(): void {
    this.clearErrors();
    this.lookup.set(null);
    this.selectedUser.set(null);
    this.forceNewAccount.set(false);
    this.mode.set('document');
    this.focusLater(() => this.documentInput());
  }

  // ---------------------------------------------------------------- Paso 2

  documentLabel(type: DocumentType): string {
    return this.documentTypes.find((option) => option.value === type)?.label ?? type;
  }

  selectUser(user: AssignableUserResponse): void {
    this.selectedUser.set(user);
    this.forceNewAccount.set(false);
  }

  /** La persona existe pero se le quiere crear otra cuenta con otro correo. */
  useAnotherEmail(): void {
    this.forceNewAccount.set(true);
    this.selectedUser.set(null);
    this.focusLater(() => this.emailInput());
  }

  useExistingAccount(): void {
    this.forceNewAccount.set(false);
    this.selectedUser.set(this.lookup()?.accounts[0] ?? null);
  }

  fieldError(field: CreateField): string | null {
    return controlErrorMessage(this.createForm.controls[field], this.serverFieldErrors()[field]);
  }

  onConfirm(): void {
    if (this.isSubmitting()) {
      return;
    }

    const user = this.selectedUser();
    if (user && !this.forceNewAccount()) {
      this.submit(
        this.api.add(this.companyPublicId(), {
          userPublicId: user.publicId,
          privilegePublicIds: this.privilegeIds(),
        }),
        false,
      );
      return;
    }

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.submitError.set('Revisa los campos marcados.');
      return;
    }

    const value = this.createForm.getRawValue();
    this.submit(
      this.api.create(this.companyPublicId(), {
        email: value.email.trim(),
        documentType: value.documentType,
        documentNumber: value.documentNumber.trim(),
        firstNames: value.firstNames.trim(),
        lastNames: value.lastNames.trim(),
        privilegePublicIds: this.privilegeIds(),
      }),
      true,
    );
  }

  // ---------------------------------------------------------------- Respaldo

  /** Camino de respaldo: no siempre se tiene el documento a mano. */
  switchToSearch(): void {
    this.clearErrors();
    this.selectedUser.set(null);
    this.mode.set('search');
    this.focusLater(() => this.searchInput());
  }

  maskDocument(user: AssignableUserResponse): string {
    const label = this.documentLabel(user.documentType);
    const last = user.documentNumber.slice(-4);
    return `${label} •••• ${last}`;
  }

  // ---------------------------------------------------------------- Internos

  /** Traduce el resultado de la consulta en lo que vera el administrador. */
  private applyLookup(
    result: CompanyUserLookupResponse,
    documentType: DocumentType,
    documentNumber: string,
  ): void {
    this.lookup.set(result);
    this.forceNewAccount.set(false);
    this.selectedUser.set(result.accounts[0] ?? null);

    this.createForm.reset({
      email: '',
      documentType,
      documentNumber,
      firstNames: result.firstNames ?? '',
      lastNames: result.lastNames ?? '',
    });

    // La identidad registrada no se edita aqui: la corrige Fundades.
    const identity = [this.createForm.controls.firstNames, this.createForm.controls.lastNames];
    for (const control of identity) {
      if (result.firstNames) {
        control.disable({ emitEvent: false });
      } else {
        control.enable({ emitEvent: false });
      }
    }
    this.createForm.controls.documentType.disable({ emitEvent: false });
    this.createForm.controls.documentNumber.disable({ emitEvent: false });

    this.mode.set('identity');

    if (result.outcome === 'NOT_FOUND' || result.outcome === 'PERSON_WITHOUT_ACCOUNT') {
      this.focusLater(() => this.emailInput());
    }
  }

  private submit(request: Observable<CompanyMembershipResponse>, created: boolean): void {
    this.isSubmitting.set(true);
    this.clearErrors();

    request.subscribe({
      next: (membership) => {
        this.isSubmitting.set(false);
        this.added.emit({ membership, created });

        if (created) {
          // La confirmacion queda en pantalla: el administrador debe saber a donde fue.
          this.deliveredTo.set(membership.email);
          this.mode.set('done');
          this.focusLater(() => this.doneButton());
        } else {
          this.closed.emit();
        }
      },
      error: (error: unknown) => {
        this.isSubmitting.set(false);
        this.serverFieldErrors.set(backendFieldErrors(error));
        this.submitError.set(backendErrorMessage(error, 'No pudimos agregar al usuario.'));
        this.errorHint.set(created ? this.hintFor(error) : null);
      },
    });
  }

  private search(
    term: string,
  ): Observable<{ state: SearchState; results: AssignableUserResponse[] }> {
    if (!term) {
      return of({ state: 'idle', results: [] });
    }
    if (term.length < MIN_SEARCH_LENGTH) {
      return of({ state: 'short', results: [] });
    }

    this.searchState.set('loading');
    return this.api.searchAssignable(this.companyPublicId(), term).pipe(
      map((results) => ({
        state: (results.length ? 'results' : 'empty') as SearchState,
        results,
      })),
      catchError(() => of({ state: 'error' as SearchState, results: [] })),
    );
  }

  private hintFor(error: unknown): 'duplicate-email' | 'names-mismatch' | null {
    if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
      return null;
    }

    const body = error.error as Partial<ApiError> | null;
    const message = body?.message ?? '';

    if (body?.code === 'DUPLICATE_RESOURCE' && message.toLowerCase().includes('email')) {
      return 'duplicate-email';
    }
    if (body?.code === 'BUSINESS_RULE' && message.includes('otros nombres')) {
      return 'names-mismatch';
    }
    return null;
  }

  private privilegeIds(): string[] {
    const byName = new Map(this.catalog().map((privilege) => [privilege.name, privilege.publicId]));
    return explicitPrivileges(this.privileges())
      .map((name) => byName.get(name))
      .filter((id): id is string => !!id);
  }

  private clearErrors(): void {
    this.submitError.set(null);
    this.errorHint.set(null);
    this.serverFieldErrors.set({});
  }

  private focusLater(target: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }
}
