import { CanActivateFn, Router } from "@angular/router";
import { inject } from "@angular/core";
import { map } from "rxjs";
import { AuthService } from "../services/auth.service";

const TOKEN_KEY = 'cobros_token';

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp as number | undefined;
    if (exp == null) return false;
    return exp < Math.floor(Date.now() / 1000);
  } catch {
    return true;
  }
}

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = sessionStorage.getItem(TOKEN_KEY);

  if (token && !isTokenExpired(token)) return true;

  // El access token falta o expiró: intentar renovarlo con el refresh token (cookie httpOnly).
  return inject(AuthService).tryRestoreSession().pipe(
    map(restored => {
      if (restored) return true;
      router.navigate(["/login"]);
      return false;
    })
  );
};
