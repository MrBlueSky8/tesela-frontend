import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';

import { backendErrorMessage } from '../../../core/helpers/backend-error-message';
import {
  CRITICALITY_HINTS,
  CRITICALITY_LABELS,
  LEARNING_CURVE_LABELS,
  LEVEL_SOURCE_LABELS,
} from '../../../core/helpers/methodology-labels';
import {
  AiAreaSuggestion,
  AiLevelSuggestion,
  AreaCriticality,
  EvaluationAreaResponse,
  JobModality,
  LearningCurve,
  LevelSource,
  PositionEvaluationFields,
  PositionEvaluationResponse,
  SavePositionEvaluationRequest,
  WorkEnvironment,
} from '../../../core/models/position-evaluation';
import { CompanyContextService } from '../../../core/services/company-context-service';
import { ToastService } from '../../../core/services/toast-service';
import { AiAreaSuggestionCard } from '../ai-area-suggestion/ai-area-suggestion';
import { nivelesParaAreasVacias } from '../ai-suggestion/ai-suggestion-rules';
import { AiSuggestionPanel } from '../ai-suggestion-panel/ai-suggestion-panel';
import { CompatibilityApiService } from '../compatibility-api-service';

/** Lo que el evaluador lleva puntuado en un área. */
interface AreaDraft {
  nivelExigencia: number | null;
  criticidad: AreaCriticality | null;
}

