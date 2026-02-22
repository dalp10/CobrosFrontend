const fs = require('fs');

// DASHBOARD
const dashboard = `import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: \`
  <div class="page">
    <h1 class="title">Dashboard</h1>
    @if (loading) { <div class="empty">Cargando datos...</div> }
    @if (data && !loading) {
      <div class="stats">
        <div class="scard"><span class="slbl">Cobrado</span><span class="sval green">S/ {{ fmt(data.totales.total_cobrado) }}</span></div>
        <div class="scard"><span class="slbl">Prestado</span><span class="sval blue">S/ {{ fmt(data.totales.total_prestado) }}</span></div>
        <div class="scard"><span class="slbl">Pendiente</span><span class="sval red">S/ {{ fmt(data.totales.total_prestado - data.totales.total_cobrado) }}</span></div>
      </div>
      <div class="cols">
        <div class="card">
          <h2 class="ctitle">Por deudor</h2>
          @for (d of data.porDeudor; track d.id) {
            <div class="drow">
              <div>
                <a [routerLink]="['/deudores', d.id]" class="dname">{{ d.nombre }}</a>
                <span class="dmeta">Ultimo: {{ d.ultimo_pago ? (d.ultimo_pago | date:"dd/MM/yyyy") : "Sin pagos" }}</span>
              </div>
              <div class="dright">
                <span class="dpaid">S/ {{ fmt(d.total_pagado) }}</span>
                <div class="bar"><div class="fill" [style.width.%]="pct(d.total_pagado, d.total_prestado)"></div></div>
              </div>
            </div>
          }
        </div>
        <div class="card">
          <h2 class="ctitle">Por metodo</h2>
          @for (m of data.porMetodo; track m.metodo_pago) {
            <div class="drow">
              <span [class]="'mbadge m-'+m.metodo_pago">{{ m.metodo_pago }}</span>
              <span class="mcount">{{ m.cantidad }} pagos</span>
              <span class="dpaid">S/ {{ fmt(m.total) }}</span>
            </div>
          }
        </div>
      </div>
      @if (data.porMes.length) {
        <div class="card mt">
          <h2 class="ctitle">Cobros ultimos 12 meses</h2>
          <div class="chart">
            @for (m of data.porMes; track m.mes) {
              <div class="bwrap">
                <div class="bcont"><div class="bbar" [style.height.%]="barH(m.total)" [title]="'S/ '+fmt(m.total)"></div></div>
                <span class="blbl">{{ m.mes.substring(5,7) }}/{{ m.mes.substring(2,4) }}</span>
              </div>
            }
          </div>
        </div>
      }
    }
  </div>
  \`,
  styles: [\`.page{padding:24px;max-width:1200px}.title{font-size:1.4rem;font-weight:700;margin-bottom:20px}.empty{padding:40px;text-align:center;color:#7a839e}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:20px}.scard{background:#1e2230;border:1px solid #2e3450;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:4px}.slbl{font-size:.68rem;color:#7a839e;text-transform:uppercase}.sval{font-size:1.2rem;font-weight:700;font-family:monospace}.green{color:#22d3a0}.blue{color:#4f8ef7}.red{color:#f75f5f}.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{background:#1e2230;border:1px solid #2e3450;border-radius:12px;padding:16px;margin-bottom:14px}.ctitle{font-size:.85rem;font-weight:600;margin-bottom:10px}.mt{margin-top:14px}.drow{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #2e3450}.dname{color:#4f8ef7;text-decoration:none;font-weight:600;font-size:.83rem}.dmeta{font-size:.65rem;color:#7a839e;display:block}.dright{display:flex;flex-direction:column;align-items:flex-end}.dpaid{color:#22d3a0;font-family:monospace;font-size:.8rem}.bar{width:80px;height:4px;background:#2e3450;border-radius:2px;margin-top:4px}.fill{height:100%;background:#22d3a0;border-radius:2px}.mbadge{font-size:.63rem;padding:2px 7px;border-radius:10px;text-transform:capitalize}.m-yape{background:rgba(100,50,200,.2);color:#b388ff}.m-efectivo{background:rgba(34,211,160,.15);color:#22d3a0}.m-transferencia{background:rgba(79,142,247,.15);color:#4f8ef7}.m-plin{background:rgba(247,135,79,.15);color:#f7874f}.m-pandero{background:rgba(247,201,72,.15);color:#f7c948}.mcount{font-size:.72rem;color:#7a839e;margin-left:auto;margin-right:8px}.chart{display:flex;gap:4px;align-items:flex-end;height:90px}.bwrap{flex:1;display:flex;flex-direction:column;align-items:center}.bcont{flex:1;display:flex;align-items:flex-end;width:100%}.bbar{width:100%;background:linear-gradient(180deg,#4f8ef7,#7c5cfc);border-radius:3px 3px 0 0;min-height:3px}.blbl{font-size:.55rem;color:#7a839e;margin-top:3px}\`]
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  data: any;
  loading = true;
  private maxMes = 1;

  ngOnInit(): void {
    this.http.get<any>(environment.apiUrl + '/pagos/resumen').subscribe({
      next: (r) => {
        this.data = {
          porDeudor: r.porDeudor.map((d: any) => ({ ...d, total_pagado: +d.total_pagado, total_prestado: +d.total_prestado })),
          porMetodo: r.porMetodo.map((m: any) => ({ ...m, cantidad: +m.cantidad, total: +m.total })),
          porMes: r.porMes.map((m: any) => ({ ...m, total: +m.total })),
          totales: { total_cobrado: +r.totales.total_cobrado, total_prestado: +r.totales.total_prestado },
        };
        this.maxMes = Math.max(...this.data.porMes.map((m: any) => m.total), 1);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (e) => { console.error(e); this.loading = false; this.cdr.detectChanges(); }
    });
  }

  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  pct(paid: any, total: any): number { return total ? Math.min(100,(+(paid||0)/+total)*100) : 0; }
  barH(val: any): number { return (+val / this.maxMes) * 100; }
}`;
fs.writeFileSync('src/app/pages/dashboard/dashboard.component.ts', dashboard, 'utf8');
console.log('Dashboard OK');

