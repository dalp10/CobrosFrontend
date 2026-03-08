import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Usuario } from '../models/index';

/** Respuesta posible del API: array directo o { data } */
interface UsuariosListResponse {
  data?: Usuario[];
}

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/usuarios`;

  /** Devuelve siempre un array de usuarios */
  getAll() {
    return this.http.get<Usuario[] | UsuariosListResponse>(this.url).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? []))
    );
  }
  getById(id: number) {
    return this.http.get<Usuario>(`${this.url}/${id}`);
  }
  create(data: Partial<Usuario> & { password: string }) {
    return this.http.post<Usuario>(this.url, data);
  }
  update(id: number, data: Partial<Pick<Usuario, 'nombre' | 'email' | 'rol' | 'activo'>>) {
    return this.http.put<Usuario>(`${this.url}/${id}`, data);
  }
  updatePassword(id: number, password_nuevo: string) {
    return this.http.put<unknown>(`${this.url}/${id}/password`, { password_nuevo });
  }
}
