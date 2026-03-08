import { CanActivateFn, Router } from "@angular/router";
import { inject } from "@angular/core";

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
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    inject(Router).navigate(["/login"]);
    return false;
  }
  if (isTokenExpired(token)) {
    localStorage.removeItem(TOKEN_KEY);
    inject(Router).navigate(["/login"]);
    return false;
  }
  return true;
};
