import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrestamosService } from '../../services/prestamos.service';
import { ExportService } from '../../services/export.service';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Prestamo } from '../../models/index';
import { formatSoles, formatFecha } from '../../shared/utils/format';
import { withLoading } from '../../shared/utils/loading';

@Component({
  selector: 'app-prestamos',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, FormatNumberPipe, SkeletonComponent],
  templateUrl: './prestamos.component.html',
  styleUrl: './prestamos.component.css'
})
export class PrestamosComponent implements OnInit {
  private prestamosService = inject(PrestamosService);
  private exportService = inject(ExportService);
  private cdr = inject(ChangeDetectorRef);

  prestamos: Prestamo[] = [];
  loading = true;

  searchTerm = '';
  filtroEstado: 'todos' | 'activo' | 'vencido' | 'pagado' | 'cancelado' = 'todos';
  filtroTipo: string = '';

  sortBy: 'deudor' | 'tipo' | 'monto' | 'cobrado' | 'pendiente' | 'inicio' | 'estado' = 'inicio';
  sortDir: 'asc' | 'desc' = 'desc';

  readonly PAGE_SIZE = 15;
  prestamosVisible = this.PAGE_SIZE;

  get filtered(): Prestamo[] {
    let list = this.prestamos;
    const q = this.searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        (p.deudor_nombre || '').toLowerCase().includes(q) ||
        (p.descripcion || '').toLowerCase().includes(q) ||
        (p.tipo || '').toLowerCase().includes(q)
      );
    }
    if (this.filtroEstado !== 'todos') {
      list = list.filter(p => p.estado === this.filtroEstado);
    }
    if (this.filtroTipo) {
      list = list.filter(p => (p.tipo || '') === this.filtroTipo);
    }
    const dir = this.sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (this.sortBy) {
        case 'deudor': va = (a.deudor_nombre || ''); vb = (b.deudor_nombre || ''); return dir * String(va).localeCompare(String(vb));
        case 'tipo': va = (a.tipo || ''); vb = (b.tipo || ''); return dir * String(va).localeCompare(String(vb));
        case 'monto': va = +(a.monto_original ?? 0); vb = +(b.monto_original ?? 0); return dir * (va - vb);
        case 'cobrado': va = +(a.total_pagado ?? 0); vb = +(b.total_pagado ?? 0); return dir * (va - vb);
        case 'pendiente': va = +(a.saldo_pendiente ?? 0); vb = +(b.saldo_pendiente ?? 0); return dir * (va - vb);
        case 'inicio': va = (a.fecha_inicio || ''); vb = (b.fecha_inicio || ''); return dir * String(va).localeCompare(String(vb));
        case 'estado': va = (a.estado || ''); vb = (b.estado || ''); return dir * String(va).localeCompare(String(vb));
        default: return 0;
      }
    });
    return list;
  }

  get prestamosParaMostrar(): Prestamo[] {
    return this.filtered.slice(0, this.prestamosVisible);
  }

  get hayMasPrestamos(): boolean {
    return this.prestamosVisible < this.filtered.length;
  }

  get cantidadVerMas(): number {
    return Math.min(this.PAGE_SIZE, this.filtered.length - this.prestamosVisible);
  }

  formatoTipo(tipo: string | null | undefined): string {
    if (!tipo) return '—';
    const map: Record<string, string> = {
      prestamo_personal: 'Personal',
      prestamo_bancario: 'Bancario',
      pandero: 'Pandero',
      otro: 'Otro'
    };
    return map[tipo] || tipo.replace(/_/g, ' ');
  }

  verMasPrestamos(): void {
    this.prestamosVisible += this.PAGE_SIZE;
  }

  filtrar(): void { this.cdr.detectChanges(); }

  setSort(col: typeof this.sortBy): void {
    if (this.sortBy === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortBy = col; this.sortDir = 'asc'; }
    this.cdr.detectChanges();
  }

  get totalMontoOriginal(): number {
    return this.filtered.reduce((s, p) => s + +(p.monto_original ?? 0), 0);
  }

  get totalPendiente(): number {
    return this.filtered.reduce((s, p) => s + +(p.saldo_pendiente ?? 0), 0);
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.prestamosService.getAll().subscribe(withLoading(this.cdr, v => this.loading = v, {
      next: (p) => { this.prestamos = p; }
    }));
  }

  exportExcel(): void {
    const rows: (string | number)[][] = [
      ['Deudor', 'Tipo', 'Descripción', 'Monto', 'Cobrado', 'Pendiente', 'Inicio', 'Estado']
    ];
    this.filtered.forEach(p => {
      rows.push([
        p.deudor_nombre || '',
        p.tipo || '',
        p.descripcion || '',
        +(p.monto_original ?? 0),
        +(p.total_pagado ?? 0),
        +(p.saldo_pendiente ?? 0),
        p.fecha_inicio ? p.fecha_inicio.split('T')[0] : '',
        p.estado || ''
      ]);
    });
    rows.push(['', '', 'TOTAL', this.totalMontoOriginal, '', this.totalPendiente, '', '']);
    this.exportService.downloadCsv(rows, 'prestamos_' + new Date().toISOString().split('T')[0] + '.csv');
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.filtroEstado = 'todos';
    this.filtroTipo = '';
    this.prestamosVisible = this.PAGE_SIZE;
    this.filtrar();
  }

  exportPdf(): void {
    const fechaGen = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const filtros: string[] = [];
    if (this.filtroEstado !== 'todos') filtros.push('Estado: ' + this.filtroEstado);
    if (this.filtroTipo) filtros.push('Tipo: ' + this.formatoTipo(this.filtroTipo));
    if (this.searchTerm.trim()) filtros.push('Búsqueda: "' + this.searchTerm.trim() + '"');

    const thead = `
      <tr>
        <th>Deudor</th>
        <th>Tipo</th>
        <th>Descripción</th>
        <th class="text-right">Monto</th>
        <th class="text-right">Cobrado</th>
        <th class="text-right">Pendiente</th>
        <th>Inicio</th>
        <th class="text-center">Estado</th>
      </tr>`;

    const badgeClass = (estado: string) => 'badge badge-' + (estado || 'activo').toLowerCase();

    const tbody = this.filtered.map(p =>
      `<tr>
        <td>${(p.deudor_nombre || '—').replace(/</g, '&lt;')}</td>
        <td>${this.formatoTipo(p.tipo)}</td>
        <td>${(p.descripcion || '—').replace(/</g, '&lt;')}</td>
        <td class="text-right num">${formatSoles(p.monto_original ?? 0)}</td>
        <td class="text-right num">${formatSoles(p.total_pagado ?? 0)}</td>
        <td class="text-right num">${formatSoles(p.saldo_pendiente ?? 0)}</td>
        <td>${formatFecha(p.fecha_inicio)}</td>
        <td class="text-center"><span class="${badgeClass(p.estado || '')}">${(p.estado || '—').toLowerCase()}</span></td>
      </tr>`
    ).join('');

    const totalRow = `
      <tr class="total-row">
        <td colspan="3"><strong>Total (${this.filtered.length} préstamos)</strong></td>
        <td class="text-right num">${formatSoles(this.totalMontoOriginal)}</td>
        <td class="text-right num">—</td>
        <td class="text-right num">${formatSoles(this.totalPendiente)}</td>
        <td colspan="2"></td>
      </tr>`;

    const summaryHtml = `
      <div class="report-summary">
        <div class="report-summary-item">
          <span class="label">Cantidad</span>
          <strong>${this.filtered.length} préstamo${this.filtered.length !== 1 ? 's' : ''}</strong>
        </div>
        <div class="report-summary-item">
          <span class="label">Monto total</span>
          <strong>${formatSoles(this.totalMontoOriginal)}</strong>
        </div>
        <div class="report-summary-item">
          <span class="label">Pendiente por cobrar</span>
          <strong>${formatSoles(this.totalPendiente)}</strong>
        </div>
      </div>`;

    const filtrosHtml = filtros.length
      ? `<p class="report-meta" style="margin-top:8px"><strong>Filtros aplicados:</strong> ${filtros.join(' · ')}</p>`
      : '';

    const html = `
      <div class="report-header">
        <h1 class="report-title">Reporte de Préstamos</h1>
        <p class="report-meta">Generado el ${fechaGen}</p>
        ${filtrosHtml}
      </div>
      ${summaryHtml}
      <table>
        <thead>${thead}</thead>
        <tbody>
          ${tbody || '<tr><td colspan="8" class="empty-msg">No hay préstamos que coincidan con los criterios.</td></tr>'}
          ${tbody ? totalRow : ''}
        </tbody>
      </table>
      <div class="report-footer">
        Documento generado por DALP Cobros. Este reporte refleja los datos según los filtros aplicados al momento de la exportación.
      </div>`;

    const filename = 'reporte_prestamos_' + new Date().toISOString().split('T')[0] + '.pdf';
    this.exportService.downloadPdfFromHtml(html, filename);
  }
}
