import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, tap, finalize, shareReplay, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthUser, LoginResponse } from '../models/index';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'cobros_token';
  private http   = inject(HttpClient);
  private router = inject(Router);
  currentUser = signal<AuthUser | null>(null);

  private refreshInProgress$: Observable<string | null> | null = null;

  constructor() {
    const token = sessionStorage.getItem(this.TOKEN_KEY);
    if (token) this.setUserFromToken(token);
  }

  private setUserFromToken(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp as number | undefined;
      const nowSec = Math.floor(Date.now() / 1000);
      if (exp != null && exp < nowSec) {
        sessionStorage.removeItem(this.TOKEN_KEY);
        return false;
      }
      this.currentUser.set({ id: payload.id, nombre: payload.nombre || 'Admin', email: payload.email || '', rol: payload.rol || 'admin' });
      return true;
    } catch {
      sessionStorage.removeItem(this.TOKEN_KEY);
      return false;
    }
  }

  /** Intenta restaurar la sesión usando el refresh token (cookie httpOnly). Útil al recargar la página. */
  tryRestoreSession(): Observable<boolean> {
    const token = sessionStorage.getItem(this.TOKEN_KEY);
    if (token && this.setUserFromToken(token)) return of(true);

    return this.refreshToken().pipe(map(t => t != null));
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }, { withCredentials: true })
      .pipe(tap(res => {
        sessionStorage.setItem(this.TOKEN_KEY, res.token);
        this.currentUser.set(res.user);
      }));
  }

  /** Renueva el access token usando el refresh token (cookie httpOnly). Comparte la petición si hay varias en curso. */
  refreshToken(): Observable<string | null> {
    if (this.refreshInProgress$) return this.refreshInProgress$;

    this.refreshInProgress$ = this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        map(res => {
          sessionStorage.setItem(this.TOKEN_KEY, res.token);
          this.currentUser.set(res.user);
          return res.token;
        }),
        catchError(() => {
          sessionStorage.removeItem(this.TOKEN_KEY);
          this.currentUser.set(null);
          return of(null);
        }),
        finalize(() => { this.refreshInProgress$ = null; }),
        shareReplay(1)
      );
    return this.refreshInProgress$;
  }

  logout() {
    this.http.post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true }).subscribe();
    sessionStorage.removeItem(this.TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null { return sessionStorage.getItem(this.TOKEN_KEY); }
  isLoggedIn(): boolean { return !!this.getToken(); }
}
