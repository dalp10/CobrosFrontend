import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { Usuario, PaginatedResponse } from '../models/index';

const CACHE_TTL_MS = 30_000; // 30 s

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/usuarios`;
  private cache: { data: Usuario[]; at: number } | null = null;

  /** Devuelve siempre un array de usuarios. Cache 30 s. */
  getAll(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.cache && now - this.cache.at < CACHE_TTL_MS)
      return of(this.cache.data);
    return this.http.get<Usuario[] | PaginatedResponse<Usuario>>(this.url).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? [])),
      tap(data => { this.cache = { data, at: Date.now() }; })
    );
  }

  invalidateCache(): void { this.cache = null; }

  getById(id: number) {
    return this.http.get<Usuario>(`${this.url}/${id}`);
  }
  create(data: Partial<Usuario> & { password: string }) {
    return this.http.post<Usuario>(this.url, data).pipe(
      tap(() => this.invalidateCache())
    );
  }
  update(id: number, data: Partial<Pick<Usuario, 'nombre' | 'email' | 'rol' | 'activo'>>) {
    return this.http.put<Usuario>(`${this.url}/${id}`, data).pipe(
      tap(() => this.invalidateCache())
    );
  }
  updatePassword(id: number, password_nuevo: string) {
    return this.http.put<unknown>(`${this.url}/${id}/password`, { password_nuevo });
  }
}
