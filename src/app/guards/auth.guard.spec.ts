import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { vi } from 'vitest';

describe('authGuard', () => {
  const navigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { navigate } }],
    });
  });

  it('debe redirigir a /login si no hay token', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(result).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('debe permitir acceso si hay token válido no expirado', () => {
    const payload = btoa(JSON.stringify({ exp: 9999999999 }));
    const token = `header.${payload}.sig`;
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(token);
    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    expect(result).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
