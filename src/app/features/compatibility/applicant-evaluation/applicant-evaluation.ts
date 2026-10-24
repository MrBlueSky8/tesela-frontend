import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import {
  APPLICANT_SCALE_LABELS,
  HEALTH_STATUS_LABELS,
  HEALTH_STATUS_VALUES,
} from '../../../core/helpers/methodology-labels';
import {
  ApplicantEvaluationResponse,
  HealthStatus,
} from '../../../core/models/applicant-evaluation';
import { EvaluationAreaResponse } from '../../../core/models/position-evaluation';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { ToastService } from '../../../core/services/toast-service';
import { CompatibilityApiService } from '../compatibility-api-service';

/**
 * Evaluacion de capacidades de una persona: los campos complementarios A a D y
 * las 30 areas con su nivel de capacidad C1 a C5.
 *
 * <p>Es el espejo de la evaluacion de puesto, con dos diferencias: aqui no hay
 * criticidad (la decide el puesto) y los campos complementarios son escalas de
 * la persona, no condiciones del trabajo. El borrador se guarda cuando el
 * evaluador lo pide, no en cada clic.
 */
@Component({
  selector: 'app-applicant-evaluation',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './applicant-evaluation.html',
  styleUrl: './applicant-evaluation.scss',
})
export class ApplicantEvaluation {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CompatibilityApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  readonly company = this.companyContext.company;
  readonly healthLabels = HEALTH_STATUS_LABELS;
  readonly healthValues = HEALTH_STATUS_VALUES;
  readonly scaleLabels = APPLICANT_SCALE_LABELS;
  readonly escala = [1, 2, 3, 4, 5];

  readonly areas = signal<EvaluationAreaResponse[]>([]);
  readonly evaluation = signal<ApplicantEvaluationResponse | null>(null);

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly isPublishing = signal(false);
  readonly confirmingPublish = signal(false);
  readonly confirmingReevaluate = signal(false);

  /** Nivel de capacidad elegido por área, indexado por orden. */
  readonly draft = signal<Record<number, number>>({});
  readonly expanded = signal<number | null>(null);

  readonly form = this.fb.nonNullable.group({
    autocontrol: [''],
    adaptacion: [''],
    motivacion: [''],
    estadoSalud: [''],
    detalleSalud: [''],
    observacionesEvaluador: [''],
  });

  readonly editable = computed(() => this.evaluation()?.editable ?? false);
  readonly publicada = computed(() => this.evaluation()?.estado === 'VIGENTE');
  readonly completas = computed(() => Object.keys(this.draft()).length);

  readonly puedePublicar = computed(
    () => this.editable() && this.completas() === this.areas().length && this.areas().length > 0,
  );

  /** Las áreas agrupadas por bloque, en el orden del catálogo. */
  readonly grupos = computed(() => {
    const grupos: { nombre: string; areas: EvaluationAreaResponse[] }[] = [];
    for (const area of this.areas()) {
      const ultimo = grupos.at(-1);
      if (ultimo && ultimo.nombre === area.grupo) {
        ultimo.areas.push(area);
      } else {
        grupos.push({ nombre: area.grupo, areas: [area] });
      }
    }
    return grupos;
  });

  completasDe(areas: EvaluationAreaResponse[]): number {
    const draft = this.draft();
    return areas.filter((area) => draft[area.orden] !== undefined).length;
  }

  constructor() {
    this.load();
  }

  load(): void {
    const company = this.company();
    const applicantPublicId = this.route.snapshot.paramMap.get('applicantPublicId');

    if (!company || !applicantPublicId) {
      this.isLoading.set(false);
      this.loadError.set('No pudimos identificar al postulante.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      areas: this.api.evaluationAreas(),
      evaluation: this.api.currentApplicantEvaluation(company.publicId, applicantPublicId),
    }).subscribe({
      next: ({ areas, evaluation }) => {
        this.isLoading.set(false);
        this.areas.set(areas);
        this.setEvaluation(evaluation);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(
          error instanceof HttpErrorResponse && error.status === 404
            ? 'Este postulante no pertenece a la empresa.'
            : backendErrorMessage(error, 'No pudimos cargar la evaluación.'),
        );
      },
    });
  }

