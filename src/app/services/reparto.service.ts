import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RepartoMiembro {
  id: number;
  nombre: string;
  cargo_adicional_mensual?: number;
  total_pagado_servicios: number;
  cuota_que_le_toca: number;
  te_deben: number;
  reembolsos_recibidos: number;
  reembolsos_dados: number;
  saldo: number;
  al_dia: boolean;
}

export interface RepartoGasto {
  id: number;
  concepto: string;
  monto_total: number;
  fecha: string;
  pagado_por_id: number;
  pagado_por_nombre?: string;
  notas?: string;
  categoria_id?: number | null;
  categoria_nombre?: string | null;
  categoria_color?: string | null;
  recurrente?: boolean;
  participantes?: GastoParticipante[];
  medio_pago?: string | null;
}

export interface RepartoReembolso {
  id: number;
  de_miembro_id: number;
  para_miembro_id: number;
  monto: number;
  fecha: string;
  concepto?: string;
  de_nombre?: string;
  para_nombre?: string;
  gasto_id?: number | null;
  medio_pago?: string | null;
}

export interface SugerenciaReembolso {
  de_id: number;
  de_nombre: string;
  para_id: number;
  para_nombre: string;
  monto: number;
}

export interface RepartoResumen {
  miembros: RepartoMiembro[];
  gastos: RepartoGasto[];
  reembolsos: RepartoReembolso[];
  total_gastos: number;
  cuota_por_persona: number;
  resumen_por_mes?: ResumenPorMesItem[];
  desde?: string | null;
  hasta?: string | null;
  categorias?: RepartoCategoria[];
  sugerencias_reembolso?: SugerenciaReembolso[];
  desglose_por_categoria?: { nombre: string; total: number }[];
}

export interface ResumenPorMesItem {
  mes: string;
  total: number;
  cuota_por_persona: number;
  cuotas: { id: number; nombre: string; cuota: number }[];
}

export interface RepartoMiembroSimple {
  id: number;
  nombre: string;
  cargo_adicional_mensual?: number;
}

export interface RepartoCategoria {
  id: number;
  nombre: string;
  color?: string;
}

export interface RepartoGrupo {
  id: number;
  nombre: string;
}

export interface RepartoPresupuesto {
  id: number;
  reparto_id?: number;
  anno: number;
  mes: number;
  monto_techo: number;
}

export interface RepartoPendientes {
  miembros_que_deben: { id: number; nombre: string; saldo: number }[];
  gastos_sin_reembolso: { id: number; concepto: string; monto_total: number; fecha: string; pagado_por_nombre: string }[];
}

export interface RepartoAdjunto {
  id: number;
  gasto_id: number;
  nombre_archivo: string;
  ruta: string;
  content_type: string;
  created_at: string;
}

export interface RepartoReembolsoAdjunto {
  id: number;
  reembolso_id: number;
  nombre_archivo: string;
  ruta: string;
  content_type: string;
  created_at: string;
}

export const MEDIOS_PAGO = [
  { value: '', label: 'Sin especificar' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'plin', label: 'Plin' },
  { value: 'transferencia', label: 'Transferencia' },
] as const;

export interface GastoParticipante {
  miembro_id: number;
  peso: number;
}

