import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
} from '../../../../core/models/company-membership';
import { DocumentType } from '../../../../core/models/user-profile-response';
import { ModalShell } from '../../../../shared/components/modal-shell/modal-shell';
import { CompanyUsersApiService } from '../../company-users-api-service';
import { PrivilegePicker } from '../privilege-picker/privilege-picker';

type Mode = 'existing' | 'new' | 'done';
type SearchState = 'idle' | 'short' | 'loading' | 'results' | 'empty' | 'error';
type CreateField = 'email' | 'documentType' | 'documentNumber' | 'firstNames' | 'lastNames';

const MIN_SEARCH_LENGTH = 3;

export interface MemberAddedEvent {
  membership: CompanyMembershipResponse;
  /** true si se creo una cuenta nueva (las credenciales van por correo). */
  created: boolean;
}

/**
 * Agregar un miembro: buscar una cuenta existente o crear una nueva.
 * Los dos caminos terminan en el mismo selector de privilegios.
 */
@Component({
  selector: 'app-add-member-dialog',
  imports: [ReactiveFormsModule, ModalShell, PrivilegePicker],
  templateUrl: './add-member-dialog.html',
  styleUrl: './add-member-dialog.scss',
})
export class AddMemberDialog {
  private readonly api = inject(CompanyUsersApiService);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);

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
  readonly mode = signal<Mode>('existing');

  // ---- Buscar existente
  readonly searchControl = this.fb.nonNullable.control('');
  readonly searchState = signal<SearchState>('idle');
  readonly results = signal<AssignableUserResponse[]>([]);
  readonly selectedUser = signal<AssignableUserResponse | null>(null);

  // ---- Crear nueva
  readonly documentTypes: { value: DocumentType; label: string }[] = [
    { value: 'DNI', label: 'DNI' },
    { value: 'CE', label: 'Carne de extranjeria' },
    { value: 'PASSPORT', label: 'Pasaporte' },
  ];

  readonly createForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(320)]],
    documentType: ['DNI' as DocumentType, [Validators.required]],
    documentNumber: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
    firstNames: ['', [Validators.required, Validators.maxLength(500)]],
    lastNames: ['', [Validators.required, Validators.maxLength(500)]],
  });

  // ---- Comun
  readonly privileges = signal<CompanyPrivilege[]>([]);
  readonly isSubmitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly serverFieldErrors = signal<Record<string, string>>({});
  /** Pistas accionables para ciertos 409 del alta. */
  readonly errorHint = signal<'duplicate-email' | 'names-mismatch' | null>(null);
  readonly deliveredTo = signal<string | null>(null);

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

  // ---------------------------------------------------------------- Modos

  switchToNew(): void {
    const term = this.searchControl.value.trim();

    // Lo tecleado en la busqueda se aprovecha si parece un correo o un documento.
    if (term.includes('@') && !this.createForm.controls.email.value) {
      this.createForm.controls.email.setValue(term);
    } else if (/^[0-9A-Za-z]{3,30}$/.test(term) && /\d/.test(term)) {
      this.createForm.controls.documentNumber.setValue(term);
    }

    this.clearErrors();
    this.mode.set('new');
    this.focusLater(() => this.emailInput());
  }

  switchToExisting(prefill?: string): void {
    this.clearErrors();
    this.mode.set('existing');

    if (prefill) {
      this.searchControl.setValue(prefill);
    }
    this.focusLater(() => this.searchInput());
  }

  // ---------------------------------------------------------------- Existente

  selectUser(user: AssignableUserResponse): void {
    this.selectedUser.set(user);
  }

  maskDocument(user: AssignableUserResponse): string {
    const label = this.documentTypes.find((type) => type.value === user.documentType)?.label ?? '';
    const last = user.documentNumber.slice(-4);
    return `${label} •••• ${last}`;
  }

  onAddExisting(): void {
    const user = this.selectedUser();

    if (!user || this.isSubmitting()) {
      return;
    }

    this.submit(
      this.api.add(this.companyPublicId(), {
        userPublicId: user.publicId,
        privilegePublicIds: this.privilegeIds(),
      }),
      false,
    );
  }

  // ---------------------------------------------------------------- Nueva

  fieldError(field: CreateField): string | null {
    return controlErrorMessage(this.createForm.controls[field], this.serverFieldErrors()[field]);
  }

  onCreate(): void {
    if (this.isSubmitting()) {
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

  // ---------------------------------------------------------------- Internos

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
