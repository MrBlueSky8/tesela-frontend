import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import {
  CRITICALITY_HINTS,
  CRITICALITY_LABELS,
  LEARNING_CURVE_LABELS,
} from '../../../core/helpers/methodology-labels';
import { transientMessage } from '../../../core/helpers/transient-message';
import {
  AreaCriticality,
  EvaluationAreaResponse,
  JobModality,
  LearningCurve,
  PositionEvaluationFields,
  PositionEvaluationResponse,
  WorkEnvironment,
} from '../../../core/models/position-evaluation';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { CompatibilityApiService } from '../compatibility-api-service';

/** Lo que el evaluador lleva puntuado en un área. */
interface AreaDraft {
  nivelExigencia: number | null;
  criticidad: AreaCriticality | null;
}

/**
 * Evaluacion de un puesto: los campos complementarios y las 30 areas con su
 * nivel de exigencia y su criticidad.
 *
 * <p>El borrador se guarda cuando el evaluador lo pide, no en cada clic: una
 * evaluacion de 30 areas se llena en varias sesiones y guardar a destiempo
 * confundiria mas que ayudar. Publicar exige las 30 y reemplaza la evaluacion
 * vigente anterior del puesto.
 */
@Component({
  selector: 'app-position-evaluation',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './position-evaluation.html',
  styleUrl: './position-evaluation.scss',
})
export class PositionEvaluation {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CompatibilityApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly route = inject(ActivatedRoute);

  readonly company = this.companyContext.company;
  readonly criticalityLabels = CRITICALITY_LABELS;
  readonly criticalityHints = CRITICALITY_HINTS;
  readonly learningCurveLabels = LEARNING_CURVE_LABELS;

  readonly areas = signal<EvaluationAreaResponse[]>([]);
  readonly fields = signal<PositionEvaluationFields | null>(null);
  readonly evaluation = signal<PositionEvaluationResponse | null>(null);

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly isSaving = signal(false);
  readonly isPublishing = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly notice = transientMessage();
  readonly confirmingPublish = signal(false);
  readonly confirmingDiscard = signal(false);
  readonly isDiscarding = signal(false);

  /** Niveles elegidos por área, indexados por orden. */
  readonly draft = signal<Record<number, AreaDraft>>({});
  readonly jornada = signal<JobModality[]>([]);
  readonly entorno = signal<WorkEnvironment[]>([]);
  readonly expanded = signal<number | null>(null);

  readonly contextForm = this.fb.nonNullable.group({
    descripcionLibre: [''],
    notasEvaluador: [''],
    curvaAprendizaje: [''],
  });

  readonly editable = computed(() => this.evaluation()?.editable ?? false);
  readonly publicada = computed(() => this.evaluation()?.estado === 'VIGENTE');

  /** Áreas con nivel y criticidad elegidos: son las que cuentan para publicar. */
  readonly completas = computed(
    () =>
      Object.values(this.draft()).filter(
        (area) => area.nivelExigencia !== null && area.criticidad !== null,
      ).length,
  );

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

  /** Cuántas áreas de un grupo están completas, para el avance por bloque. */
  completasDe(areas: EvaluationAreaResponse[]): number {
    const draft = this.draft();
    return areas.filter(
      (area) =>
        draft[area.orden]?.nivelExigencia !== null
        && draft[area.orden]?.criticidad !== null
        && draft[area.orden] !== undefined,
    ).length;
  }

  constructor() {
    this.load();
  }

