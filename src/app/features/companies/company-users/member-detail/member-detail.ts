import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, forkJoin, map, switchMap } from 'rxjs';

import { backendErrorMessage } from '../../../../core/helpers/backend-error-message';
import { GENDER_OPTIONS } from '../../../../core/helpers/person-labels';
import { PRIVILEGE_LABELS, touchesAdministration } from '../../../../core/helpers/privilege-labels';
import { CompanyPrivilegeResponse } from '../../../../core/models/company';
import {
  CompanyMemberDetailResponse,
  CompanyMembershipResponse,
  UpdateMemberPersonRequest,
} from '../../../../core/models/company-membership';
import { SiteEvaluatorResponse } from '../../../../core/models/site';
import { Gender } from '../../../../core/models/user-profile-response';
import { CompanyScopeService } from '../../../../core/services/company-scope-service';
import { TokenService } from '../../../../core/services/token-service';
import { transientMessage } from '../../../../core/helpers/transient-message';
import { SitesApiService } from '../../../sites/sites-api-service';
import { CompanyUsersApiService } from '../../company-users-api-service';
import { EditMemberDialog, MemberSavedEvent } from '../edit-member-dialog/edit-member-dialog';

const DOCUMENT_LABELS: Record<string, string> = {
  DNI: 'DNI',
  CE: 'Carne de extranjeria',
  PASSPORT: 'Pasaporte',
};

const ACCOUNT_STATUS: Record<string, string> = {
  ACTIVE: 'Activa',
  INACTIVE: 'Inactiva',
  BLOCKED: 'Bloqueada',
  DELETED: 'Eliminada',
};

/**
 * Ficha de un miembro de la empresa: identidad, datos de contacto y acceso.
 *
 * <p>La identidad es de solo lectura (la corrige Fundades). El contacto
 * pertenece a la persona, asi que un cambio aqui alcanza a todas sus cuentas;
 * la pantalla lo advierte.
 */