// PAGOS
const pagos = `import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  template: \`
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
  \`,
  styles: [\`.page{padding:24px;max-width:1200px}.title{font-size:1.35rem;font-weight:700;margin-bottom:18px}.filtros{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:center}input,select{background:#1e2230;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:7px 11px;font-size:.8rem;outline:none;font-family:inherit}.btn{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:8px;padding:7px 16px;font-size:.8rem;cursor:pointer;font-family:inherit}.btn-clr{background:none;border:1px solid #2e3450;color:#7a839e;border-radius:8px;padding:7px 12px;font-size:.8rem;cursor:pointer;font-family:inherit}.totbar{display:flex;justify-content:space-between;font-size:.8rem;color:#7a839e;margin-bottom:10px;padding:8px 12px;background:#1e2230;border-radius:8px;border:1px solid #2e3450}.tot{color:#22d3a0;font-family:monospace;font-weight:700}.empty{padding:30px;text-align:center;color:#7a839e}.twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.81rem}th{padding:9px 13px;text-align:left;font-size:.63rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}.amt{color:#22d3a0;font-weight:700}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}.dlink{color:#4f8ef7;text-decoration:none;font-weight:600}.mb{font-size:.63rem;padding:2px 7px;border-radius:10px;text-transform:capitalize}.m-yape{background:rgba(100,50,200,.2);color:#b388ff}.m-efectivo{background:rgba(34,211,160,.15);color:#22d3a0}.m-transferencia{background:rgba(79,142,247,.15);color:#4f8ef7}.m-plin{background:rgba(247,135,79,.15);color:#f7874f}.m-pandero{background:rgba(247,201,72,.15);color:#f7c948}\`]
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
  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}`;
