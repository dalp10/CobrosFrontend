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
  template: `
  <div class="page">
    <h1 class="title">Pagos</h1>
    <form [formGroup]="filters" (ngSubmit)="buscar()" class="filtros">
      <input type="date" formControlName="desde">
      <input type="date" formControlName="hasta">
      <select formControlName="metodo">
        <option value="">Todos</option>
        <option value="efectivo">Efectivo</option>
        <option value="yape">Yape</option>
        <option value="plin">Plin</option>
        <option value="transferencia">Transferencia</option>
        <option value="pandero">Pandero</option>
      </select>
      <button type="submit" class="btn">Filtrar</button>
      <button type="button" class="btn-excel" (click)="exportExcel()">📊 Excel</button>
      <button type="button" class="btn-clr" (click)="limpiar()">Limpiar</button>
    </form>
    @if (pagos.length) {
      <div class="totbar"><span>{{ pagos.length }} pagos</span><span class="tot">Total: S/ {{ fmt(total) }}</span></div>
    }
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (!loading) {
      <div class="twrap">
        <table>
          <thead><tr><th>#</th><th>Fecha</th><th>Deudor</th><th>Concepto</th><th>Monto</th><th>Metodo</th></tr></thead>
          <tbody>
            @for (p of pagos; track p.id; let i = $index) {
              <tr>
                <td class="mu">{{ i+1 }}</td>
                <td class="mo">{{ p.fecha_pago | date:"dd/MM/yyyy" }}</td>
                <td><a [routerLink]="['/deudores', p.deudor_id]" class="dlink">{{ p.deudor_nombre || '-' }}</a></td>
                <td>{{ p.concepto || '-' }}</td>
                <td class="amt mo">S/ {{ fmt(p.monto) }}</td>
                <td><span [class]="'mb m-'+p.metodo_pago">{{ p.metodo_pago }}</span></td>
              </tr>
            }
            @if (!pagos.length) { <tr><td colspan="6" class="empty">Sin pagos</td></tr> }
          </tbody>
        </table>
      </div>
    }
  </div>
  `,
  styles: [`.page{padding:24px;max-width:1200px}.title{font-size:1.35rem;font-weight:700;margin-bottom:18px}.filtros{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:center}input,select{background:#1e2230;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:7px 11px;font-size:.8rem;outline:none;font-family:inherit}.btn-excel{background:rgba(34,211,160,.15);color:#22d3a0;border:1px solid #22d3a0;border-radius:8px;padding:7px 13px;font-size:.8rem;cursor:pointer;font-family:inherit}
    .btn{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:8px;padding:7px 16px;font-size:.8rem;cursor:pointer;font-family:inherit}.btn-clr{background:none;border:1px solid #2e3450;color:#7a839e;border-radius:8px;padding:7px 12px;font-size:.8rem;cursor:pointer;font-family:inherit}.totbar{display:flex;justify-content:space-between;font-size:.8rem;color:#7a839e;margin-bottom:10px;padding:8px 12px;background:#1e2230;border-radius:8px;border:1px solid #2e3450}.tot{color:#22d3a0;font-family:monospace;font-weight:700}.empty{padding:30px;text-align:center;color:#7a839e}.twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.81rem}th{padding:9px 13px;text-align:left;font-size:.63rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}.amt{color:#22d3a0;font-weight:700}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}.dlink{color:#4f8ef7;text-decoration:none;font-weight:600}.mb{font-size:.63rem;padding:2px 7px;border-radius:10px;text-transform:capitalize}.m-yape{background:rgba(100,50,200,.2);color:#b388ff}.m-efectivo{background:rgba(34,211,160,.15);color:#22d3a0}.m-transferencia{background:rgba(79,142,247,.15);color:#4f8ef7}.m-plin{background:rgba(247,135,79,.15);color:#f7874f}.m-pandero{background:rgba(247,201,72,.15);color:#f7c948}`]
})
export class PagosComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  pagos: any[] = [];
  loading = true;
  filters = this.fb.group({ desde: [''], hasta: [''], metodo: [''] });
  get total(): number { return this.pagos.reduce((s,p) => s + +(p.monto||0), 0); }

  ngOnInit(): void { this.buscar(); }

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

  limpiar(): void { this.filters.reset({ desde:'', hasta:'', metodo:'' }); this.buscar(); }
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
    const csv = rows.map((r: any[]) => r.map((c: any) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pagos_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}