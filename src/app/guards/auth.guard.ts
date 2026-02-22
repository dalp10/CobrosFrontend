import { CanActivateFn, Router } from "@angular/router";
import { inject } from "@angular/core";

export const authGuard: CanActivateFn = () => {
  const token = localStorage.getItem("cobros_token");
  if (token) return true;
  inject(Router).navigate(["/login"]);
  return false;
};
