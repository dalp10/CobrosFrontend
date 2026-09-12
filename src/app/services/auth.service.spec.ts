import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

function buildToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  const navigate = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  it('login guarda el token en sessionStorage y setea currentUser', () => {
    const user = { id: 1, nombre: 'Admin', email: 'admin@test.com', rol: 'admin' as const };
    service.login('admin@test.com', '123456').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({ token: 'tok123', user });

    expect(sessionStorage.getItem('cobros_token')).toBe('tok123');
    expect(service.currentUser()).toEqual(user);
    expect(service.getToken()).toBe('tok123');
    expect(service.isLoggedIn()).toBe(true);
  });

  it('logout limpia el token, currentUser y navega a /login', () => {
    sessionStorage.setItem('cobros_token', 'tok123');
    service.logout();

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
    req.flush({});

    expect(sessionStorage.getItem('cobros_token')).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('refreshToken renueva el token usando la cookie httpOnly', () => {
    const user = { id: 1, nombre: 'Admin', email: 'admin@test.com', rol: 'admin' as const };
    service.refreshToken().subscribe(token => {
      expect(token).toBe('nuevo-token');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(req.request.withCredentials).toBe(true);
    req.flush({ token: 'nuevo-token', user });

    expect(sessionStorage.getItem('cobros_token')).toBe('nuevo-token');
    expect(service.currentUser()).toEqual(user);
  });

  it('refreshToken limpia la sesión si el refresh falla', () => {
    sessionStorage.setItem('cobros_token', 'viejo');
    service.refreshToken().subscribe(token => {
      expect(token).toBeNull();
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    req.flush({ error: 'no autorizado' }, { status: 401, statusText: 'Unauthorized' });

    expect(sessionStorage.getItem('cobros_token')).toBeNull();
    expect(service.currentUser()).toBeNull();
  });

  it('tryRestoreSession devuelve true si ya hay un token válido en sessionStorage', () => {
    const token = buildToken({ id: 1, nombre: 'Admin', email: 'admin@test.com', rol: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });
    sessionStorage.setItem('cobros_token', token);

    service.tryRestoreSession().subscribe(restored => {
      expect(restored).toBe(true);
    });
    httpMock.expectNone(`${environment.apiUrl}/auth/refresh`);
  });

  it('tryRestoreSession intenta refresh si el token está expirado', () => {
    const token = buildToken({ id: 1, nombre: 'Admin', email: 'admin@test.com', rol: 'admin', exp: Math.floor(Date.now() / 1000) - 10 });
    sessionStorage.setItem('cobros_token', token);

    service.tryRestoreSession().subscribe(restored => {
      expect(restored).toBe(true);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/refresh`);
    req.flush({ token: 'renovado', user: { id: 1, nombre: 'Admin', email: 'admin@test.com', rol: 'admin' } });
  });
});
