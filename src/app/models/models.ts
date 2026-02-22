// src/app/models/index.ts

export interface Deudor {
  id: number;
  nombre: string;
  apellidos: string;
  dni?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  notas?: string;
  activo: boolean;
  created_at: string;
  // Calculados desde JOIN
  total_pagado?: number;
  total_prestado?: number;
  saldo_pendiente?: number;
  total_prestamos?: number;
  ultimo_pago?: string;
  prestamos?: Prestamo[];
  pagos?: Pago[];
}

export interface Prestamo {
  id: number;
  deudor_id: number;
  deudor_nombre?: string;
  tipo: 'prestamo_personal' | 'prestamo_bancario' | 'pandero' | 'otro';
  descripcion?: string;
  monto_original: number;
  tasa_interes: number;
  total_cuotas: number;
  cuota_mensual?: number;
  fecha_inicio: string;
  fecha_fin?: string;
  estado: 'activo' | 'pagado' | 'vencido' | 'cancelado';
  banco?: string;
  numero_operacion?: string;
  notas?: string;
  created_at: string;
  // Calculados
  total_pagado?: number;
  saldo_pendiente?: number;
  cuotas_pagadas?: number;
  cuotas_pendientes?: number;
  cuotas?: Cuota[];
  pagos?: Pago[];
}

export interface Cuota {
  id: number;
  prestamo_id: number;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_esperado: number;
  monto_pagado: number;
  estado: 'pendiente' | 'pagado' | 'parcial' | 'vencido';
  es_premio_pandero: boolean;
  monto_premio?: number;
}

export type MetodoPago = 'efectivo' | 'yape' | 'plin' | 'transferencia' | 'pandero' | 'otro';

export interface Pago {
  id: number;
  deudor_id: number;
  deudor_nombre?: string;
  prestamo_id?: number;
  prestamo_desc?: string;
  cuota_id?: number;
  fecha_pago: string;
  monto: number;
  metodo_pago: MetodoPago;
  numero_operacion?: string;
  banco_origen?: string;
  concepto?: string;
  notas?: string;
  imagen_url?: string;
  imagen_nombre?: string;
  created_at: string;
}

export interface PagoForm {
  deudor_id: number;
  prestamo_id?: number;
  cuota_id?: number;
  fecha_pago: string;
  monto: number;
  metodo_pago: MetodoPago;
  numero_operacion?: string;
  banco_origen?: string;
  concepto?: string;
  notas?: string;
  imagen?: File;
}

export interface ResumenDashboard {
  porDeudor: {
    id: number; nombre: string;
    total_pagado: number; total_prestado: number;
    ultimo_pago: string; num_pagos: number;
  }[];
  porMetodo: { metodo_pago: MetodoPago; cantidad: number; total: number }[];
  porMes: { mes: string; total: number; pagos: number }[];
  totales: { total_cobrado: number; total_prestado: number };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
