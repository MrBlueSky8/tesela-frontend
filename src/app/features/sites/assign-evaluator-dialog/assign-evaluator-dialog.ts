import { Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import { PRIVILEGE_LABELS, isSiteAssignable } from '../../../core/helpers/privilege-labels';
import { CompanyMembershipResponse } from '../../../core/models/company-membership';
import { SiteEvaluatorResponse, SiteResponse } from '../../../core/models/site';
import { ModalShell } from '../../../shared/components/modal-shell/modal-shell';
import { SitesApiService } from '../sites-api-service';

interface Candidate {
  member: CompanyMembershipResponse;
  /** Asignacion activa en otra sede, si tiene: asignarlo aqui es un traslado. */
  currentAssignment: SiteEvaluatorResponse | null;
}

/**
 * Asignar un evaluador a la sede. Solo lista miembros elegibles (mismo criterio
 * que el backend) y avisa del traslado antes de enviar, no despues del 409.
 */
@Component({
  selector: 'app-assign-evaluator-dialog',
  imports: [ModalShell, RouterLink],
  templateUrl: './assign-evaluator-dialog.html',
  styleUrl: './assign-evaluator-dialog.scss',
})
export class AssignEvaluatorDialog {
  private readonly api = inject(SitesApiService);

  readonly companyPublicId = input.required<string>();
  readonly site = input.required<SiteResponse>();
  readonly members = input.required<CompanyMembershipResponse[]>();
  /** Asignaciones de toda la empresa. */
  readonly assignments = input.required<SiteEvaluatorResponse[]>();

  readonly assigned = output<SiteEvaluatorResponse>();
  readonly closed = output<void>();

  readonly search = signal('');
  readonly selectedId = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);
  /** El backend detecto un traslado que la pantalla no conocia (datos desactualizados). */
  readonly transferRequiredByServer = signal(false);

  readonly candidates = computed<Candidate[]>(() => {
    const siteId = this.site().publicId;
    const active = this.assignments().filter((assignment) => assignment.status === 'ACTIVE');

    return this.members()
      .filter(
        (member) =>
          member.status === 'ACTIVE' &&
          isSiteAssignable(member.privileges.map((privilege) => privilege.name)) &&
          !active.some(
            (a) => a.membershipPublicId === member.publicId && a.sitePublicId === siteId,
          ),
      )
      .map((member) => ({
        member,
        currentAssignment:
          active.find(
            (a) => a.membershipPublicId === member.publicId && a.sitePublicId !== siteId,
          ) ?? null,
      }));
  });

  readonly filtered = computed(() => {
    const term = normalize(this.search());
    return this.candidates().filter(
      ({ member }) =>
        !term ||
        normalize(`${member.firstNames} ${member.lastNames} ${member.email}`).includes(term),
    );
  });

  readonly selected = computed(
    () => this.candidates().find((c) => c.member.publicId === this.selectedId()) ?? null,
  );

  readonly isTransfer = computed(
    () => !!this.selected()?.currentAssignment || this.transferRequiredByServer(),
  );

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  select(candidate: Candidate): void {
    this.selectedId.set(candidate.member.publicId);
    this.error.set(null);
    this.transferRequiredByServer.set(false);
  }

  privilegeLabels(member: CompanyMembershipResponse): string {
    return member.privileges.map((privilege) => PRIVILEGE_LABELS[privilege.name]).join(', ');
  }

  onSubmit(): void {
    const candidate = this.selected();
    if (!candidate || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);

    this.api
      .assign(this.companyPublicId(), this.site().publicId, {
        membershipPublicId: candidate.member.publicId,
        transfer: this.isTransfer(),
      })
      .subscribe({
        next: (assignment) => {
          this.isSaving.set(false);
          this.assigned.emit(assignment);
          this.closed.emit();
        },
        error: (error: unknown) => {
          this.isSaving.set(false);
          const message = backendErrorMessage(error, 'No pudimos asignar al evaluador.');
          // 409 de regla de negocio: ya tiene otra sede. Se ofrece el traslado.
          if (
            error instanceof HttpErrorResponse &&
            error.status === 409 &&
            (error.error as { code?: string } | null)?.code === 'BUSINESS_RULE'
          ) {
            this.transferRequiredByServer.set(true);
          }
          this.error.set(message);
        },
      });
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}
