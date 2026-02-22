import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Deudor } from '../models/index';

@Injectable({ providedIn: 'root' })
export class DeudoresService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/deudores`;

  getAll() { return this.http.get<Deudor[]>(this.url); }
  getById(id: number) { return this.http.get<Deudor>(`${this.url}/${id}`); }
  create(data: Partial<Deudor>) { return this.http.post<Deudor>(this.url, data); }
  update(id: number, data: Partial<Deudor>) { return this.http.put<Deudor>(`${this.url}/${id}`, data); }
  delete(id: number) { return this.http.delete(`${this.url}/${id}`); }
}
