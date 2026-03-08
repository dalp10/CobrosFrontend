import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * Guard que exige uno de los roles indicados.
 * Uso en rutas: canActivate: [roleGuard(['admin'])]
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.currentUser();
    if (!user) {
      router.navigate(['/login']);
      return of(false);
    }
    if (allowedRoles.length === 0 || allowedRoles.includes(user.rol)) {
      return of(true);
    }
    router.navigate(['/']);
    return of(false);
  };
}
