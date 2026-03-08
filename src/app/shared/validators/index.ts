import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Teléfono Perú: opcional; si tiene valor debe ser 9 dígitos empezando en 9, o 10 con 0, o 11 con 51 */
export function telefonoPeruOptional(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value;
    if (v == null || typeof v !== 'string') return null;
    const t = String(v).trim();
    if (t === '') return null;
    const digits = t.replace(/\D/g, '');
    if (digits.length === 9 && digits[0] === '9') return null;
    if (digits.length === 10 && digits[0] === '0') return null;
    if (digits.length === 11 && digits.startsWith('51')) return null;
    if (digits.length === 8) return null; // fijo
    return { telefonoPeru: { value: t } };
  };
}

/** Fecha no puede ser futura (YYYY-MM-DD) */
export function fechaNoFutura(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value;
    if (!v || typeof v !== 'string') return null;
    const hoy = new Date().toISOString().split('T')[0];
    return v > hoy ? { fechaFutura: { value: v } } : null;
  };
}

/** Monto máximo (evitar errores de tipeo) */
export function montoMax(max: number): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value;
    if (v == null || v === '') return null;
    const n = Number(v);
    if (isNaN(n)) return null;
    return n > max ? { montoMax: { max, actual: n } } : null;
  };
}

/** Para filtros: control "hasta" debe ser >= "desde" (nombre del control con la fecha desde) */
export function fechaHastaMin(desdeControlName: string): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const hasta = c.value;
    if (!hasta || typeof hasta !== 'string') return null;
    const form = c.parent;
    if (!form) return null;
    const desde = form.get(desdeControlName)?.value;
    if (!desde || typeof desde !== 'string') return null;
    return hasta < desde ? { fechaHastaMenor: { desde, hasta } } : null;
  };
}

/** Fecha fin debe ser >= fecha inicio (nombres de controles) */
export function fechaFinMin(inicioControlName: string): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const fin = c.value;
    if (!fin || typeof fin !== 'string') return null;
    const form = c.parent;
    if (!form) return null;
    const inicio = form.get(inicioControlName)?.value;
    if (!inicio || typeof inicio !== 'string') return null;
    return fin < inicio ? { fechaFinMenor: { inicio, fin } } : null;
  };
}

/** Tasa de interés entre 0 y 100 (opcional, pero si hay valor debe estar en rango) */
export function tasaInteresRango(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = c.value;
    if (v == null || v === '') return null;
    const n = Number(v);
    if (isNaN(n)) return null;
    return n < 0 || n > 100 ? { tasaInteresRango: { value: n } } : null;
  };
}