  /** Abre un borrador, o recupera el que ya tenga abierto el evaluador. */
  onStart(): void {
    const company = this.company();
    const applicantPublicId = this.route.snapshot.paramMap.get('applicantPublicId');

    if (!company || !applicantPublicId || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.api.startApplicantEvaluation(company.publicId, applicantPublicId).subscribe({
      next: (evaluation) => {
        this.isSaving.set(false);
        this.setEvaluation(evaluation);
        this.toast.info('Evaluación abierta. Puedes completarla en varias sesiones.');
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.toast.error(backendErrorMessage(error, 'No pudimos abrir la evaluación.'));
      },
    });
  }

  // ---------------------------------------------------------------- Edición

  nivelDe(orden: number): number | null {
    return this.draft()[orden] ?? null;
  }

  setNivel(orden: number, nivel: number): void {
    if (!this.editable()) {
      return;
    }
    this.draft.update((current) => ({ ...current, [orden]: nivel }));
  }

  toggleExpanded(orden: number): void {
    this.expanded.update((current) => (current === orden ? null : orden));
  }

  // ---------------------------------------------------------------- Guardar y publicar

  onSave(): void {
    this.enviar(false);
  }

  onPublish(): void {
    if (!this.confirmingPublish()) {
      this.confirmingPublish.set(true);
      return;
    }
    this.enviar(true);
  }

  /**
   * Reevaluar abre un borrador nuevo sobre una persona que ya tiene
   * evaluacion vigente. La vigente se conserva como historia; lo que pide
   * confirmacion es que al publicar se recalculan sus cruces.
   */
  onReevaluate(): void {
    if (!this.confirmingReevaluate()) {
      this.confirmingReevaluate.set(true);
      return;
    }
    this.confirmingReevaluate.set(false);
    this.onStart();
  }

  cancelReevaluate(): void {
    this.confirmingReevaluate.set(false);
  }

  cancelPublish(): void {
    this.confirmingPublish.set(false);
  }

  private enviar(publicar: boolean): void {
    const company = this.company();
    const evaluation = this.evaluation();

    if (!company || !evaluation || this.isSaving() || this.isPublishing()) {
      return;
    }

    const value = this.form.getRawValue();
    const areas = Object.entries(this.draft()).map(([orden, nivel]) => ({
      areaOrden: Number(orden),
      nivelCapacidad: nivel,
    }));

    const flag = publicar ? this.isPublishing : this.isSaving;
    flag.set(true);
    this.api
      .saveApplicantEvaluation(
        company.publicId,
        evaluation.applicantPublicId,
        evaluation.publicId,
        {
          autocontrol: value.autocontrol ? Number(value.autocontrol) : null,
          adaptacion: value.adaptacion ? Number(value.adaptacion) : null,
          motivacion: value.motivacion ? Number(value.motivacion) : null,
          estadoSalud: (value.estadoSalud as HealthStatus) || null,
          detalleSalud: value.detalleSalud.trim() || null,
          observacionesEvaluador: value.observacionesEvaluador.trim() || null,
          areas,
        },
      )
      .subscribe({
        next: (guardada) => {
          if (!publicar) {
            flag.set(false);
            this.setEvaluation(guardada);
            this.toast.success(
              `Borrador guardado: ${guardada.areasRegistradas} de ${guardada.areasRequeridas} áreas.`,
            );
            return;
          }
          this.publicar(company.publicId, guardada);
        },
        error: (error: unknown) => {
          flag.set(false);
          this.confirmingPublish.set(false);
          this.toast.error(backendErrorMessage(error, 'No pudimos guardar la evaluación.'));
        },
      });
  }

  /** Publicar guarda primero: lo que se publica es siempre lo que está en pantalla. */
  private publicar(companyPublicId: string, guardada: ApplicantEvaluationResponse): void {
    this.api
      .publishApplicantEvaluation(companyPublicId, guardada.applicantPublicId, guardada.publicId)
      .subscribe({
        next: (publicada) => {
          this.isPublishing.set(false);
          this.confirmingPublish.set(false);
          this.setEvaluation(publicada);
          this.toast.success('Evaluación publicada. Ya puede cruzarse con los puestos.');
        },
        error: (error: unknown) => {
          this.isPublishing.set(false);
          this.confirmingPublish.set(false);
          this.toast.error(backendErrorMessage(error, 'No pudimos publicar la evaluación.'));
        },
      });
  }

  private setEvaluation(evaluation: ApplicantEvaluationResponse | null): void {
    this.evaluation.set(evaluation);
    this.confirmingPublish.set(false);
    this.confirmingReevaluate.set(false);

    if (!evaluation) {
      this.draft.set({});
      return;
    }

    const draft: Record<number, number> = {};
    for (const area of evaluation.areas) {
      draft[area.areaOrden] = area.nivelCapacidad;
    }
    this.draft.set(draft);
    this.form.reset({
      autocontrol: evaluation.autocontrol?.toString() ?? '',
      adaptacion: evaluation.adaptacion?.toString() ?? '',
      motivacion: evaluation.motivacion?.toString() ?? '',
      estadoSalud: evaluation.estadoSalud ?? '',
      detalleSalud: evaluation.detalleSalud ?? '',
      observacionesEvaluador: evaluation.observacionesEvaluador ?? '',
    });
    if (!evaluation.editable) {
      this.form.disable({ emitEvent: false });
    } else {
      this.form.enable({ emitEvent: false });
    }
  }
}
