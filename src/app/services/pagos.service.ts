import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Pago, PagoForm, PaginatedResponse, ResumenDashboard } from '../models/index';

export interface PagosFilter { deudor_id?: number; prestamo_id?: number; metodo?: string; desde?: string; hasta?: string; page?: number; limit?: number; }

@Injectable({ providedIn: 'root' })
export class PagosService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/pagos`;

  getAll(filters: PagosFilter = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => { if (v != null) params = params.set(k, String(v)); });
    return this.http.get<PaginatedResponse<Pago>>(this.url, { params });
  }
  getResumen() { return this.http.get<ResumenDashboard>(`${this.url}/resumen`); }
  create(form: PagoForm) {
    const fd = new FormData();
    (Object.entries(form) as [string, any][]).forEach(([k, v]) => { if (v == null) return; if (v instanceof File) fd.append('imagen', v); else fd.append(k, String(v)); });
    return this.http.post<Pago>(this.url, fd);
  }
  update(id: number, data: Partial<Pago>) { return this.http.put<Pago>(`${this.url}/${id}`, data); }
  delete(id: number) { return this.http.delete(`${this.url}/${id}`); }
}
