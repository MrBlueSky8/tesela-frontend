import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { backendErrorMessage } from '../../../../core/helpers/backend-error-message';
import {
  explicitPrivileges,
  samePrivileges,
  touchesAdministration,
} from '../../../../core/helpers/privilege-labels';
import {
  CompanyPrivilege,
  CompanyPrivilegeResponse,
  MembershipStatus,
} from '../../../../core/models/company';
import {
  CompanyMembershipResponse,
  UpdateCompanyMembershipRequest,
} from '../../../../core/models/company-membership';
import { ModalShell } from '../../../../shared/components/modal-shell/modal-shell';
import { CompanyUsersApiService } from '../../company-users-api-service';
import { PrivilegePicker } from '../privilege-picker/privilege-picker';

type Confirmation = 'deactivate' | 'resend';

export interface MemberSavedEvent {
  membership: CompanyMembershipResponse;
  /** Aviso para la pagina; null cuando el propio dialogo ya lo muestra. */
  notice: string | null;
}

/**
 * Editar privilegios y estado de un miembro, y reenviarle credenciales
 * mientras no haya activado su cuenta.
 *
 * <p>Las confirmaciones se muestran dentro del mismo dialogo en vez de apilar
 * otro modal: dos trampas de foco anidadas se pelean por el Tab.
 */
@Component({
  selector: 'app-edit-member-dialog',
  imports: [ModalShell, PrivilegePicker],
  templateUrl: './edit-member-dialog.html',
  styleUrl: './edit-member-dialog.scss',
})
export class EditMemberDialog implements OnInit {
  private readonly api = inject(CompanyUsersApiService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');
  private readonly saveButton = viewChild<ElementRef<HTMLButtonElement>>('saveButton');
  private readonly resendButton = viewChild<ElementRef<HTMLButtonElement>>('resendButton');

  readonly companyPublicId = input.required<string>();
  readonly membership = input.required<CompanyMembershipResponse>();
  readonly catalog = input.required<CompanyPrivilegeResponse[]>();
  readonly canManageAdmins = input(false);
  readonly adminLimitReached = input(false);

  readonly saved = output<MemberSavedEvent>();
  readonly closed = output<void>();

  /** Ultima version conocida: cambia tras un reenvio sin cerrar el dialogo. */
  private readonly latest = signal<CompanyMembershipResponse | null>(null);
  readonly member = computed(() => this.latest() ?? this.membership());

  readonly privileges = signal<CompanyPrivilege[]>([]);
  readonly status = signal<MembershipStatus>('ACTIVE');

  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly confirming = signal<Confirmation | null>(null);

  readonly assigned = computed(() => this.member().privileges.map((privilege) => privilege.name));

  readonly fullName = computed(() => `${this.member().firstNames} ${this.member().lastNames}`);

  /** Mismo criterio que CompanyService: tocar a un administrador exige GESTIONAR_ADMINS. */
  readonly locked = computed(
    () => touchesAdministration(this.assigned()) && !this.canManageAdmins(),
  );

  readonly changes = computed<UpdateCompanyMembershipRequest>(() => {
    const request: UpdateCompanyMembershipRequest = {};

    if (!samePrivileges(this.assigned(), this.privileges())) {
      request.privilegePublicIds = this.privilegeIds();
    }
    if (this.status() !== this.member().status) {
      request.status = this.status();
    }
    return request;
  });

  readonly hasChanges = computed(() => Object.keys(this.changes()).length > 0);

  /** Solo avisa si la membresia pasaria a contar como administrador activo nuevo. */
  readonly warnAdminLimit = computed(() => {
    const wasActiveAdmin =
      this.assigned().includes('ADMIN_GENERAL') && this.member().status === 'ACTIVE';
    return this.adminLimitReached() && !wasActiveAdmin && this.status() === 'ACTIVE';
  });

  readonly canResend = computed(
    () => this.member().mustChangePassword && this.member().status === 'ACTIVE' && !this.locked(),
  );

  ngOnInit(): void {
    this.resetFrom(this.membership());
  }

  setStatus(status: MembershipStatus): void {
    this.status.set(status);
    this.error.set(null);
  }

  onSave(): void {
    if (!this.hasChanges() || this.isSaving() || this.locked()) {
      return;
    }

    // Desactivar corta el acceso de la persona: se confirma antes.
    if (this.changes().status === 'INACTIVE') {
      this.ask('deactivate');
      return;
    }

    this.save();
  }

  onResend(): void {
    if (this.canResend()) {
      this.ask('resend');
    }
  }

  cancelConfirmation(): void {
    const confirmation = this.confirming();
    this.confirming.set(null);
    this.restoreFocus(confirmation);
  }

  confirm(): void {
    const confirmation = this.confirming();
    this.confirming.set(null);

    if (confirmation === 'deactivate') {
      this.save();
    } else if (confirmation === 'resend') {
      this.resend();
    }
    this.restoreFocus(confirmation);
  }

  private save(): void {
    this.isSaving.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.api.update(this.companyPublicId(), this.member().publicId, this.changes()).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.saved.emit({
          membership: updated,
          notice: `Se actualizo la membresia de ${updated.firstNames} ${updated.lastNames}.`,
        });
        this.closed.emit();
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.error.set(backendErrorMessage(error, 'No pudimos guardar los cambios.'));
      },
    });
  }

  private resend(): void {
    this.isSaving.set(true);
    this.error.set(null);
    this.notice.set(null);

    this.api.resendCredentials(this.companyPublicId(), this.member().publicId).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.latest.set(updated);
        this.notice.set(
          `Enviamos una nueva contrasena temporal a ${updated.email}. La anterior ya no funciona.`,
        );
        this.saved.emit({ membership: updated, notice: null });
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.error.set(backendErrorMessage(error, 'No pudimos reenviar las credenciales.'));
      },
    });
  }

  private ask(confirmation: Confirmation): void {
    this.confirming.set(confirmation);
    afterNextRender(() => this.confirmButton()?.nativeElement.focus(), { injector: this.injector });
  }

  /**
   * La vista de confirmacion reemplaza a la del formulario: sin esto el foco
   * quedaria en un boton que ya no existe y podria escapar del modal.
   */
  private restoreFocus(confirmation: Confirmation | null): void {
    afterNextRender(
      () => {
        const target = (confirmation === 'resend' ? this.resendButton() : this.saveButton())
          ?.nativeElement;

        // Un boton deshabilitado (p. ej. mientras guarda) no acepta foco.
        const fallback = this.host.nativeElement.querySelector<HTMLElement>(
          '.modal-foot button:not([disabled])',
        );
        (target && !target.disabled ? target : fallback)?.focus();
      },
      { injector: this.injector },
    );
  }

  private resetFrom(membership: CompanyMembershipResponse): void {
    this.privileges.set(
      explicitPrivileges(membership.privileges.map((privilege) => privilege.name)),
    );
    this.status.set(membership.status);
  }

  private privilegeIds(): string[] {
    const byName = new Map(this.catalog().map((privilege) => [privilege.name, privilege.publicId]));
    return explicitPrivileges(this.privileges())
      .map((name) => byName.get(name))
      .filter((id): id is string => !!id);
  }
}