@Component({
  selector: 'app-member-detail',
  imports: [ReactiveFormsModule, RouterLink, EditMemberDialog],
  templateUrl: './member-detail.html',
  styleUrl: './member-detail.scss',
})
export class MemberDetail {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CompanyUsersApiService);
  private readonly sitesApi = inject(SitesApiService);
  private readonly companyScope = inject(CompanyScopeService);
  private readonly tokenService = inject(TokenService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly company = this.companyScope.company;
  readonly labels = PRIVILEGE_LABELS;
  readonly genderOptions = GENDER_OPTIONS;

  readonly member = signal<CompanyMemberDetailResponse | null>(null);
  readonly catalog = signal<CompanyPrivilegeResponse[]>([]);
  readonly members = signal<CompanyMembershipResponse[]>([]);
  readonly assignments = signal<SiteEvaluatorResponse[]>([]);

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly isSaving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = transientMessage();

  readonly editOpen = signal(false);

  /** Confirmacion en linea del restablecimiento: no abre otro dialogo. */
  readonly confirmingReset = signal(false);
  readonly isResetting = signal(false);

  readonly isPlatformAdmin = computed(() => this.tokenService.role() === 'ADMIN_PLATAFORMA');
  readonly canManageAdmins = computed(() => this.companyScope.hasAnyPrivilege(['GESTIONAR_ADMINS']));

  /** Tocar a quien tiene privilegios de administracion exige GESTIONAR_ADMINS. */
  readonly isAdminTarget = computed(() =>
    touchesAdministration((this.member()?.privileges ?? []).map((privilege) => privilege.name)),
  );

  readonly canEditPerson = computed(() => !this.isAdminTarget() || this.canManageAdmins());

  readonly fullName = computed(() => {
    const member = this.member();
    return member ? `${member.firstNames} ${member.lastNames}` : '';
  });

  readonly documentLabel = computed(() => {
    const type = this.member()?.documentType;
    return type ? (DOCUMENT_LABELS[type] ?? type) : 'Documento';
  });

  readonly accountStatusLabel = computed(() => {
    const status = this.member()?.accountStatus;
    return status ? (ACCOUNT_STATUS[status] ?? status) : '';
  });

  /** Sede activa del miembro; se gestiona desde Sedes. */
  readonly siteAssignment = computed(
    () =>
      this.assignments().find(
        (assignment) =>
          assignment.membershipPublicId === this.member()?.publicId &&
          assignment.status === 'ACTIVE',
      ) ?? null,
  );

  /** La membresía en formato de listado, que es lo que espera el diálogo de acceso. */
  readonly membershipForDialog = computed<CompanyMembershipResponse | null>(() => {
    const member = this.member();

    if (!member) {
      return null;
    }

    return {
      publicId: member.publicId,
      companyPublicId: member.companyPublicId,
      userPublicId: member.userPublicId,
      email: member.email,
      firstNames: member.firstNames,
      lastNames: member.lastNames,
      privileges: member.privileges,
      status: member.status,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      mustChangePassword: member.mustChangePassword,
    };
  });

  readonly activeAdmins = computed(
    () =>
      this.members().filter(
        (item) =>
          item.status === 'ACTIVE' &&
          item.privileges.some((privilege) => privilege.name === 'ADMIN_GENERAL'),
      ).length,
  );

  readonly adminLimitReached = computed(
    () => this.activeAdmins() >= (this.company()?.adminLimit ?? 0),
  );

  readonly isSelf = computed(
    () => !this.isPlatformAdmin() && this.member()?.userPublicId === this.tokenService.userPublicId(),
  );

  readonly form = this.fb.nonNullable.group({
    telefono: ['', [Validators.pattern(/^[0-9+() -]{6,15}$/)]],
    direccion: ['', [Validators.maxLength(120)]],
    fechaNacimiento: [''],
    genero: [''],
  });

  constructor() {
    // Ir de un miembro a otro reutiliza el componente: hay que recargar.
    this.route.paramMap
      .pipe(
        map((params) => params.get('membershipPublicId')),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.load());
  }

  load(): void {
    const company = this.company();
    const membershipPublicId = this.route.snapshot.paramMap.get('membershipPublicId');

    if (!company || !membershipPublicId) {
      this.isLoading.set(false);
      this.loadError.set('No pudimos identificar al usuario.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      member: this.api.get(company.publicId, membershipPublicId),
      catalog: this.api.privileges(),
      members: this.api.list(company.publicId),
      assignments: this.sitesApi.assignments(company.publicId),
    }).subscribe({
      next: ({ member, catalog, members, assignments }) => {
        this.isLoading.set(false);
        this.catalog.set(catalog);
        this.members.set(members);
        this.assignments.set(assignments);
        this.setMember(member);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(
          error instanceof HttpErrorResponse && error.status === 404
            ? 'Este usuario ya no pertenece a la empresa.'
            : backendErrorMessage(error, 'No pudimos cargar al usuario.'),
        );
      },
    });
  }

  onSave(): void {
    const company = this.company();
    const member = this.member();

    if (!company || !member || this.isSaving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.saveError.set('Revisa los campos marcados.');
      return;
    }

    const payload = this.changes(member);

    if (Object.keys(payload).length === 0) {
      this.saveError.set(null);
      this.saveSuccess.set('No hay cambios por guardar.');
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    this.api.updatePerson(company.publicId, member.publicId, payload).subscribe({
      next: (updated) => {
        this.isSaving.set(false);
        this.setMember(updated);
        this.saveSuccess.set('Datos de contacto actualizados.');
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.saveError.set(
          error instanceof HttpErrorResponse && error.status === 403
            ? 'Necesitas el privilegio Gestionar admins para editar a este usuario.'
            : backendErrorMessage(error, 'No pudimos guardar los cambios.'),
        );
      },
    });
  }

  /** Emite una contrasena temporal nueva y se la envia al usuario en el PDF. */
  onResetPassword(): void {
    const company = this.company();
    const member = this.member();

    if (!company || !member || this.isResetting()) {
      return;
    }

    if (!this.confirmingReset()) {
      this.confirmingReset.set(true);
      return;
    }

    this.isResetting.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(null);

    this.api.resendCredentials(company.publicId, member.publicId).subscribe({
      next: () => {
        this.isResetting.set(false);
        this.confirmingReset.set(false);
        this.saveSuccess.set(
          `Enviamos una contrasena temporal a ${member.email}. La anterior ya no funciona.`,
        );
        this.load();
      },
      error: (error: unknown) => {
        this.isResetting.set(false);
        this.confirmingReset.set(false);
        this.saveError.set(backendErrorMessage(error, 'No pudimos restablecer la contrasena.'));
      },
    });
  }

  cancelReset(): void {
    this.confirmingReset.set(false);
  }

  onDiscard(): void {
    const member = this.member();

    if (member) {
      this.setMember(member);
    }
    this.saveError.set(null);
  }

  /** El diálogo de acceso es el mismo del listado; aquí solo se refresca la ficha. */
  onAccessSaved(event: MemberSavedEvent): void {
    this.editOpen.set(false);
    this.load();

    if (event.notice) {
      this.saveSuccess.set(event.notice);
    }
  }

  fieldError(name: 'telefono' | 'direccion'): string | null {
    const control = this.form.controls[name];

    if (!control.touched && !control.dirty) {
      return null;
    }
    if (control.hasError('pattern')) {
      return 'Usa entre 6 y 15 digitos; se permiten + ( ) - y espacios.';
    }
    if (control.hasError('maxlength')) {
      return 'Usa como maximo 120 caracteres.';
    }
    return null;
  }

  private setMember(member: CompanyMemberDetailResponse): void {
    this.member.set(member);
    this.form.reset({
      telefono: member.phone ?? '',
      direccion: member.address ?? '',
      fechaNacimiento: member.birthDate ?? '',
      genero: member.gender ?? '',
    });

    if (!this.canEditPerson()) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }

  /** Solo lo que cambio. Fecha y genero no pueden vaciarse: el backend ignora los nulos. */
  private changes(member: CompanyMemberDetailResponse): UpdateMemberPersonRequest {
    const value = this.form.getRawValue();
    const payload: UpdateMemberPersonRequest = {};

    if (value.telefono.trim() !== (member.phone ?? '')) {
      payload.telefono = value.telefono.trim();
    }
    if (value.direccion.trim() !== (member.address ?? '')) {
      payload.direccion = value.direccion.trim();
    }
    if (value.fechaNacimiento && value.fechaNacimiento !== member.birthDate) {
      payload.fechaNacimiento = value.fechaNacimiento;
    }
    if (value.genero && value.genero !== member.gender) {
      payload.genero = value.genero as Gender;
    }
    return payload;
  }
}