fs.writeFileSync('src/app/pages/pagos/pagos.component.ts', pagos, 'utf8');
console.log('Pagos OK');

// PRESTAMOS
const prestamos = `import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-prestamos',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: \`
  <div class="page">
    <h1 class="title">Prestamos</h1>
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (!loading) {
      <div class="twrap">
        <table>
          <thead><tr><th>Deudor</th><th>Tipo</th><th>Monto</th><th>Cobrado</th><th>Pendiente</th><th>Inicio</th><th>Estado</th></tr></thead>
          <tbody>
            @for (p of prestamos; track p.id) {
              <tr>
                <td><a [routerLink]="['/deudores', p.deudor_id]" class="dlink">{{ p.deudor_nombre }}</a></td>
                <td>{{ p.tipo }}</td>
                <td class="amt mo">S/ {{ fmt(p.monto_original) }}</td>
                <td class="mo g">S/ {{ fmt(p.total_pagado) }}</td>
                <td class="mo r">S/ {{ fmt(p.saldo_pendiente) }}</td>
                <td class="mo mu">{{ p.fecha_inicio | date:"dd/MM/yyyy" }}</td>
                <td><span [class]="'est e-'+p.estado">{{ p.estado }}</span></td>
              </tr>
            }
            @if (!prestamos.length) { <tr><td colspan="7" class="empty">Sin prestamos</td></tr> }
          </tbody>
        </table>
      </div>
    }
  </div>
  \`,
  styles: [\`.page{padding:24px;max-width:1300px}.title{font-size:1.35rem;font-weight:700;margin-bottom:18px}.empty{padding:30px;text-align:center;color:#7a839e}.twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.8rem}th{padding:9px 13px;text-align:left;font-size:.62rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}.amt{color:#4f8ef7;font-weight:700}.g{color:#22d3a0}.r{color:#f75f5f}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}.dlink{color:#4f8ef7;text-decoration:none;font-weight:600}.est{font-size:.62rem;padding:2px 7px;border-radius:8px}.e-activo{background:rgba(79,142,247,.15);color:#4f8ef7}.e-pagado{background:rgba(34,211,160,.15);color:#22d3a0}.e-vencido{background:rgba(247,95,95,.15);color:#f75f5f}.e-cancelado{background:rgba(122,131,158,.15);color:#7a839e}\`]
})
export class PrestamosComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  prestamos: any[] = [];
  loading = true;

  ngOnInit(): void {
    this.http.get<any[]>(environment.apiUrl + '/prestamos').subscribe({
      next: (p) => { this.prestamos = p; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }
  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}`;
fs.writeFileSync('src/app/pages/prestamos/prestamos.component.ts', prestamos, 'utf8');
console.log('Prestamos OK');

