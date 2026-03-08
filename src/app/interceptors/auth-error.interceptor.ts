import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const notify = inject(NotificationService);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 || err.status === 403) {
        if (!req.url.includes('/auth/login')) {
          const code = err.error?.code;
          const msg =
            code === 'TOKEN_EXPIRED'
              ? 'Tu sesión ha expirado. Inicia sesión de nuevo.'
              : err.error?.error || 'Sesión expirada. Inicia sesión de nuevo.';
          notify.error(msg);
          auth.logout();
        }
      }
      return throwError(() => err);
    })
  );
};
