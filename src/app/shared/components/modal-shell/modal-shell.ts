import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

/**
 * Contenedor de modal.
 *
 * <p>Concentra todo el comportamiento delicado —foco, teclado, scroll— para
 * que ningun dialogo tenga que reimplementarlo. ADAPTIA es una plataforma de
 * accesibilidad: un modal que atrapa a un usuario de teclado detras del fondo
 * contradice el objeto del producto, asi que esto no es opcional.
 *
 * <p>La visibilidad la controla el padre con `@if`, igual que el bottom-sheet
 * del bottom nav. No hay servicio de dialogos ni estado global.
 */
@Component({
  selector: 'app-modal-shell',
  imports: [],
  templateUrl: './modal-shell.html',
  styleUrl: './modal-shell.scss',
})
export class ModalShell implements AfterViewInit, OnDestroy {
  private static readonly FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
    ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Sin titulo no se pinta cabecera: es lo que necesita el dialogo de confirmacion. */
  readonly title = input<string>();
  readonly icon = input<string>();
  readonly size = input<'narrow' | 'default' | 'wide'>('default');
  readonly closeOnBackdrop = input(true);

  /** Id de un titulo pintado por el contenido proyectado, para cuando no hay cabecera. */
  readonly labelledBy = input<string>();

  readonly closed = output<void>();

  private readonly card = viewChild<ElementRef<HTMLElement>>('card');

  /** Identificador estable para enlazar el titulo con aria-labelledby. */
  readonly titleId = signal(`modal-title-${Math.random().toString(36).slice(2, 10)}`);

  /** El dialogo siempre debe tener nombre accesible, venga de la cabecera o del contenido. */
  readonly labelId = computed(() => (this.title() ? this.titleId() : (this.labelledBy() ?? null)));

  readonly sizeClass = computed(() => {
    const size = this.size();
    return size === 'default' ? '' : `modal--${size}`;
  });

  private previouslyFocused: HTMLElement | null = null;
  private previousBodyOverflow = '';

  ngAfterViewInit(): void {
    this.previouslyFocused = document.activeElement as HTMLElement | null;

    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // El primer elemento enfocable, o la propia tarjeta si el modal es solo texto.
    const target = this.focusableElements()[0] ?? this.card()?.nativeElement;
    target?.focus();
  }

  ngOnDestroy(): void {
    document.body.style.overflow = this.previousBodyOverflow;
    this.previouslyFocused?.focus();
  }

  onBackdropClick(event: MouseEvent): void {
    // Solo el fondo: un clic que empieza dentro de la tarjeta no debe cerrar.
    if (this.closeOnBackdrop() && event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closed.emit();
      return;
    }

    if (event.key === 'Tab') {
      this.trapFocus(event);
    }
  }

  /** Hace que Tab y Shift+Tab ciclen dentro del dialogo en vez de escapar al fondo. */
  private trapFocus(event: KeyboardEvent): void {
    const focusable = this.focusableElements();

    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || active === this.card()?.nativeElement)) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private focusableElements(): HTMLElement[] {
    const root = this.card()?.nativeElement ?? this.hostElement.nativeElement;
    return Array.from(root.querySelectorAll<HTMLElement>(ModalShell.FOCUSABLE)).filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    );
  }
}