// DEUDOR DETAIL
const detail = `import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-deudor-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  template: \`
  <div class="page">
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (deudor && !loading) {
      <div class="header">
        <a routerLink="/deudores" class="back">← Deudores</a>
        <h1>{{ deudor.nombre }} {{ deudor.apellidos }}</h1>
        <div class="tags">
          @if (deudor.dni) { <span class="tag">DNI: {{ deudor.dni }}</span> }
          @if (deudor.telefono) { <span class="tag">Tel: {{ deudor.telefono }}</span> }
          <span class="tag g">Cobrado: S/ {{ fmt(deudor.total_pagado) }}</span>
          <span class="tag r">Pendiente: S/ {{ fmt(deudor.saldo_pendiente) }}</span>
        </div>
      </div>

      <div class="sec">Prestamos</div>
      <div class="lgrid">
        @for (p of deudor.prestamos; track p.id) {
          <div class="lcard">
            <span class="ltype">{{ p.tipo }}</span>
            <span class="ldesc">{{ p.descripcion }}</span>
            <span class="lamt">S/ {{ fmt(p.monto_original) }}</span>
            <div class="lmeta">
              <span class="tsm">{{ p.fecha_inicio | date:"dd/MM/yyyy" }}</span>
              <span [class]="'tsm e-'+p.estado">{{ p.estado }}</span>
            </div>
          </div>
        }
        @if (!deudor.prestamos?.length) { <div class="empty">Sin prestamos</div> }
      </div>

      <div class="sec">Historial de pagos</div>
      <div class="twrap">
        <table>
          <thead><tr><th>#</th><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Metodo</th><th>N Op.</th></tr></thead>
          <tbody>
            @for (p of deudor.pagos; track p.id; let i = $index) {
              <tr>
                <td class="mu">{{ i+1 }}</td>
                <td class="mo">{{ p.fecha_pago | date:"dd/MM/yyyy" }}</td>
                <td>{{ p.concepto || '-' }}</td>
                <td class="amt mo">S/ {{ fmt(p.monto) }}</td>
                <td><span [class]="'mb m-'+p.metodo_pago">{{ p.metodo_pago }}</span></td>
                <td class="mo mu">{{ p.numero_operacion || '-' }}</td>
              </tr>
            }
            @if (!deudor.pagos?.length) { <tr><td colspan="6" class="empty">Sin pagos</td></tr> }
          </tbody>
        </table>
      </div>

      <div class="sec">Registrar pago</div>
      <div class="pform">
        <form [formGroup]="pagoForm" (ngSubmit)="registrarPago()">
          <div class="fgrid">
            <div class="f"><label>Prestamo</label>
              <select formControlName="prestamo_id">
                <option [ngValue]="null">Sin especificar</option>
                @for (p of deudor.prestamos; track p.id) { <option [ngValue]="p.id">{{ p.descripcion }}</option> }
              </select>
            </div>
            <div class="f"><label>Fecha *</label><input type="date" formControlName="fecha_pago"></div>
            <div class="f"><label>Monto *</label><input type="number" formControlName="monto" placeholder="0.00" step="0.01"></div>
            <div class="f"><label>Metodo *</label>
              <select formControlName="metodo_pago">
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="transferencia">Transferencia</option>
                <option value="pandero">Pandero</option>
              </select>
            </div>
            <div class="f"><label>N Operacion</label><input type="text" formControlName="numero_operacion"></div>
            <div class="f full"><label>Concepto</label><input type="text" formControlName="concepto"></div>
          </div>
          <div class="faction">
            <button type="submit" class="btn" [disabled]="pagoForm.invalid || saving">{{ saving ? 'Guardando...' : 'Registrar Pago' }}</button>
            @if (pagoOk) { <span class="ok">Pago registrado!</span> }
            @if (pagoErr) { <span class="err">{{ pagoErr }}</span> }
          </div>
        </form>
      </div>
    }
  </div>
  \`,
  styles: [\`.page{padding:24px;max-width:1100px}.empty{padding:30px;text-align:center;color:#7a839e}.back{color:#7a839e;text-decoration:none;font-size:.75rem;display:block;margin-bottom:8px}.back:hover{color:#4f8ef7}.header{margin-bottom:22px}h1{font-size:1.35rem;font-weight:700;margin-bottom:8px}.tags{display:flex;gap:8px;flex-wrap:wrap}.tag{font-size:.7rem;padding:3px 10px;border-radius:20px;background:#252a3a;border:1px solid #2e3450}.tag.g{color:#22d3a0;border-color:#22d3a0}.tag.r{color:#f75f5f;border-color:#f75f5f}.sec{font-size:.68rem;text-transform:uppercase;letter-spacing:1px;color:#7a839e;margin:20px 0 10px;font-weight:700;border-bottom:1px solid #2e3450;padding-bottom:6px}.lgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:18px}.lcard{background:#1e2230;border:1px solid #2e3450;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:4px}.ltype{font-size:.62rem;color:#7a839e;text-transform:uppercase}.ldesc{font-size:.84rem;font-weight:600}.lamt{font-size:1.1rem;font-weight:700;color:#4f8ef7;font-family:monospace}.lmeta{display:flex;gap:6px;flex-wrap:wrap}.tsm{font-size:.62rem;padding:2px 6px;border-radius:8px;background:#252a3a;border:1px solid #2e3450}.e-activo{color:#4f8ef7;border-color:#4f8ef7!important}.e-pagado{color:#22d3a0;border-color:#22d3a0!important}.e-vencido{color:#f75f5f;border-color:#f75f5f!important}.twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto;margin-bottom:18px}table{width:100%;border-collapse:collapse;font-size:.81rem}th{padding:9px 13px;text-align:left;font-size:.65rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}.amt{color:#22d3a0;font-weight:600}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}.mb{font-size:.63rem;padding:2px 7px;border-radius:10px;text-transform:capitalize}.m-yape{background:rgba(100,50,200,.2);color:#b388ff}.m-efectivo{background:rgba(34,211,160,.15);color:#22d3a0}.m-transferencia{background:rgba(79,142,247,.15);color:#4f8ef7}.m-plin{background:rgba(247,135,79,.15);color:#f7874f}.m-pandero{background:rgba(247,201,72,.15);color:#f7c948}.pform{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:20px}.fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:13px}.f{display:flex;flex-direction:column;gap:5px}.f.full{grid-column:1/-1}label{font-size:.68rem;color:#7a839e;text-transform:uppercase;letter-spacing:.4px}input,select{background:#0d0f14;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:8px 11px;font-size:.82rem;outline:none;font-family:inherit}input:focus,select:focus{border-color:#4f8ef7}select option{background:#1e2230}.faction{margin-top:16px;display:flex;align-items:center;gap:12px}.btn{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:10px 22px;font-weight:600;font-size:.82rem;cursor:pointer;font-family:inherit}.btn:disabled{opacity:.6;cursor:not-allowed}.ok{font-size:.78rem;color:#22d3a0}.err{font-size:.78rem;color:#f75f5f}\`]
})
export class DeudorDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  deudor: any;
  loading = true;
  saving = false;
  pagoOk = false;
  pagoErr = '';
  pagoForm = this.fb.group({
    prestamo_id: [null],
    fecha_pago: [new Date().toISOString().split('T')[0], Validators.required],
    monto: [null, [Validators.required, Validators.min(0.01)]],
    metodo_pago: ['efectivo', Validators.required],
    numero_operacion: [''],
    concepto: ['']
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    const id = this.route.snapshot.params['id'];
    this.http.get<any>(environment.apiUrl + '/deudores/' + id).subscribe({
      next: (d) => { this.deudor = d; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  registrarPago(): void {
    if (this.pagoForm.invalid) return;
    this.saving = true; this.pagoErr = ''; this.pagoOk = false;
    const v = this.pagoForm.value as any;
    const fd = new FormData();
    const id = this.route.snapshot.params['id'];
    Object.entries({ ...v, deudor_id: id }).forEach(([k, val]) => { if (val != null) fd.append(k, String(val)); });
    this.http.post(environment.apiUrl + '/pagos', fd).subscribe({
      next: () => {
        this.saving = false; this.pagoOk = true;
        this.pagoForm.reset({ fecha_pago: new Date().toISOString().split('T')[0], metodo_pago: 'efectivo' });
        this.cdr.detectChanges();
        this.load();
        setTimeout(() => { this.pagoOk = false; this.cdr.detectChanges(); }, 3000);
      },
      error: (e) => { this.saving = false; this.pagoErr = e.error?.error || 'Error al registrar'; this.cdr.detectChanges(); }
    });
  }

  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}`;
fs.writeFileSync('src/app/pages/deudor-detail/deudor-detail.component.ts', detail, 'utf8');
console.log('DeudorDetail OK');

console.log('\nTodos los componentes actualizados con ChangeDetectorRef');
