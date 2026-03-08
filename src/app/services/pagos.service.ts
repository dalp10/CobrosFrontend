import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Pago, PagoForm, PaginatedResponse, ResumenDashboard } from '../models/index';

export interface PagosFilter { deudor_id?: number; prestamo_id?: number; metodo?: string; desde?: string; hasta?: string; page?: number; limit?: number; }

/** Respuesta cruda del API (puede venir en snake_case) */
interface ResumenApi {
  porDeudor?: ResumenDashboard['porDeudor'];
  por_deudor?: unknown[];
  porMetodo?: ResumenDashboard['porMetodo'];
  por_metodo?: unknown[];
  porMes?: ResumenDashboard['porMes'];
  por_mes?: unknown[];
  totales?: ResumenDashboard['totales'];
}

function normalizeResumen(r: ResumenApi): ResumenDashboard {
  const porDeudor = (r.porDeudor ?? r.por_deudor ?? []).map((d: any) => ({
    id: d.id,
    nombre: d.nombre,
    total_pagado: +d.total_pagado,
    total_prestado: +d.total_prestado,
    ultimo_pago: d.ultimo_pago ?? '',
    num_pagos: +d.num_pagos || 0,
  }));
  const porMetodo = (r.porMetodo ?? r.por_metodo ?? []).map((m: any) => ({
    metodo_pago: m.metodo_pago ?? m.metodo,
    cantidad: +m.cantidad,
    total: +m.total,
  }));
  const porMes = (r.porMes ?? r.por_mes ?? []).map((m: any) => ({
    mes: m.mes,
    total: +m.total,
    pagos: +m.pagos || 0,
  }));
  const totales = r.totales
    ? { total_cobrado: +r.totales.total_cobrado, total_prestado: +r.totales.total_prestado }
    : { total_cobrado: 0, total_prestado: 0 };
  return { porDeudor, porMetodo, porMes, totales };
}

@Injectable({ providedIn: 'root' })
export class PagosService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/pagos`;

  /** Cache del resumen: se invalida después de CACHE_TTL_MS o con getResumen(true) */
  private resumenCache: { data: ResumenDashboard; at: number } | null = null;
  private static readonly CACHE_TTL_MS = 45_000; // 45 segundos

  getAll(filters: PagosFilter = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => { if (v != null) params = params.set(k, String(v)); });
    return this.http.get<PaginatedResponse<Pago> | Pago[]>(this.url, { params }).pipe(
      map(res => {
        const data = Array.isArray(res) ? res : (res?.data ?? []);
        const total = Array.isArray(res) ? res.length : (res?.total ?? data.length);
        return { data, total, page: (res as any)?.page ?? 1, limit: (res as any)?.limit ?? data.length };
      })
    );
  }

  getResumen(forceRefresh = false): Observable<ResumenDashboard> {
    const now = Date.now();
    if (
      !forceRefresh &&
      this.resumenCache &&
      now - this.resumenCache.at < PagosService.CACHE_TTL_MS
    ) {
      return of(this.resumenCache.data);
    }
    return this.http.get<ResumenApi>(`${this.url}/resumen`).pipe(
      map(normalizeResumen),
      tap((data) => { this.resumenCache = { data, at: Date.now() }; })
    );
  }

  invalidateResumenCache(): void {
    this.resumenCache = null;
  }
  create(form: PagoForm | FormData) {
    const fd = form instanceof FormData ? form : this.buildFormData(form);
    return this.http.post<Pago>(this.url, fd);
  }
  private buildFormData(form: PagoForm): FormData {
    const fd = new FormData();
    (Object.entries(form) as [string, unknown][]).forEach(([k, v]) => {
      if (v == null) return;
      if (v instanceof File) fd.append('imagen', v);
      else fd.append(k, String(v));
    });
    return fd;
  }
  createWithFormData(fd: FormData) { return this.http.post<Pago>(this.url, fd); }
  update(id: number, data: Partial<Pago>) { return this.http.put<Pago>(`${this.url}/${id}`, data); }
  updateWithFormData(id: number, fd: FormData) { return this.http.put<Pago>(`${this.url}/${id}`, fd); }
  delete(id: number) { return this.http.delete(`${this.url}/${id}`); }
}
