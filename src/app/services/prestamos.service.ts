import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, tap, of, Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Prestamo, Cuota } from '../models/index';

/** Respuesta posible del API: array directo o { data, total?, page?, limit? } */
interface PrestamosListResponse {
  data?: Prestamo[];
  total?: number;
  page?: number;
  limit?: number;
}

const CACHE_TTL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class PrestamosService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/prestamos`;
  private cache: { key: string; data: Prestamo[]; at: number } | null = null;
  /** Misma instancia de observable por clave para que Layout + Prestamos (u otros) compartan 1 sola petición */
  private observableCache = new Map<string, { obs: Observable<Prestamo[]>; at: number }>();

  /** Devuelve siempre un array de préstamos. Cache 30 s por deudor_id. Una sola petición compartida por todos los suscriptores. */
  getAll(deudorId?: number): Observable<Prestamo[]> {
    const key = deudorId != null ? `id_${deudorId}` : 'all';
    const now = Date.now();
    if (this.cache && this.cache.key === key && now - this.cache.at < CACHE_TTL_MS)
      return of(this.cache.data);

    const cached = this.observableCache.get(key);
    if (cached && now - cached.at < CACHE_TTL_MS) return cached.obs;
    if (cached) this.observableCache.delete(key);

    const params = deudorId ? new HttpParams().set('deudor_id', String(deudorId)) : undefined;
    const obs = this.http.get<Prestamo[] | PrestamosListResponse>(this.url, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? [])),
      tap(data => { this.cache = { key, data, at: Date.now() }; }),
      shareReplay(1)
    );
    this.observableCache.set(key, { obs, at: now });
    return obs;
  }

  invalidateCache(): void {
    this.cache = null;
    this.observableCache.clear();
  }

  getById(id: number) { return this.http.get<Prestamo>(`${this.url}/${id}`); }
  getCuotas(id: number) { return this.http.get<Cuota[]>(`${this.url}/${id}/cuotas`); }
  create(data: Partial<Prestamo>) {
    return this.http.post<Prestamo>(this.url, data).pipe(
      tap(() => this.invalidateCache())
    );
  }
  updateEstado(id: number, estado: string) { return this.http.patch(`${this.url}/${id}/estado`, { estado }); }
  update(id: number, data: Partial<Prestamo>) {
    return this.http.patch<Prestamo>(`${this.url}/${id}`, data).pipe(
      tap(() => this.invalidateCache())
    );
  }
}