interface PendingArea {
  groupName: string;
  area: EvaluationAreaResponse;
  missing: string;
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
  imports: [ReactiveFormsModule, RouterLink, DatePipe, AiSuggestionPanel, AiAreaSuggestionCard],
  templateUrl: './position-evaluation.html',
  styleUrl: './position-evaluation.scss',
})
export class PositionEvaluation {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CompatibilityApiService);
  private readonly companyContext = inject(CompanyContextService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

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
  readonly confirmingPublish = signal(false);
  readonly confirmingDiscard = signal(false);
  readonly confirmingReevaluate = signal(false);
  readonly isDiscarding = signal(false);

  // --- Asistencia de IA (Hito 4). La IA propone; el borrador solo cambia al guardar.
  readonly aiActiva = signal(false);
  readonly sugerencia = signal<AiLevelSuggestion | null>(null);
  readonly sugiriendo = signal(false);
  readonly sugerenciaOculta = signal(false);
  /** Áreas cuya propuesta el evaluador descartó en esta sesión. No se persiste. */
  readonly descartadas = signal<ReadonlySet<number>>(new Set());
  /** Sube con cada propuesta nueva: el panel mueve el foco al resumen. */
  readonly sugerenciaFoco = signal(0);
  readonly levelSourceLabels = LEVEL_SOURCE_LABELS;

  /** Propuesta por orden de área, sin las descartadas. */
  readonly propuestaPorArea = computed(() => {
    const porArea = new Map<number, AiAreaSuggestion>();
    const descartadas = this.descartadas();
    for (const area of this.sugerencia()?.areas ?? []) {
      if (!descartadas.has(area.areaOrden)) {
        porArea.set(area.areaOrden, area);
      }
    }
    return porArea;
  });

  /** Cuántas áreas vacías llenaría "Aplicar niveles". */
  readonly nivelesAplicables = computed(() => {
    const sugerencia = this.sugerencia();
    return sugerencia
      ? Object.keys(nivelesParaAreasVacias(this.draft(), sugerencia, this.descartadas())).length
      : 0;
  });

  /** Origen guardado de cada área, para mostrarlo en modo lectura. */
  readonly origenPorArea = computed(() => {
    const origen = new Map<number, LevelSource>();
    for (const area of this.evaluation()?.areas ?? []) {
      origen.set(area.areaOrden, area.origen);
    }
    return origen;
  });

  /** Niveles elegidos por área, indexados por orden. */
  readonly draft = signal<Record<number, AreaDraft>>({});
  readonly jornada = signal<JobModality[]>([]);
  readonly entorno = signal<WorkEnvironment[]>([]);
  readonly expanded = signal<number | null>(null);
  readonly openGroups = signal<Set<string>>(new Set());

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

  /** Primera área que todavía necesita nivel, criticidad o ambos. */
  readonly nextPending = computed<PendingArea | null>(() => {
    const draft = this.draft();

    for (const group of this.grupos()) {
      for (const area of group.areas) {
        const levelMissing = draft[area.orden]?.nivelExigencia == null;
        const criticalityMissing = draft[area.orden]?.criticidad == null;

        if (levelMissing || criticalityMissing) {
          return {
            groupName: group.nombre,
            area,
            missing:
              levelMissing && criticalityMissing
                ? 'nivel y criticidad'
                : levelMissing
                  ? 'nivel'
                  : 'criticidad',
          };
        }
      }
    }

    return null;
  });

  /** Cuántas áreas de un grupo están completas, para el avance por bloque. */
  completasDe(areas: EvaluationAreaResponse[]): number {
    const draft = this.draft();
    return areas.filter(
      (area) =>
        draft[area.orden]?.nivelExigencia !== null &&
        draft[area.orden]?.criticidad !== null &&
        draft[area.orden] !== undefined,
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
        this.initializeGroupExpansion();
        this.cargarAsistenciaIa();
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

  /** Abre el borrador del puesto, o recupera el que ya tuviera abierto. */
  onStart(): void {
    const company = this.company();
    const positionPublicId = this.route.snapshot.paramMap.get('positionPublicId');

    if (!company || !positionPublicId || this.isSaving()) {
      return;
    }

    this.isSaving.set(true);
    this.api.startPositionEvaluation(company.publicId, positionPublicId).subscribe({
      next: (evaluation) => {
        this.isSaving.set(false);
        this.setEvaluation(evaluation);
        this.initializeGroupExpansion();
        this.cargarAsistenciaIa();
        this.toast.info(evaluation.editable
          ? 'Evaluación abierta. Puedes completarla en varias sesiones.'
          : `Este puesto ya tiene un borrador abierto por ${evaluation.evaluadorNombre}.`);
      },
      error: (error: unknown) => {
        this.isSaving.set(false);
        this.toast.error(backendErrorMessage(error, 'No pudimos abrir la evaluación.'));
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

  isGroupOpen(groupName: string): boolean {
    return this.openGroups().has(groupName);
  }

  toggleGroup(groupName: string): void {
    this.openGroups.update((current) => {
      const updated = new Set(current);
      if (updated.has(groupName)) {
        updated.delete(groupName);
      } else {
        updated.add(groupName);
      }
      return updated;
    });
  }

  /** Abre y enfoca la primera área incompleta, sin alterar sus datos. */
  goToNextPending(closeGroup?: string): void {
    const pending = this.nextPending();
    if (!pending) {
      return;
    }

    this.openGroups.update((current) => {
      const updated = new Set(current);
      if (closeGroup) {
        updated.delete(closeGroup);
      }
      updated.add(pending.groupName);
      return updated;
    });

    requestAnimationFrame(() => {
      const element = document.getElementById(`pe-area-${pending.area.orden}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      element?.focus({ preventScroll: true });
    });
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

    this.api
      .discardPositionEvaluation(company.publicId, evaluation.positionPublicId, evaluation.publicId)
      .subscribe({
        next: () => {
          this.isDiscarding.set(false);
          this.confirmingDiscard.set(false);
          this.setEvaluation(null);
          this.toast.success('Borrador descartado. El puesto vuelve a quedar sin evaluación.');
        },
        error: (error: unknown) => {
          this.isDiscarding.set(false);
          this.confirmingDiscard.set(false);
          this.toast.error(backendErrorMessage(error, 'No pudimos descartar el borrador.'));
        },
      });
  }

  cancelDiscard(): void {
    this.confirmingDiscard.set(false);
  }

  /**
   * Reevaluar abre un borrador nuevo sobre un puesto que ya tiene evaluación
   * vigente. Pide confirmación no porque destruya nada —la vigente se
   * conserva como historia— sino porque al publicar el nuevo se recalculan
   * todos los cruces del puesto.
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

  private enviar(publicar: boolean): void {
    const company = this.company();
    const evaluation = this.evaluation();

    if (!company || !evaluation || this.isSaving() || this.isPublishing()) {
      return;
    }

    const flag = publicar ? this.isPublishing : this.isSaving;
    flag.set(true);
    const antes = this.draft();
    this.api
      .savePositionEvaluation(company.publicId, evaluation.positionPublicId, evaluation.publicId, this.payload())
      .subscribe({
        next: (guardada) => {
          if (!publicar) {
            flag.set(false);
            this.setEvaluation(guardada);
            const pendientes = this.conservarIncompletas(antes);
            this.toast.success(
              `Borrador guardado: ${guardada.areasRegistradas} de ${guardada.areasRequeridas} áreas.` +
                (pendientes > 0
                  ? ` ${pendientes} ${pendientes === 1 ? 'área queda' : 'áreas quedan'} en pantalla sin guardar hasta completar nivel y criticidad.`
                  : ''),
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

  /**
   * El servidor solo guarda áreas completas (nivel y criticidad). Tras guardar,
   * las que estaban a medias se devuelven a la pantalla: sin esto, un nivel
   * aplicado desde la IA (o puesto a mano) sin criticidad desaparecía al guardar.
   */
  private conservarIncompletas(antes: Record<number, AreaDraft>): number {
    const incompletas = Object.entries(antes).filter(
      ([, area]) => (area.nivelExigencia === null) !== (area.criticidad === null),
    );
    if (incompletas.length === 0) {
      return 0;
    }
    this.draft.update((current) => {
      const next = { ...current };
      for (const [orden, area] of incompletas) {
        next[Number(orden)] ??= area;
      }
      return next;
    });
    return incompletas.length;
  }

  /** Lo que hay en pantalla, tal como se guarda. Solo van las áreas completas. */
  private payload(): SavePositionEvaluationRequest {
    const value = this.contextForm.getRawValue();
    const areas = Object.entries(this.draft())
      .filter(([, area]) => area.nivelExigencia !== null && area.criticidad !== null)
      .map(([orden, area]) => ({
        areaOrden: Number(orden),
        nivelExigencia: area.nivelExigencia as number,
        criticidad: area.criticidad as AreaCriticality,
      }));
    return {
      descripcionLibre: value.descripcionLibre.trim() || null,
      notasEvaluador: value.notasEvaluador.trim() || null,
      curvaAprendizaje: (value.curvaAprendizaje as LearningCurve) || null,
      jornada: this.jornada(),
      entorno: this.entorno(),
      areas,
    };
  }

  // ------------------------------------------------------------ Asistencia IA

  /**
   * Estado de la IA y la última propuesta del borrador. Si algo falla, la IA
   * se trata como no disponible: el formulario manual nunca se bloquea.
   */
  private cargarAsistenciaIa(): void {
    const company = this.company();
    const evaluation = this.evaluation();
    this.limpiarSugerencia();
    if (!company || !evaluation?.editable) {
      this.aiActiva.set(false);
      return;
    }

    forkJoin({
      status: this.api.aiStatus().pipe(catchError(() => of({ activa: false, modelo: null }))),
      sugerencia: this.api
        .currentPositionSuggestion(company.publicId, evaluation.positionPublicId, evaluation.publicId)
        .pipe(catchError(() => of(null))),
    }).subscribe(({ status, sugerencia }) => {
      // La respuesta puede llegar tarde: solo vale si sigue siendo el mismo borrador.
      if (this.evaluation()?.publicId !== evaluation.publicId) {
        return;
      }
      this.aiActiva.set(status.activa);
      this.sugerencia.set(status.activa ? sugerencia : null);
    });
  }

  /**
   * Pide la propuesta. Primero guarda el borrador: el servidor lee de lo
   * guardado la jornada, el entorno y el contexto que se envían a la IA.
   */
  onSugerir(): void {
    const company = this.company();
    const evaluation = this.evaluation();
    if (!company || !evaluation?.editable || this.sugiriendo() || this.isSaving() || this.isPublishing()) {
      return;
    }

    this.sugiriendo.set(true);
    this.toast.info('Guardamos el borrador antes de consultar a la IA.');
    const antes = this.draft();
    this.api
      .savePositionEvaluation(company.publicId, evaluation.positionPublicId, evaluation.publicId, this.payload())
      .pipe(
        switchMap((guardada) => {
          this.setEvaluation(guardada);
          this.conservarIncompletas(antes);
          return this.api.suggestPositionLevels(company.publicId, guardada.positionPublicId, guardada.publicId);
        }),
      )
      .subscribe({
        next: (sugerencia) => {
          this.sugiriendo.set(false);
          this.sugerencia.set(sugerencia);
          this.sugerenciaOculta.set(false);
          this.descartadas.set(new Set());
          this.sugerenciaFoco.update((n) => n + 1);
          this.toast.success('La IA preparó una propuesta. Revísala área por área.');
        },
        error: (error: unknown) => {
          this.sugiriendo.set(false);
          this.toast.error(this.mensajeErrorIa(error));
        },
      });
  }

  /** Nivel y criticidad de la IA: la confirmación explícita del área. */
  aceptarSugerencia(orden: number): void {
    const propuesta = this.propuestaPorArea().get(orden);
    if (!this.editable() || !propuesta || propuesta.nivel === null) {
      return;
    }
    this.draft.update((current) => ({
      ...current,
      [orden]: {
        nivelExigencia: propuesta.nivel,
        criticidad: propuesta.criticidad ?? current[orden]?.criticidad ?? null,
      },
    }));
  }

  /** Solo el nivel; la criticidad queda como estaba. */
  aplicarSoloNivel(orden: number): void {
    const propuesta = this.propuestaPorArea().get(orden);
    if (propuesta?.nivel != null) {
      this.setNivel(orden, propuesta.nivel);
    }
  }

  /** Niveles en las áreas vacías. Nunca criticidades ni áreas ya puntuadas. */
  aplicarNivelesVacios(): void {
    const sugerencia = this.sugerencia();
    if (!this.editable() || !sugerencia) {
      return;
    }
    const niveles = nivelesParaAreasVacias(this.draft(), sugerencia, this.descartadas());
    const cuantos = Object.keys(niveles).length;
    this.draft.update((current) => {
      const next = { ...current };
      for (const [orden, nivel] of Object.entries(niveles)) {
        next[Number(orden)] = { nivelExigencia: nivel, criticidad: current[Number(orden)]?.criticidad ?? null };
      }
      return next;
    });
    this.toast.info(
      `${cuantos} ${cuantos === 1 ? 'nivel aplicado' : 'niveles aplicados'}. ` +
        'Falta confirmar la criticidad de cada área y guardar.',
    );
  }

  descartarSugerencia(orden: number): void {
    this.descartadas.update((current) => new Set(current).add(orden));
  }

  ocultarPropuesta(): void {
    this.sugerenciaOculta.set(true);
  }

  mostrarPropuesta(): void {
    this.sugerenciaOculta.set(false);
  }

  private limpiarSugerencia(): void {
    this.sugerencia.set(null);
    this.sugerenciaOculta.set(false);
    this.descartadas.set(new Set());
  }

  private mensajeErrorIa(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 503) {
        return 'La asistencia de IA no está disponible en este momento. Puedes continuar manualmente.';
      }
      if (error.status === 502) {
        return 'La IA no devolvió una propuesta válida. Puedes intentarlo de nuevo o continuar manualmente.';
      }
    }
    return backendErrorMessage(error, 'No pudimos obtener la sugerencia de la IA.');
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
          this.toast.success('Evaluación publicada. Ya puede cruzarse con los postulantes.');
        },
        error: (error: unknown) => {
          this.isPublishing.set(false);
          this.confirmingPublish.set(false);
          this.toast.error(backendErrorMessage(error, 'No pudimos publicar la evaluación.'));
        },
      });
  }

  private setEvaluation(evaluation: PositionEvaluationResponse | null): void {
    this.evaluation.set(evaluation);
    this.confirmingPublish.set(false);
    this.confirmingDiscard.set(false);
    this.confirmingReevaluate.set(false);

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

  /** Al entrar, oculta lo completo y deja listo el primer bloque pendiente. */
  private initializeGroupExpansion(): void {
    const firstIncomplete = this.grupos().find(
      (group) => this.completasDe(group.areas) < group.areas.length,
    );
    this.openGroups.set(new Set(firstIncomplete ? [firstIncomplete.nombre] : []));
  }
}