@Injectable({ providedIn: 'root' })
export class RepartoService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/reparto`;

  getResumen(desde?: string, hasta?: string, repartoId?: number, miembroId?: number): Observable<RepartoResumen> {
    const params = new URLSearchParams();
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (repartoId != null) params.set('reparto_id', String(repartoId));
    if (miembroId != null) params.set('miembro_id', String(miembroId));
    const q = params.toString();
    return this.http.get<RepartoResumen>(`${this.url}/resumen${q ? '?' + q : ''}`);
  }

  getMiembros(repartoId?: number): Observable<RepartoMiembroSimple[]> {
    const url = repartoId != null ? `${this.url}/miembros?reparto_id=${repartoId}` : `${this.url}/miembros`;
    return this.http.get<RepartoMiembroSimple[]>(url);
  }

  createMiembro(body: { nombre: string; cargo_adicional_mensual?: number; reparto_id?: number }): Observable<RepartoMiembroSimple> {
    return this.http.post<RepartoMiembroSimple>(`${this.url}/miembros`, body);
  }

  createGasto(body: {
    concepto: string;
    monto_total: number;
    fecha?: string;
    pagado_por_id: number;
    notas?: string;
    categoria_id?: number | null;
    reparto_id?: number;
    medio_pago?: string | null;
    participantes?: GastoParticipante[];
  }): Observable<RepartoGasto> {
    return this.http.post<RepartoGasto>(`${this.url}/gastos`, body);
  }

  updateGasto(id: number, body: Partial<{
    concepto: string;
    monto_total: number;
    fecha: string;
    pagado_por_id: number;
    notas: string;
    categoria_id: number | null;
    medio_pago: string | null;
    participantes: GastoParticipante[];
  }>): Observable<RepartoGasto> {
    return this.http.put<RepartoGasto>(`${this.url}/gastos/${id}`, body);
  }

  deleteGasto(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/gastos/${id}`);
  }

  createReembolso(body: {
    de_miembro_id: number;
    para_miembro_id: number;
    monto: number;
    fecha?: string;
    concepto?: string;
    notas?: string;
    gasto_id?: number | null;
    reparto_id?: number;
    medio_pago?: string | null;
  }): Observable<RepartoReembolso> {
    return this.http.post<RepartoReembolso>(`${this.url}/reembolsos`, body);
  }

  updateReembolso(id: number, body: Partial<{
    de_miembro_id: number;
    para_miembro_id: number;
    monto: number;
    fecha: string;
    concepto: string;
    notas: string;
    gasto_id: number | null;
    medio_pago: string | null;
  }>): Observable<RepartoReembolso> {
    return this.http.put<RepartoReembolso>(`${this.url}/reembolsos/${id}`, body);
  }

  deleteReembolso(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/reembolsos/${id}`);
  }

  updateMiembro(id: number, cargo_adicional_mensual: number): Observable<RepartoMiembroSimple> {
    return this.http.put<RepartoMiembroSimple>(`${this.url}/miembros/${id}`, { cargo_adicional_mensual });
  }

  deleteMiembro(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/miembros/${id}`);
  }

  exportarReporte(desde?: string, hasta?: string, formato: 'csv' | 'xlsx' = 'csv', repartoId?: number): Observable<Blob> {
    const params = new URLSearchParams();
    params.set('formato', formato);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    if (repartoId != null) params.set('reparto_id', String(repartoId));
    return this.http.get(`${this.url}/reportes/exportar?${params}`, { responseType: 'blob' });
  }

  getCategorias(repartoId?: number): Observable<RepartoCategoria[]> {
    const url = repartoId != null ? `${this.url}/categorias?reparto_id=${repartoId}` : `${this.url}/categorias`;
    return this.http.get<RepartoCategoria[]>(url);
  }

  createCategoria(body: { nombre: string; color?: string; reparto_id?: number }): Observable<RepartoCategoria> {
    return this.http.post<RepartoCategoria>(`${this.url}/categorias`, body);
  }

  updateCategoria(id: number, body: { nombre?: string; color?: string }): Observable<RepartoCategoria> {
    return this.http.put<RepartoCategoria>(`${this.url}/categorias/${id}`, body);
  }

  deleteCategoria(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/categorias/${id}`);
  }

  getPendientes(repartoId?: number): Observable<RepartoPendientes> {
    const url = repartoId != null ? `${this.url}/pendientes?reparto_id=${repartoId}` : `${this.url}/pendientes`;
    return this.http.get<RepartoPendientes>(url);
  }

  getPresupuestos(repartoId?: number, anno?: number, mes?: number): Observable<RepartoPresupuesto[]> {
    const params = new URLSearchParams();
    if (repartoId != null) params.set('reparto_id', String(repartoId));
    if (anno != null) params.set('anno', String(anno));
    if (mes != null) params.set('mes', String(mes));
    const q = params.toString();
    return this.http.get<RepartoPresupuesto[]>(`${this.url}/presupuestos${q ? '?' + q : ''}`);
  }

  createPresupuesto(body: { anno: number; mes: number; monto_techo: number; reparto_id?: number }): Observable<RepartoPresupuesto> {
    return this.http.post<RepartoPresupuesto>(`${this.url}/presupuestos`, body);
  }

  updatePresupuesto(id: number, monto_techo: number): Observable<RepartoPresupuesto> {
    return this.http.put<RepartoPresupuesto>(`${this.url}/presupuestos/${id}`, { monto_techo });
  }

  deletePresupuesto(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/presupuestos/${id}`);
  }

  repetirGastoMes(gastoId: number): Observable<RepartoGasto> {
    return this.http.post<RepartoGasto>(`${this.url}/gastos/${gastoId}/repetir-mes`, {});
  }

  getAdjuntos(gastoId: number): Observable<RepartoAdjunto[]> {
    return this.http.get<RepartoAdjunto[]>(`${this.url}/gastos/${gastoId}/adjuntos`);
  }

  uploadAdjunto(gastoId: number, file: File): Observable<RepartoAdjunto> {
    const form = new FormData();
    form.append('archivo', file);
    return this.http.post<RepartoAdjunto>(`${this.url}/gastos/${gastoId}/adjuntos`, form);
  }

  deleteAdjunto(adjuntoId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/adjuntos/${adjuntoId}`);
  }

  getAdjuntoDescarga(adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.url}/adjuntos/${adjuntoId}/descargar`, { responseType: 'blob' });
  }

  getAdjuntosReembolso(reembolsoId: number): Observable<RepartoReembolsoAdjunto[]> {
    return this.http.get<RepartoReembolsoAdjunto[]>(`${this.url}/reembolsos/${reembolsoId}/adjuntos`);
  }

  uploadAdjuntoReembolso(reembolsoId: number, file: File): Observable<RepartoReembolsoAdjunto> {
    const form = new FormData();
    form.append('archivo', file);
    return this.http.post<RepartoReembolsoAdjunto>(`${this.url}/reembolsos/${reembolsoId}/adjuntos`, form);
  }

  deleteAdjuntoReembolso(adjuntoId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/reembolso-adjuntos/${adjuntoId}`);
  }

  getAdjuntoReembolsoDescarga(adjuntoId: number): Observable<Blob> {
    return this.http.get(`${this.url}/reembolso-adjuntos/${adjuntoId}/descargar`, { responseType: 'blob' });
  }

  getGrupos(): Observable<RepartoGrupo[]> {
    return this.http.get<RepartoGrupo[]>(`${this.url}/grupos`);
  }

  createGrupo(nombre: string): Observable<RepartoGrupo> {
    return this.http.post<RepartoGrupo>(`${this.url}/grupos`, { nombre });
  }
}
