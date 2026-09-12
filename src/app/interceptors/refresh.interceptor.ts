import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Si el access token expiró (401 TOKEN_EXPIRED), renueva con el refresh token y reintenta la petición una vez. */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
    return next(req);
  }

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || err.error?.code !== 'TOKEN_EXPIRED') {
        return throwError(() => err);
      }
      return auth.refreshToken().pipe(
        switchMap(token => {
          if (!token) return throwError(() => err);
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
        })
      );
    })
  );
};
