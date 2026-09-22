import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { PRIVILEGE_LABELS, touchesAdministration } from '../../../core/helpers/privilege-labels';
import { CompanyPrivilegeResponse } from '../../../core/models/company';
import { CompanyMembershipResponse } from '../../../core/models/company-membership';
import { CompanyScopeService } from '../../../core/services/company-scope-service';
import { TokenService } from '../../../core/services/token-service';
import { SiteEvaluatorResponse } from '../../../core/models/site';
import { SitesApiService } from '../../sites/sites-api-service';
import { CompanyUsersApiService } from '../company-users-api-service';
import { AddMemberDialog, MemberAddedEvent } from './add-member-dialog/add-member-dialog';
import { EditMemberDialog, MemberSavedEvent } from './edit-member-dialog/edit-member-dialog';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

/**
 * Miembros de la empresa seleccionada. La ruta exige ADMIN_GENERAL y el
 * backend vuelve a comprobar cada operacion.
 */
@Component({
  selector: 'app-company-users-page',
  imports: [RouterLink, AddMemberDialog, EditMemberDialog],
  templateUrl: './company-users-page.html',
  styleUrl: './company-users-page.scss',
})
export class CompanyUsersPage {
  private readonly api = inject(CompanyUsersApiService);
  private readonly sitesApi = inject(SitesApiService);
  private readonly companyScope = inject(CompanyScopeService);

  /** Enlaces a otras secciones, dentro de la rama actual. */
  readonly sectionLink = this.companyScope.sectionLink.bind(this.companyScope);
  private readonly tokenService = inject(TokenService);

  readonly company = this.companyScope.company;
  readonly labels = PRIVILEGE_LABELS;

  readonly members = signal<CompanyMembershipResponse[]>([]);
  /** Asignaciones a sedes de toda la empresa, para mostrar la sede de cada miembro. */
  readonly assignments = signal<SiteEvaluatorResponse[]>([]);
  readonly catalog = signal<CompanyPrivilegeResponse[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('ALL');

  readonly addOpen = signal(false);
  readonly editing = signal<CompanyMembershipResponse | null>(null);

  readonly isPlatformAdmin = computed(() => this.tokenService.role() === 'ADMIN_PLATAFORMA');

  /** GESTIONAR_ADMINS no se hereda de ADMIN_GENERAL: efectivo == asignado. */
  readonly canManageAdmins = computed(() =>
    this.companyScope.hasAnyPrivilege(['GESTIONAR_ADMINS']),
  );

  readonly activeAdmins = computed(
    () =>
      this.members().filter(
        (member) =>
          member.status === 'ACTIVE' &&
          member.privileges.some((privilege) => privilege.name === 'ADMIN_GENERAL'),
      ).length,
  );

  readonly pendingActivation = computed(
    () =>
      this.members().filter((member) => member.status === 'ACTIVE' && member.mustChangePassword)
        .length,
  );

  readonly adminLimit = computed(() => this.company()?.adminLimit ?? 0);
  readonly adminLimitReached = computed(() => this.activeAdmins() >= this.adminLimit());

  readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();

    return this.members().filter(
      (member) =>
        (status === 'ALL' || member.status === status) &&
        (!term ||
          [member.email, `${member.firstNames} ${member.lastNames}`].some((value) =>
            value.toLowerCase().includes(term),
          )),
    );
  });

  readonly counts = computed(() => ({
    ALL: this.members().length,
    ACTIVE: this.members().filter((member) => member.status === 'ACTIVE').length,
    INACTIVE: this.members().filter((member) => member.status === 'INACTIVE').length,
  }));

  readonly filters: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'Todos' },
    { value: 'ACTIVE', label: 'Activos' },
    { value: 'INACTIVE', label: 'Inactivos' },
  ];

  constructor() {
    // Aviso de eliminacion, llega por `history.state` desde la ficha; solo una vez.
    const deletedUser = (history.state as { deletedUser?: string } | null)?.deletedUser;
    if (deletedUser) {
      this.notice.set(`Eliminamos la cuenta de ${deletedUser}. Su correo quedó libre.`);
      history.replaceState({ ...history.state, deletedUser: undefined }, '');
    }

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
      catalog: this.api.privileges(),
      members: this.api.list(company.publicId),
      assignments: this.sitesApi.assignments(company.publicId),
    }).subscribe({
      next: ({ catalog, members, assignments }) => {
        this.catalog.set(catalog);
        this.members.set(members);
        this.assignments.set(assignments);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar los usuarios.'));
        this.isLoading.set(false);
      },
    });
  }

  /** Asignacion activa del miembro, si tiene. */
  siteOf(member: CompanyMembershipResponse): SiteEvaluatorResponse | null {
    return (
      this.assignments().find(
        (assignment) =>
          assignment.membershipPublicId === member.publicId && assignment.status === 'ACTIVE',
      ) ?? null
    );
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** Nadie modifica su propia membresia (el administrador de plataforma no es miembro). */
  isSelf(member: CompanyMembershipResponse): boolean {
    return !this.isPlatformAdmin() && member.userPublicId === this.tokenService.userPublicId();
  }

  needsAdminManagement(member: CompanyMembershipResponse): boolean {
    return (
      touchesAdministration(member.privileges.map((privilege) => privilege.name)) &&
      !this.canManageAdmins()
    );
  }

  isGeneralAdmin(member: CompanyMembershipResponse): boolean {
    return member.privileges.some((privilege) => privilege.name === 'ADMIN_GENERAL');
  }

  /** Lo que no queda cubierto por Admin. general, para no repetir badges. */
  extraPrivileges(member: CompanyMembershipResponse): CompanyPrivilegeResponse[] {
    return this.isGeneralAdmin(member)
      ? member.privileges.filter((privilege) => privilege.name === 'GESTIONAR_ADMINS')
      : member.privileges;
  }

  initials(member: CompanyMembershipResponse): string {
    return `${member.firstNames.charAt(0)}${member.lastNames.charAt(0)}`.toUpperCase();
  }

  openAdd(): void {
    this.notice.set(null);
    this.addOpen.set(true);
  }

  openEdit(member: CompanyMembershipResponse): void {
    this.notice.set(null);
    this.editing.set(member);
  }

  onAdded(event: MemberAddedEvent): void {
    this.members.update((members) =>
      [...members, event.membership].sort((a, b) => a.email.localeCompare(b.email)),
    );

    // Si se creo la cuenta, el propio dialogo confirma a donde se enviaron las credenciales.
    if (!event.created) {
      this.notice.set(
        `${event.membership.firstNames} ${event.membership.lastNames} se agregó a la empresa.`,
      );
    }
  }

  onSaved(event: MemberSavedEvent): void {
    this.members.update((members) =>
      members.map((member) =>
        member.publicId === event.membership.publicId ? event.membership : member,
      ),
    );

    if (event.notice) {
      this.notice.set(event.notice);
    }
  }
}
