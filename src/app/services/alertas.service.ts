import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface EnviarWhatsAppBody {
  /** Número de teléfono (ej. 981844013). Opcional si se envía deudor_id. */
  telefono?: string;
  /** ID del deudor; se usará su teléfono registrado. Opcional si se envía telefono. */
  deudor_id?: number;
  /** Texto del mensaje. Opcional; por defecto el backend envía un recordatorio genérico. */
  mensaje?: string;
}

export interface EnviarWhatsAppResponse {
  ok: boolean;
  sid?: string;
  mensaje?: string;
}

/** Una cuota vencida (pendiente/parcial con fecha de vencimiento pasada) */
export interface CuotaEnMora {
  cuota_id: number;
  prestamo_id: number;
  prestamo_desc?: string;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_esperado: number;
  monto_pagado: number;
  saldo: number;
  dias_vencido: number;
}

/** Cuotas en mora agrupadas por deudor */
export interface MoraDeudor {
  deudor_id: number;
  nombre: string;
  apellidos: string;
  telefono?: string;
  total_mora: number;
  cuotas: CuotaEnMora[];
}

/** Una cuota próxima a vencer */
export interface CuotaProxima {
  cuota_id: number;
  prestamo_id: number;
  prestamo_desc?: string;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_esperado: number;
  monto_pagado: number;
  saldo: number;
  dias_para_vencer: number;
}

/** Cuotas próximas a vencer agrupadas por deudor */
export interface ProximaDeudor {
  deudor_id: number;
  nombre: string;
  apellidos: string;
  telefono?: string;
  total: number;
  cuotas: CuotaProxima[];
}

@Injectable({ providedIn: 'root' })
export class AlertasService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/alertas`;

  /**
   * Envía un mensaje por WhatsApp vía el backend (Twilio).
   * Indica solo telefono o solo deudor_id.
   */
  enviarWhatsApp(body: EnviarWhatsAppBody): Observable<EnviarWhatsAppResponse> {
    return this.http.post<EnviarWhatsAppResponse>(`${this.url}/whatsapp`, body);
  }

  /** Cuotas vencidas (pendientes/parciales con fecha pasada) agrupadas por deudor */
  getMora(): Observable<MoraDeudor[]> {
    return this.http.get<MoraDeudor[]>(`${this.url}/mora`);
  }

  /** Cuotas pendientes/parciales que vencen dentro de los próximos `dias` días, agrupadas por deudor */
  getProximas(dias = 3): Observable<ProximaDeudor[]> {
    return this.http.get<ProximaDeudor[]>(`${this.url}/proximas`, { params: { dias } });
  }
}
