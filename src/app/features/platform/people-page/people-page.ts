import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { GENDER_OPTIONS } from '../../../core/helpers/person-labels';
import { transientMessage } from '../../../core/helpers/transient-message';
import { DocumentType, Gender } from '../../../core/models/user-profile-response';
import { TokenService } from '../../../core/services/token-service';
import {
  AdminPersonResponse,
  PeopleApiService,
  PersonAccount,
  UpdatePersonRequest,
} from '../people-api-service';

const DOCUMENT_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'DNI', label: 'DNI' },
  { value: 'CE', label: 'Carné de extranjería' },
  { value: 'PASSPORT', label: 'Pasaporte' },
];

const ACCOUNT_STATUS: Record<string, string> = {
  ACTIVE: 'Activa',
  INACTIVE: 'Inactiva',
  BLOCKED: 'Bloqueada',
  DELETED: 'Eliminada',
};

/**
 * Soporte de Fundades: buscar una persona por documento exacto y corregir sus
 * datos (un mal tecleo al registrarla). Los cambios alcanzan a todas sus cuentas.
 */
@Component({
  selector: 'app-people-page',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './people-page.html',
  styleUrl: './people-page.scss',
})
export class PeoplePage {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(PeopleApiService);
  private readonly tokenService = inject(TokenService);

  private readonly resultHeading = viewChild<ElementRef<HTMLElement>>('resultHeading');

  readonly documentOptions = DOCUMENT_OPTIONS;
  readonly genderOptions = GENDER_OPTIONS;

  readonly isSearching = signal(false);
  readonly searchError = signal<string | null>(null);
  readonly person = signal<AdminPersonResponse | null>(null);

  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  // Confirmacion: se borra sola a los pocos segundos.
  readonly saveSuccess = transientMessage();
  /** Confirmacion en linea antes de cambiar el documento (identifica a la persona). */
  readonly confirmDocumentChange = signal(false);

  /** publicId de la cuenta cuyo restablecimiento espera confirmacion. */
  readonly confirmingReset = signal<string | null>(null);
  readonly resettingId = signal<string | null>(null);

  /** publicId de la cuenta cuya eliminacion espera confirmacion (irreversible). */
  readonly confirmingDelete = signal<string | null>(null);
  readonly deleteAcknowledged = signal(false);
  readonly deletingId = signal<string | null>(null);

  /** Cuenta con la que opera Fundades: no puede eliminarse a si mismo. */
  readonly ownUserId = this.tokenService.userPublicId;

  readonly searchForm = this.fb.nonNullable.group({
    documentType: ['DNI' as DocumentType, [Validators.required]],
    documentNumber: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
  });

  readonly editForm = this.fb.nonNullable.group({
    documentType: ['DNI' as DocumentType, [Validators.required]],
    documentNumber: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
    firstNames: ['', [Validators.required, Validators.maxLength(500)]],
    lastNames: ['', [Validators.required, Validators.maxLength(500)]],
    birthDate: [''],
    gender: [''],
    address: ['', [Validators.maxLength(120)]],
    phone: ['', [Validators.pattern(/^[0-9+() -]{6,15}$/)]],
  });

  onSearch(): void {
    if (this.isSearching()) {
      return;
    }
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      this.searchError.set('Indica el tipo y el número de documento.');
      return;
    }

    const { documentType, documentNumber } = this.searchForm.getRawValue();
    this.isSearching.set(true);
    this.searchError.set(null);
    this.saveError.set(null);
    this.saveSuccess.set(null);
    this.person.set(null);

