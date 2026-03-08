import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrestamosService } from '../../services/prestamos.service';
import { ExportService } from '../../services/export.service';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Prestamo } from '../../models/index';

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
    this.prestamosService.getAll().subscribe({
      next: (p) => { this.prestamos = p; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
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
}
