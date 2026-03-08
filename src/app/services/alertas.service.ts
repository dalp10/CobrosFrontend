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
}
