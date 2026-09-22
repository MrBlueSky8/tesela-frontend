import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { distinctUntilChanged, forkJoin, map } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { PRIVILEGE_LABELS, isSiteAssignable } from '../../../core/helpers/privilege-labels';
import { CompanyMembershipResponse } from '../../../core/models/company-membership';
import { SiteEvaluatorResponse, SiteResponse } from '../../../core/models/site';
import { CompanyScopeService } from '../../../core/services/company-scope-service';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { CompanyUsersApiService } from '../../companies/company-users-api-service';
import { AssignEvaluatorDialog } from '../assign-evaluator-dialog/assign-evaluator-dialog';
import { SiteFormDialog } from '../site-form-dialog/site-form-dialog';
import { SitesApiService } from '../sites-api-service';

/** Error de una fila; `offerTransfer` cuando reactivar choco con otra sede activa. */
interface RowError {
  id: string;
  message: string;
  offerTransfer: boolean;
}

/** Detalle de una sede y gestion de sus evaluadores. */
@Component({
  selector: 'app-site-detail',
  imports: [RouterLink, ConfirmDialog, SiteFormDialog, AssignEvaluatorDialog],
  templateUrl: './site-detail.html',
  styleUrl: './site-detail.scss',
})
export class SiteDetail {
  private readonly api = inject(SitesApiService);
  private readonly usersApi = inject(CompanyUsersApiService);
  private readonly companyScope = inject(CompanyScopeService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly company = this.companyScope.company;

  private readonly siteId = signal('');

  readonly site = signal<SiteResponse | null>(null);
  readonly evaluators = signal<SiteEvaluatorResponse[]>([]);
  readonly assignments = signal<SiteEvaluatorResponse[]>([]);
  readonly members = signal<CompanyMembershipResponse[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly editOpen = signal(false);
  readonly assignOpen = signal(false);
  readonly confirmStatus = signal(false);
  readonly statusBusy = signal(false);

  readonly confirmingId = signal<string | null>(null);
  readonly rowBusyId = signal<string | null>(null);
  readonly rowError = signal<RowError | null>(null);

  readonly activeEvaluators = computed(
    () => this.evaluators().filter((evaluator) => evaluator.status === 'ACTIVE').length,
  );

  /** Mensaje de la confirmacion de estado, sin "Sus 0 evaluadores". */
  readonly statusMessage = computed(() => {
    if (this.site()?.status !== 'ACTIVE') {
      return 'Sus evaluadores con asignación activa volverán a operar en ella.';
    }
    const count = this.activeEvaluators();
    if (count === 0) {
      return 'No se podrán asignar evaluadores mientras esté inactiva.';
    }
    return count === 1
      ? 'Su evaluador conserva la asignación, pero no podrá operar en ella mientras esté inactiva.'
      : `Sus ${count} evaluadores conservan la asignación, pero no podrán operar en ella mientras esté inactiva.`;
  });

  /** Activos primero. */
  readonly sortedEvaluators = computed(() =>
    [...this.evaluators()].sort(
      (a, b) => Number(a.status !== 'ACTIVE') - Number(b.status !== 'ACTIVE'),
    ),
  );

  constructor() {
    // Angular reutiliza el componente si solo cambia el parametro (p. ej. con
    // Atras/Adelante entre dos detalles): hay que recargar en cada cambio.
    this.route.paramMap
      .pipe(
        map((params) => params.get('sitePublicId') ?? ''),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        this.editOpen.set(false);
        this.assignOpen.set(false);
        this.confirmStatus.set(false);
        this.confirmingId.set(null);
        this.clearMessages();
        this.siteId.set(id);
        this.load();
      });
  }

  load(): void {
    const company = this.company();
    const siteId = this.siteId();

    if (!company || !siteId) {
      this.isLoading.set(false);
      this.loadError.set('No hay una empresa seleccionada.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      site: this.api.get(company.publicId, siteId),
      evaluators: this.api.evaluators(company.publicId, siteId),
      assignments: this.api.assignments(company.publicId),
      members: this.usersApi.list(company.publicId),
    }).subscribe({
      next: ({ site, evaluators, assignments, members }) => {
        this.site.set(site);
        this.evaluators.set(evaluators);
        this.assignments.set(assignments);
        this.members.set(members);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        this.loadError.set(backendErrorMessage(error, 'No pudimos cargar la sede.'));
        this.isLoading.set(false);
      },
    });
  }

  privilegeLabels(evaluator: SiteEvaluatorResponse): string {
    return evaluator.privileges.map((privilege) => PRIVILEGE_LABELS[privilege]).join(', ') || '—';
  }

  /**
   * Una asignacion activa puede quedar sin sentido si el miembro cambio: perdio
   * sus modulos o su membresia se desactivo.
   */
  isNoLongerEligible(evaluator: SiteEvaluatorResponse): boolean {
    const member = this.members().find((m) => m.publicId === evaluator.membershipPublicId);
    return (
      !member ||
      member.status !== 'ACTIVE' ||
      !isSiteAssignable(member.privileges.map((privilege) => privilege.name))
    );
  }

  rowErrorFor(evaluator: SiteEvaluatorResponse): RowError | null {
    const error = this.rowError();
    return error?.id === evaluator.publicId ? error : null;
  }

  // ---------------------------------------------------------------- Sede

  openEdit(): void {
    this.clearMessages();
    this.editOpen.set(true);
  }

  onSaved(site: SiteResponse): void {
    this.site.set(site);
    this.notice.set('Los cambios de la sede se guardaron correctamente.');
  }

  askStatusChange(): void {
    this.clearMessages();
    this.confirmStatus.set(true);
  }

  changeStatus(): void {
    const company = this.company();
    const site = this.site();
    this.confirmStatus.set(false);
    if (!company || !site || this.statusBusy()) {
      return;
    }

    const status = site.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.statusBusy.set(true);

    this.api.update(company.publicId, site.publicId, { status }).subscribe({
      next: (updated) => {
        this.statusBusy.set(false);
        this.site.set(updated);
        this.notice.set(
          updated.status === 'ACTIVE' ? 'La sede se reactivó.' : 'La sede se desactivó.',
        );
      },
      error: (error: unknown) => {
        this.statusBusy.set(false);
        this.actionError.set(
          backendErrorMessage(error, 'No pudimos cambiar el estado de la sede.'),
        );
      },
    });
  }

  // ---------------------------------------------------------------- Evaluadores

  openAssign(): void {
    this.clearMessages();
    this.assignOpen.set(true);
  }

  onAssigned(assignment: SiteEvaluatorResponse): void {
    this.notice.set(
      `Se asignó a ${assignment.firstNames} ${assignment.lastNames} a ${assignment.siteName}.`,
    );
    this.refreshAssignments();
  }

  askDeactivate(evaluator: SiteEvaluatorResponse): void {
    this.clearMessages();
    this.confirmingId.set(evaluator.publicId);
    this.focusRow(evaluator, 'confirm');
  }

  cancelDeactivate(evaluator: SiteEvaluatorResponse): void {
    this.confirmingId.set(null);
    this.focusRow(evaluator, 'status');
  }

  setStatus(evaluator: SiteEvaluatorResponse, status: 'ACTIVE' | 'INACTIVE'): void {
    const company = this.company();
    const site = this.site();
    if (!company || !site) {
      return;
    }

    this.rowBusyId.set(evaluator.publicId);
    this.clearMessages();

    this.api
      .setAssignmentStatus(company.publicId, site.publicId, evaluator.publicId, status)
      .subscribe({
        next: () => {
          this.rowBusyId.set(null);
          this.confirmingId.set(null);
          this.notice.set(
            status === 'ACTIVE'
              ? `Se reactivó la asignación de ${evaluator.firstNames} ${evaluator.lastNames}.`
              : `Se desactivó la asignación de ${evaluator.firstNames} ${evaluator.lastNames}.`,
          );
          this.refreshAssignments(() => this.focusRow(evaluator, 'status'));
        },
        error: (error: unknown) => {
          this.rowBusyId.set(null);
          this.rowError.set({
            id: evaluator.publicId,
            message: backendErrorMessage(error, 'No pudimos actualizar la asignación.'),
            // 409 de regla: ya tiene otra sede activa. Se puede resolver trasladandolo aqui.
            offerTransfer:
              error instanceof HttpErrorResponse &&
              error.status === 409 &&
              (error.error as { code?: string } | null)?.code === 'BUSINESS_RULE',
          });
        },
      });
  }

  /** Reactiva trasladando: desactiva la otra sede y activa esta en una operacion. */
  transferHere(evaluator: SiteEvaluatorResponse): void {
    const company = this.company();
    const site = this.site();
    if (!company || !site) {
      return;
    }

    this.rowBusyId.set(evaluator.publicId);
    this.clearMessages();

    this.api
      .assign(company.publicId, site.publicId, {
        membershipPublicId: evaluator.membershipPublicId,
        transfer: true,
      })
      .subscribe({
        next: (assignment) => {
          this.rowBusyId.set(null);
          this.onAssigned(assignment);
        },
        error: (error: unknown) => {
          this.rowBusyId.set(null);
          this.rowError.set({
            id: evaluator.publicId,
            message: backendErrorMessage(error, 'No pudimos trasladar al evaluador.'),
            offerTransfer: false,
          });
        },
      });
  }

  private refreshAssignments(afterLoad?: () => void): void {
    const company = this.company();
    const site = this.site();
    if (!company || !site) {
      return;
    }

    forkJoin({
      evaluators: this.api.evaluators(company.publicId, site.publicId),
      assignments: this.api.assignments(company.publicId),
    }).subscribe({
      next: ({ evaluators, assignments }) => {
        this.evaluators.set(evaluators);
        this.assignments.set(assignments);
        afterLoad?.();
      },
      error: (error: unknown) => {
        this.actionError.set(backendErrorMessage(error, 'No pudimos actualizar la lista.'));
      },
    });
  }

  private clearMessages(): void {
    this.notice.set(null);
    this.actionError.set(null);
    this.rowError.set(null);
  }

  /** La fila cambia de vista: el foco va al control equivalente para no perderse. */
  private focusRow(evaluator: SiteEvaluatorResponse, action: 'status' | 'confirm'): void {
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>(
            `[data-assignment="${evaluator.publicId}"][data-action="${action}"]`,
          )
          ?.focus(),
      { injector: this.injector },
    );
  }
}