  load(): void {
    const company = this.company();
    const positionPublicId = this.route.snapshot.paramMap.get('positionPublicId');

    if (!company || !positionPublicId) {
      this.isLoading.set(false);
      this.loadError.set('No pudimos identificar el puesto.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      areas: this.api.evaluationAreas(),
      fields: this.api.positionEvaluationFields(),
      evaluation: this.api.currentPositionEvaluation(company.publicId, positionPublicId),
    }).subscribe({
      next: ({ areas, fields, evaluation }) => {
        this.isLoading.set(false);
        this.areas.set(areas);
        this.fields.set(fields);
        this.setEvaluation(evaluation);
      },
      error: (error: unknown) => {
        this.isLoading.set(false);
        this.loadError.set(
          error instanceof HttpErrorResponse && error.status === 404
            ? 'Este puesto no pertenece a la empresa.'
            : backendErrorMessage(error, 'No pudimos cargar la evaluación.'),
        );
      },
    });
  }

  /** Abre un borrador, o recupera el que ya tenga abierto el evaluador. */
  onStart(): void {
    const company = this.company();
    const positionPublicId = this.route.snapshot.paramMap.get('positionPublicId');

    if (!company || !positionPublicId || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.actionError.set(null);

    this.api.startPositionEvaluation(company.publicId, positionPublicId).subscribe({
      next: (evaluation) => {
        this.isSaving.set(false);
        this.setEvaluation(evaluation);
        this.notice.set(evaluation.editable
          ? 'Evaluación abierta. Puedes completarla en varias sesiones.'
          : `Este puesto ya tiene un borrador abierto por ${evaluation.evaluadorNombre}.`);
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.actionError.set(backendErrorMessage(error, 'No pudimos abrir la evaluación.'));
      },
    });
  }

  // ---------------------------------------------------------------- Edición

  nivelDe(orden: number): number | null {
    return this.draft()[orden]?.nivelExigencia ?? null;
  }

  criticidadDe(orden: number): AreaCriticality | null {
    return this.draft()[orden]?.criticidad ?? null;
  }

  setNivel(orden: number, nivel: number): void {
    if (!this.editable()) {
      return;
    }
    this.draft.update((current) => ({
      ...current,
      [orden]: { nivelExigencia: nivel, criticidad: current[orden]?.criticidad ?? null },
    }));
  }

  setCriticidad(orden: number, event: Event): void {
    const valor = (event.target as HTMLSelectElement).value as AreaCriticality | '';
    this.draft.update((current) => ({
      ...current,
      [orden]: {
        nivelExigencia: current[orden]?.nivelExigencia ?? null,
        criticidad: valor === '' ? null : valor,
      },
    }));
  }

  toggleExpanded(orden: number): void {
    this.expanded.update((current) => (current === orden ? null : orden));
  }

  toggleJornada(valor: JobModality, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.jornada.update((current) =>
      checked ? [...new Set([...current, valor])] : current.filter((item) => item !== valor),
    );
  }

  toggleEntorno(valor: WorkEnvironment, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.entorno.update((current) =>
      checked ? [...new Set([...current, valor])] : current.filter((item) => item !== valor),
    );
  }

  isJornada(valor: JobModality): boolean {
    return this.jornada().includes(valor);
  }

  isEntorno(valor: WorkEnvironment): boolean {
    return this.entorno().includes(valor);
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

  cancelPublish(): void {
    this.confirmingPublish.set(false);
  }

  /**
   * Descartar pide confirmación porque es irreversible: el borrador y lo
   * puntuado hasta ahora se pierden. Existe para que un borrador abandonado
   * no bloquee al resto, ya que el puesto solo admite uno.
   */
  onDiscard(): void {
    if (!this.confirmingDiscard()) {
      this.confirmingDiscard.set(true);
      return;
    }

    const company = this.company();
    const evaluation = this.evaluation();

    if (!company || !evaluation || this.isDiscarding()) {
      return;
    }

    this.isDiscarding.set(true);
    this.actionError.set(null);

    this.api
      .discardPositionEvaluation(company.publicId, evaluation.positionPublicId, evaluation.publicId)
      .subscribe({
        next: () => {
          this.isDiscarding.set(false);
          this.confirmingDiscard.set(false);
          this.setEvaluation(null);
          this.notice.set('Borrador descartado. El puesto vuelve a quedar sin evaluación.');
        },
        error: (error: unknown) => {
          this.isDiscarding.set(false);
          this.confirmingDiscard.set(false);
          this.actionError.set(backendErrorMessage(error, 'No pudimos descartar el borrador.'));
        },
      });
  }

  cancelDiscard(): void {
    this.confirmingDiscard.set(false);
  }

  private enviar(publicar: boolean): void {
    const company = this.company();
    const evaluation = this.evaluation();

    if (!company || !evaluation || this.isSaving() || this.isPublishing()) {
      return;
    }

    const value = this.contextForm.getRawValue();
    const areas = Object.entries(this.draft())
      .filter(([, area]) => area.nivelExigencia !== null && area.criticidad !== null)
      .map(([orden, area]) => ({
        areaOrden: Number(orden),
        nivelExigencia: area.nivelExigencia as number,
        criticidad: area.criticidad as AreaCriticality,
      }));

    const flag = publicar ? this.isPublishing : this.isSaving;
    flag.set(true);
    this.actionError.set(null);

    this.api
      .savePositionEvaluation(company.publicId, evaluation.positionPublicId, evaluation.publicId, {
        descripcionLibre: value.descripcionLibre.trim() || null,
        notasEvaluador: value.notasEvaluador.trim() || null,
        curvaAprendizaje: (value.curvaAprendizaje as LearningCurve) || null,
        jornada: this.jornada(),
        entorno: this.entorno(),
        areas,
      })
      .subscribe({
        next: (guardada) => {
          if (!publicar) {
            flag.set(false);
            this.setEvaluation(guardada);
            this.notice.set(`Borrador guardado: ${guardada.areasRegistradas} de ${guardada.areasRequeridas} áreas.`);
            return;
          }
          this.publicar(company.publicId, guardada);
        },
        error: (error: unknown) => {
          flag.set(false);
          this.confirmingPublish.set(false);
          this.actionError.set(backendErrorMessage(error, 'No pudimos guardar la evaluación.'));
        },
      });
  }

  /** Publicar guarda primero: lo que se publica es siempre lo que está en pantalla. */
  private publicar(companyPublicId: string, guardada: PositionEvaluationResponse): void {
    this.api
      .publishPositionEvaluation(companyPublicId, guardada.positionPublicId, guardada.publicId)
      .subscribe({
        next: (publicada) => {
          this.isPublishing.set(false);
          this.confirmingPublish.set(false);
          this.setEvaluation(publicada);
          this.notice.set('Evaluación publicada. Ya puede cruzarse con los postulantes.');
        },
        error: (error: unknown) => {
          this.isPublishing.set(false);
          this.confirmingPublish.set(false);
          this.actionError.set(backendErrorMessage(error, 'No pudimos publicar la evaluación.'));
        },
      });
  }

  private setEvaluation(evaluation: PositionEvaluationResponse | null): void {
    this.evaluation.set(evaluation);
    this.confirmingPublish.set(false);
    this.confirmingDiscard.set(false);

    if (!evaluation) {
      this.draft.set({});
      this.jornada.set([]);
      this.entorno.set([]);
      return;
    }

    const draft: Record<number, AreaDraft> = {};
    for (const area of evaluation.areas) {
      draft[area.areaOrden] = {
        nivelExigencia: area.nivelExigencia,
        criticidad: area.criticidad,
      };
    }
    this.draft.set(draft);
    this.jornada.set([...evaluation.jornada]);
    this.entorno.set([...evaluation.entorno]);
    this.contextForm.reset({
      descripcionLibre: evaluation.descripcionLibre ?? '',
      notasEvaluador: evaluation.notasEvaluador ?? '',
      curvaAprendizaje: evaluation.curvaAprendizaje ?? '',
    });
    if (!evaluation.editable) {
      this.contextForm.disable({ emitEvent: false });
    } else {
      this.contextForm.enable({ emitEvent: false });
    }
  }
}
