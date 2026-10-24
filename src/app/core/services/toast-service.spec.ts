import { TestBed } from '@angular/core/testing';

import { ToastService } from './toast-service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('shows and automatically dismisses a success notification', () => {
    service.success('Borrador guardado.');

    expect(service.messages()).toEqual([
      expect.objectContaining({ type: 'success', message: 'Borrador guardado.' }),
    ]);

    vi.advanceTimersByTime(5_000);
    expect(service.messages()).toEqual([]);
  });

  it('keeps at most three notifications and allows manual dismissal', () => {
    service.info('Uno');
    service.success('Dos');
    service.warning('Tres');
    service.error('Cuatro');

    expect(service.messages().map((toast) => toast.message)).toEqual(['Dos', 'Tres', 'Cuatro']);

    service.dismiss(service.messages()[1].id);
    expect(service.messages().map((toast) => toast.message)).toEqual(['Dos', 'Cuatro']);
  });
});
