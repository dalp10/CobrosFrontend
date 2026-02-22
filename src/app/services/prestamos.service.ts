import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Prestamo, Cuota } from '../models/index';

@Injectable({ providedIn: 'root' })
export class PrestamosService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/prestamos`;

  getAll(deudorId?: number) {
    const params = deudorId ? new HttpParams().set('deudor_id', String(deudorId)) : undefined;
    return this.http.get<Prestamo[]>(this.url, { params });
  }
  getById(id: number) { return this.http.get<Prestamo>(`${this.url}/${id}`); }
  getCuotas(id: number) { return this.http.get<Cuota[]>(`${this.url}/${id}/cuotas`); }
  create(data: Partial<Prestamo>) { return this.http.post<Prestamo>(this.url, data); }
  updateEstado(id: number, estado: string) { return this.http.patch(`${this.url}/${id}/estado`, { estado }); }
}
