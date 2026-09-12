import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ExportService {
  /**
   * Genera y descarga un CSV desde un array de filas (cada fila es un array de celdas).
   */
  downloadCsv(rows: (string | number)[][], filename: string): void {
    const csv = rows
      .map(row => row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, filename.endsWith('.csv') ? filename : filename + '.csv');
  }

  /**
   * Genera y descarga un PDF simple desde HTML (usa print + iframe).
   * Acepta HTML de contenido; se envuelve en un documento con estilos profesionales.
   */
  downloadPdfFromHtml(html: string, filename: string): void {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${filename.replace(/\.pdf$/i, '')}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
              padding: 24px 32px 32px;
              color: #1a1d2e;
              font-size: 13px;
              line-height: 1.4;
            }
            .report-header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #1a1d2e; }
            .report-title { font-size: 22px; font-weight: 700; margin: 0 0 4px 0; letter-spacing: -0.02em; }
            .report-meta { font-size: 12px; color: #5c6370; margin: 0; }
            .report-summary {
              display: flex;
              flex-wrap: wrap;
              gap: 20px 32px;
              margin-bottom: 20px;
              padding: 14px 18px;
              background: #f4f5f8;
              border-radius: 8px;
              border: 1px solid #e2e6f0;
            }
            .report-summary-item { font-size: 12px; }
            .report-summary-item strong { display: block; font-size: 15px; color: #1a1d2e; margin-top: 2px; }
            .report-summary-item .label { color: #5c6370; text-transform: uppercase; letter-spacing: 0.04em; }
            table {
              border-collapse: collapse;
              width: 100%;
              font-size: 12px;
              margin-top: 8px;
            }
            thead { display: table-header-group; }
            th {
              background: #1a1d2e;
              color: #fff;
              font-weight: 600;
              text-align: left;
              padding: 10px 12px;
              border: 1px solid #1a1d2e;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }
            td {
              border: 1px solid #e2e6f0;
              padding: 9px 12px;
            }
            tbody tr:nth-child(even) { background: #fafbfc; }
            tbody tr:hover { background: #f4f5f8; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .num { font-variant-numeric: tabular-nums; font-family: 'Consolas', 'SF Mono', monospace; }
            .total-row { font-weight: 700; background: #f0f2f8 !important; border-top: 2px solid #1a1d2e; }
            .total-row td { padding: 10px 12px; }
            .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; text-transform: capitalize; }
            .badge-activo { background: #dbeafe; color: #1d4ed8; }
            .badge-pagado { background: #d1fae5; color: #047857; }
            .badge-parcial { background: #fef3c7; color: #92400e; }
            .badge-pendiente { background: #e2e8f0; color: #475569; }
            .badge-vencido { background: #fee2e2; color: #b91c1c; }
            .badge-cancelado { background: #e5e7eb; color: #4b5563; }
            .empty-msg { color: #5c6370; font-style: italic; text-align: center; padding: 24px !important; }
            .report-footer { margin-top: 20px; padding-top: 12px; border-top: 1px solid #e2e6f0; font-size: 11px; color: #5c6370; }

            /* ── Comprobante / recibo de pago ───────────────────── */
            .recibo-topbar { height: 5px; margin: -24px -32px 24px; background: linear-gradient(90deg, #5b9aff, #7c5cfc); }
            .recibo-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 16px; border-bottom: 1px solid #e2e6f0; margin-bottom: 20px; }
            .recibo-brand-row { display: flex; align-items: center; gap: 12px; }
            .recibo-mark { width: 40px; height: 40px; border-radius: 11px; background: linear-gradient(135deg, #5b9aff, #7c5cfc); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 800; flex-shrink: 0; box-shadow: 0 4px 10px rgba(91,154,255,0.35); }
            .recibo-brand { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #1a1d2e; }
            .recibo-sub { margin: 2px 0 0; font-size: 11px; color: #5c6370; text-transform: uppercase; letter-spacing: 0.08em; }
            .recibo-badge-wrap { text-align: right; }
            .recibo-badge { display: inline-flex; align-items: center; gap: 5px; background: #d1fae5; color: #047857; font-weight: 700; font-size: 11px; letter-spacing: 0.06em; padding: 5px 14px; border-radius: 20px; text-transform: uppercase; }
            .recibo-num { margin: 6px 0 0; font-size: 12px; color: #5c6370; font-family: 'Consolas', 'SF Mono', monospace; }
            .recibo-monto-row { display: flex; gap: 16px; margin-bottom: 16px; }
            .recibo-monto-box { flex: 1; background: linear-gradient(135deg, rgba(91,154,255,0.08), rgba(124,92,252,0.08)); border: 1px solid #d8e0f5; border-radius: 12px; padding: 14px 20px; text-align: center; }
            .recibo-monto-box.recibo-saldo-ok { background: linear-gradient(135deg, rgba(34,211,160,0.08), rgba(5,150,105,0.08)); border-color: #bfe9d9; }
            .recibo-monto-box.recibo-saldo-pendiente { background: linear-gradient(135deg, rgba(248,113,113,0.08), rgba(245,158,11,0.08)); border-color: #f6d3cf; }
            .recibo-monto-label { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #5c6370; margin-bottom: 4px; }
            .recibo-monto { font-size: 30px; font-weight: 800; color: #1a1d2e; font-family: 'Consolas', 'SF Mono', monospace; }
            .recibo-monto.recibo-monto-sm { font-size: 22px; }
            .recibo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-bottom: 4px; }
            .recibo-item { display: flex; flex-direction: column; gap: 2px; }
            .recibo-item .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #5c6370; }
            .recibo-item .val { font-size: 13px; font-weight: 600; color: #1a1d2e; }
            .recibo-qr-wrap { text-align: center; flex-shrink: 0; background: #fff; border: 1px solid #e2e6f0; border-radius: 12px; padding: 12px; }
            .recibo-qr-wrap .report-meta { max-width: 120px; }
            .recibo-resumen-pago { margin-top: 14px; background: #f4f5f8; border: 1px solid #e2e6f0; border-radius: 12px; padding: 12px 16px; }
            .recibo-resumen-titulo { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #1a1d2e; }
            .recibo-resumen-row { display: flex; gap: 16px; }
            .recibo-resumen-item { flex: 1; display: flex; flex-direction: column; gap: 2px; padding-left: 12px; border-left: 3px solid #d8e0f5; }
            .recibo-resumen-item .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #5c6370; }
            .recibo-resumen-item .val { font-size: 18px; font-weight: 800; color: #1a1d2e; font-family: 'Consolas', 'SF Mono', monospace; }
            .recibo-evidencia { margin-top: 14px; border: 1px solid #e2e6f0; border-radius: 12px; padding: 12px; break-inside: avoid; page-break-inside: avoid; }
            .recibo-evidencia-titulo { margin: 0 0 10px; font-size: 12px; font-weight: 700; color: #1a1d2e; }
            .recibo-evidencia-img { display: block; max-width: 260px; max-height: 420px; margin: 0 auto; border: 1px solid #e2e6f0; border-radius: 8px; }
            .recibo-thanks { font-size: 14px; font-weight: 700; color: #1a1d2e; margin: 0 0 6px; }
            .recibo-footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px dashed #d8e0f5; font-size: 11px; color: #5c6370; line-height: 1.6; }
            @page { margin: 14mm 12mm; }
            @media print {
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              body { padding: 16px 20px; }
              .recibo-topbar { margin: -16px -20px 20px; }
              thead { display: table-header-group; }
              tbody tr { break-inside: avoid; }
              .recibo-detalle-cuotas { break-inside: avoid; page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    doc.close();
    // Esperar a que el navegador termine de pintar el contenido, incluidas las imágenes
    // (QR en data URL y, si el pago es Yape/Plin, la captura del comprobante vía red)
    // antes de abrir el diálogo de impresión. Con timeout de seguridad por si alguna
    // imagen no carga (ej. archivo borrado del servidor).
    const imgs = Array.from(doc.images);
    const esperaImagenes = Promise.all(imgs.map(img => img.complete
      ? Promise.resolve()
      : new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true });
        img.addEventListener('error', () => resolve(), { once: true });
      })
    ));
    Promise.race([esperaImagenes, new Promise(resolve => setTimeout(resolve, 4000))]).then(() => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 200);
    });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
