import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, tap, of } from 'rxjs';
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

  /** Devuelve siempre un array de préstamos. Cache 30 s por deudor_id. */
  getAll(deudorId?: number) {
    const key = deudorId != null ? `id_${deudorId}` : 'all';
    const now = Date.now();
    if (this.cache && this.cache.key === key && now - this.cache.at < CACHE_TTL_MS)
      return of(this.cache.data);
    const params = deudorId ? new HttpParams().set('deudor_id', String(deudorId)) : undefined;
    return this.http.get<Prestamo[] | PrestamosListResponse>(this.url, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? [])),
      tap(data => { this.cache = { key, data, at: Date.now() }; })
    );
  }

  invalidateCache(): void { this.cache = null; }

  getById(id: number) { return this.http.get<Prestamo>(`${this.url}/${id}`); }
  getCuotas(id: number) { return this.http.get<Cuota[]>(`${this.url}/${id}/cuotas`); }
  create(data: Partial<Prestamo>) {
    return this.http.post<Prestamo>(this.url, data).pipe(
      tap(() => this.invalidateCache())
    );
  }
  updateEstado(id: number, estado: string) { return this.http.patch(`${this.url}/${id}/estado`, { estado }); }
}
