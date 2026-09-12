import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Proyección de cobros esperados (cuotas pendientes/parciales) */
export interface ProyeccionCobros {
  porMes: { mes: string; total: number }[];
  dias_30: number;
  dias_60: number;
  dias_90: number;
}

/** Nivel de riesgo de mora de un deudor */
export type NivelRiesgo = 'bajo' | 'medio' | 'alto';

export interface RiesgoDeudor {
  deudor_id: number;
  nombre: string;
  apellidos: string;
  saldo_pendiente: number;
  nivel: NivelRiesgo;
  motivo: string;
}

export interface AnaliticaDashboard {
  proyeccion: ProyeccionCobros;
  riesgo: RiesgoDeudor[];
}

@Injectable({ providedIn: 'root' })
export class AnaliticaService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/analitica`;

  /** Proyección de cobros (30/60/90 días) y score de riesgo de mora por deudor */
  getDashboard(): Observable<AnaliticaDashboard> {
    return this.http.get<AnaliticaDashboard>(`${this.url}/dashboard`);
  }
}
