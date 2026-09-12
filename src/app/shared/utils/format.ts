/** Formatea un monto con 2 decimales en formato es-PE (ej. 1,234.50). */
export function formatMonto(n: number | string | null | undefined): string {
  return (+(n ?? 0)).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Formatea un monto con el prefijo de moneda "S/ " (ej. S/ 1,234.50). */
export function formatSoles(n: number | string | null | undefined): string {
  return 'S/ ' + formatMonto(n);
}

/** Formatea una fecha ISO como dd/mm/aaaa, o "—" si no hay valor. */
export function formatFecha(s: string | null | undefined): string {
  return s ? new Date(s).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}
