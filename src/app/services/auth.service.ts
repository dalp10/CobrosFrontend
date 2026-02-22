import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthUser, LoginResponse } from '../models/index';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'cobros_token';
  private http   = inject(HttpClient);
  private router = inject(Router);
  currentUser = signal<AuthUser | null>(null);

  constructor() {
    const token = localStorage.getItem(this.TOKEN_KEY);
    if (token) {
      // NO llamar /auth/me - solo decodificar el token local
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        this.currentUser.set({ id: payload.id, nombre: payload.nombre || 'Admin', email: payload.email || '', rol: payload.rol || 'admin' });
      } catch(e) {
        localStorage.removeItem(this.TOKEN_KEY);
      }
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.token);
        this.currentUser.set(res.user);
      }));
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null { return localStorage.getItem(this.TOKEN_KEY); }
  isLoggedIn(): boolean { return !!this.getToken(); }
}
