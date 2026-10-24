import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

const MAX_VISIBLE = 3;
const DURATION: Record<ToastType, number> = {
  success: 5_000,
  info: 5_000,
  warning: 7_000,
  error: 10_000,
};

/** Notificaciones breves visibles aunque el contenido de la pagina tenga scroll. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly state = signal<ToastMessage[]>([]);
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private nextId = 0;

  readonly messages = this.state.asReadonly();

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  warning(message: string): void {
    this.show('warning', message);
  }

  info(message: string): void {
    this.show('info', message);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.state.update((current) => current.filter((toast) => toast.id !== id));
  }

  private show(type: ToastType, message: string): void {
    const duplicate = this.state().find(
      (toast) => toast.type === type && toast.message === message,
    );
    if (duplicate) {
      this.dismiss(duplicate.id);
    }

    const toast: ToastMessage = { id: ++this.nextId, type, message };
    const next = [...this.state(), toast];
    const discarded = next.splice(0, Math.max(0, next.length - MAX_VISIBLE));
    discarded.forEach((item) => this.clearTimer(item.id));
    this.state.set(next);

    this.timers.set(
      toast.id,
      setTimeout(() => this.dismiss(toast.id), DURATION[type]),
    );
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
