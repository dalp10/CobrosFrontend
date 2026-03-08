import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, tap, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { Deudor } from '../models/index';

/** Respuesta paginada de GET /deudores */
export interface DeudoresListResponse {
  data: Deudor[];
  total?: number;
  page?: number;
  limit?: number;
}

const CACHE_TTL_MS = 30_000; // 30 s

@Injectable({ providedIn: 'root' })
export class DeudoresService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/deudores`;
  private cache: { data: Deudor[]; at: number } | null = null;

  /** Devuelve siempre un array de deudores (extrae .data si la API devuelve { data, total, page, limit }). Cache 30 s. */
  getAll(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.cache && now - this.cache.at < CACHE_TTL_MS)
      return of(this.cache.data);
    return this.http.get<DeudoresListResponse | Deudor[]>(this.url).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? [])),
      tap(data => { this.cache = { data, at: Date.now() }; })
    );
  }

  invalidateCache(): void { this.cache = null; }

  getById(id: number) { return this.http.get<Deudor>(`${this.url}/${id}`); }
  create(data: Partial<Deudor>) {
    return this.http.post<Deudor>(this.url, data).pipe(
      tap(() => this.invalidateCache())
    );
  }
  update(id: number, data: Partial<Deudor>) {
    return this.http.put<Deudor>(`${this.url}/${id}`, data).pipe(
      tap(() => this.invalidateCache())
    );
  }
  delete(id: number) {
    return this.http.delete(`${this.url}/${id}`).pipe(
      tap(() => this.invalidateCache())
    );
  }
}
