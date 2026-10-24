import { Component, inject } from '@angular/core';

import { ToastService, ToastType } from '../../../core/services/toast-service';

const ICONS: Record<ToastType, string> = {
  success: 'ti-circle-check',
  error: 'ti-alert-circle',
  warning: 'ti-alert-triangle',
  info: 'ti-info-circle',
};

@Component({
  selector: 'app-toast-container',
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.scss',
})
export class ToastContainer {
  readonly toast = inject(ToastService);

  icon(type: ToastType): string {
    return ICONS[type];
  }
}
