import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.css'
})
export class PagosComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  pagos: any[] = [];
  loading = true;
  filters = this.fb.group({ desde: [''], hasta: [''], metodo: [''] });

  get total(): number {
    return this.pagos.reduce((s, p) => s + +(p.monto || 0), 0);
  }

  ngOnInit(): void {
    this.buscar();
  }

  buscar(): void {
    this.loading = true;
    const v = this.filters.value as any;
    let params = new HttpParams().set('limit', '200');
    if (v.desde) params = params.set('desde', v.desde);
    if (v.hasta) params = params.set('hasta', v.hasta);
    if (v.metodo) params = params.set('metodo', v.metodo);
    this.http.get<any>(environment.apiUrl + '/pagos', { params }).subscribe({
      next: (r) => { this.pagos = r.data; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  limpiar(): void {
    this.filters.reset({ desde: '', hasta: '', metodo: '' });
    this.buscar();
  }

  exportExcel(): void {
    const rows: any[][] = [
      ['#', 'Fecha', 'Deudor', 'Concepto', 'Monto', 'Metodo', 'N Operacion']
    ];
    this.pagos.forEach((p: any, i: number) => {
      rows.push([
        i + 1,
        p.fecha_pago ? p.fecha_pago.split('T')[0] : '',
        p.deudor_nombre || '',
        p.concepto || '',
        +p.monto,
        p.metodo_pago,
        p.numero_operacion || ''
      ]);
    });
    const total = this.pagos.reduce((s: number, p: any) => s + +(p.monto || 0), 0);
    rows.push(['', '', '', 'TOTAL', total, '', '']);
    const csv = rows
      .map((r: any[]) => r.map((c: any) => '"' + String(c).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pagos_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  fmt(v: any): string {
    return (+(v ?? 0)).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}