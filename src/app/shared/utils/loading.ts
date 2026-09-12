import { ChangeDetectorRef } from '@angular/core';
import { Observer } from 'rxjs';

/**
 * Observer que, tras `next` o `error`, marca `loading` en false y llama a
 * `cdr.detectChanges()`. Evita repetir ese boilerplate en cada `load()`/`cargar()`.
 */
export function withLoading<T>(
  cdr: ChangeDetectorRef,
  setLoading: (value: boolean) => void,
  handlers: { next?: (value: T) => void; error?: (err: unknown) => void }
): Observer<T> {
  return {
    next: (value) => {
      handlers.next?.(value);
      setLoading(false);
      cdr.detectChanges();
    },
    error: (err) => {
      setLoading(false);
      cdr.detectChanges();
      handlers.error?.(err);
    },
    complete: () => {},
  };
}
