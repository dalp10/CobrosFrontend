import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, firstValueFrom } from 'rxjs';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { vi } from 'vitest';

describe('authGuard', () => {
  const navigate = vi.fn();
  const tryRestoreSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { navigate } },
        { provide: AuthService, useValue: { tryRestoreSession } },
      ],
    });
  });

  it('debe redirigir a /login si no hay token y no se puede restaurar la sesión', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    tryRestoreSession.mockReturnValue(of(false));
    const result = TestBed.runInInjectionContext(() => authGuard({} as any, {} as any));
    const value = await firstValueFrom(result as any);
    expect(value).toBe(false);
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