    this.api.findByDocument(documentType, documentNumber.trim()).subscribe({
      next: (person) => {
        this.isSearching.set(false);
        this.setPerson(person);
        setTimeout(() => this.resultHeading()?.nativeElement.focus());
      },
      error: (error: unknown) => {
        this.isSearching.set(false);
        this.searchError.set(
          error instanceof HttpErrorResponse && error.status === 404
            ? 'No hay ninguna persona registrada con ese documento.'
            : backendErrorMessage(error, 'No pudimos buscar a la persona.'),
        );
      },
    });
  }

  onSave(): void {
    const current = this.person();
    if (!current || this.isSaving()) {
      return;
    }
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.saveError.set('Revisa los campos marcados.');
      return;
    }

    const payload = this.changes(current);
    if (Object.keys(payload).length === 0) {
      this.saveError.set(null);
      this.saveSuccess.set('No hay cambios por guardar.');
      return;
    }

    const documentChanged = payload.documentType !== undefined || payload.documentNumber !== undefined;
    if (documentChanged && !this.confirmDocumentChange()) {
      this.confirmDocumentChange.set(true);
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    this.api.update(current.publicId, payload).subscribe({
      next: (person) => {
        this.isSaving.set(false);
        this.confirmDocumentChange.set(false);
        this.setPerson(person);
        this.saveSuccess.set('Datos de la persona actualizados.');
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.confirmDocumentChange.set(false);
        this.saveError.set(backendErrorMessage(error, 'No pudimos guardar los cambios.'));
      },
    });
  }

  onCancelDocumentChange(): void {
    this.confirmDocumentChange.set(false);
  }

  /**
   * Emite una contrasena temporal para una cuenta de la persona. Es el soporte
   * de ultimo recurso cuando el usuario no puede recuperarla por si mismo.
   */
  onResetPassword(account: PersonAccount): void {
    const person = this.person();

    if (!person || this.resettingId()) {
      return;
    }

    if (this.confirmingReset() !== account.publicId) {
      this.cancelDelete();
      this.confirmingReset.set(account.publicId);
      return;
    }

    this.resettingId.set(account.publicId);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    this.api.resetAccountPassword(person.publicId, account.publicId).subscribe({
      next: (updated) => {
        this.resettingId.set(null);
        this.confirmingReset.set(null);
        this.setPerson(updated);
        this.saveSuccess.set(
          `Enviamos una contraseña temporal a ${account.email}. La anterior ya no funciona.`,
        );
      },
      error: (error: unknown) => {
        this.resettingId.set(null);
        this.confirmingReset.set(null);
        this.saveError.set(backendErrorMessage(error, 'No pudimos restablecer la contraseña.'));
      },
    });
  }

  cancelReset(): void {
    this.confirmingReset.set(null);
  }

  /** Elimina la cuenta; queda en la ficha de la persona como historial. */
  onDeleteAccount(account: PersonAccount): void {
    const person = this.person();

    if (!person || this.deletingId()) {
      return;
    }

    if (this.confirmingDelete() !== account.publicId) {
      this.confirmingReset.set(null);
      this.confirmingDelete.set(account.publicId);
      this.deleteAcknowledged.set(false);
      return;
    }
    if (!this.deleteAcknowledged()) {
      return;
    }

    this.deletingId.set(account.publicId);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    this.api.deleteAccount(person.publicId, account.publicId).subscribe({
      next: (updated) => {
        this.deletingId.set(null);
        this.cancelDelete();
        this.setPerson(updated);
        this.saveSuccess.set(`Eliminamos la cuenta ${account.email}. El correo quedó libre.`);
      },
      error: (error: unknown) => {
        this.deletingId.set(null);
        this.cancelDelete();
        this.saveError.set(backendErrorMessage(error, 'No pudimos eliminar la cuenta.'));
      },
    });
  }

  cancelDelete(): void {
    this.confirmingDelete.set(null);
    this.deleteAcknowledged.set(false);
  }

  onDiscard(): void {
    const current = this.person();
    if (current) {
      this.setPerson(current);
    }
    this.confirmDocumentChange.set(false);
    this.saveError.set(null);
    this.saveSuccess.set(null);
  }

  accountStatus(status: string): string {
    return ACCOUNT_STATUS[status] ?? status;
  }

  fieldError(name: keyof typeof this.editForm.controls): string | null {
    const control = this.editForm.controls[name];
    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }
    if (control.hasError('minlength')) {
      return 'Usa al menos 3 caracteres.';
    }
    if (control.hasError('maxlength')) {
      return 'El texto es demasiado largo.';
    }
    if (control.hasError('pattern')) {
      return 'Usa entre 6 y 15 dígitos; se permiten + ( ) - y espacios.';
    }
    return null;
  }

  private setPerson(person: AdminPersonResponse): void {
    this.person.set(person);
    this.editForm.reset({
      documentType: person.documentType,
      documentNumber: person.documentNumber,
      firstNames: person.firstNames,
      lastNames: person.lastNames,
      birthDate: person.birthDate ?? '',
      gender: person.gender ?? '',
      address: person.address ?? '',
      phone: person.phone ?? '',
    });
  }

  private changes(current: AdminPersonResponse): UpdatePersonRequest {
    const value = this.editForm.getRawValue();
    const payload: UpdatePersonRequest = {};

    if (value.documentType !== current.documentType) {
      payload.documentType = value.documentType;
    }
    if (value.documentNumber.trim() !== current.documentNumber) {
      payload.documentNumber = value.documentNumber.trim();
    }
    if (value.firstNames.trim() !== current.firstNames) {
      payload.firstNames = value.firstNames.trim();
    }
    if (value.lastNames.trim() !== current.lastNames) {
      payload.lastNames = value.lastNames.trim();
    }
    if (value.birthDate && value.birthDate !== current.birthDate) {
      payload.birthDate = value.birthDate;
    }
    if (value.gender && value.gender !== current.gender) {
      payload.gender = value.gender as Gender;
    }
    if (value.address.trim() !== (current.address ?? '')) {
      payload.address = value.address.trim();
    }
    if (value.phone.trim() !== (current.phone ?? '')) {
      payload.phone = value.phone.trim();
    }
    return payload;
  }
}
