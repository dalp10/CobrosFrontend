import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { retry, timer, throwError } from 'rxjs';

const MAX_RETRIES = 1;
const DELAY_MS = 800;

function isRetryable(err: HttpErrorResponse): boolean {
  if (err.status === 0) return true; // red / CORS
  if (err.status >= 500 && err.status < 600) return true; // 502, 503, 504, etc.
  return false;
}

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      delay: (err, count) => {
        if (count > MAX_RETRIES) return throwError(() => err);
        if (!isRetryable(err)) return throwError(() => err); // no reintentar 4xx
        return timer(DELAY_MS);
      },
    })
  );
};
