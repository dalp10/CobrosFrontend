const fs = require('fs');

// Fix dashboard to reload on every navigation to it
const dashboard = `import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { PagosService } from '../../services/pagos.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

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
              <span class="dpaid">S/ {{ fmt(d.total_pagado) }}</span>
            </div>
          }
        </div>
        <div class="card">
          <h2 class="ctitle">Por metodo</h2>
          @for (m of data.porMetodo; track m.metodo_pago) {
            <div class="drow">
              <span>{{ m.metodo_pago }}</span>
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
                <div class="bcont"><div class="bbar" [style.height.%]="barH(m.total)"></div></div>
                <span class="blbl">{{ m.mes.substring(5,7) }}/{{ m.mes.substring(2,4) }}</span>
              </div>
            }
          </div>
        </div>
      }
    }
  </div>
  \`,
  styles: [\`.page{padding:24px;max-width:1200px}.title{font-size:1.4rem;font-weight:700;margin-bottom:20px}.empty{padding:40px;text-align:center;color:#7a839e}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;margin-bottom:20px}.scard{background:#1e2230;border:1px solid #2e3450;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:4px}.slbl{font-size:.68rem;color:#7a839e;text-transform:uppercase}.sval{font-size:1.2rem;font-weight:700;font-family:monospace}.green{color:#22d3a0}.blue{color:#4f8ef7}.red{color:#f75f5f}.cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}.card{background:#1e2230;border:1px solid #2e3450;border-radius:12px;padding:16px;margin-bottom:14px}.ctitle{font-size:.85rem;font-weight:600;margin-bottom:10px}.mt{margin-top:14px}.drow{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #2e3450}.dname{color:#4f8ef7;text-decoration:none;font-weight:600;font-size:.83rem}.dmeta{font-size:.65rem;color:#7a839e;display:block}.dpaid{color:#22d3a0;font-family:monospace;font-size:.8rem}.chart{display:flex;gap:4px;align-items:flex-end;height:90px}.bwrap{flex:1;display:flex;flex-direction:column;align-items:center}.bcont{flex:1;display:flex;align-items:flex-end;width:100%}.bbar{width:100%;background:linear-gradient(180deg,#4f8ef7,#7c5cfc);border-radius:3px 3px 0 0;min-height:3px}.blbl{font-size:.55rem;color:#7a839e;margin-top:3px}\`]
})
export class DashboardComponent implements OnInit, OnDestroy {
  private svc = inject(PagosService);
  private router = inject(Router);
  private sub!: Subscription;
  data: any;
  loading = true;
  private maxMes = 1;

  ngOnInit(): void {
    this.load();
    this.sub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(() => this.load());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  load(): void {
    this.loading = true;
    this.svc.getResumen().subscribe({
      next: (r: any) => {
        this.data = {
          porDeudor: r.porDeudor.map((d: any) => ({ ...d, total_pagado: +d.total_pagado, total_prestado: +d.total_prestado })),
          porMetodo: r.porMetodo.map((m: any) => ({ ...m, total: +m.total })),
          porMes: r.porMes.map((m: any) => ({ ...m, total: +m.total })),
          totales: { total_cobrado: +r.totales.total_cobrado, total_prestado: +r.totales.total_prestado },
        };
        this.maxMes = Math.max(...this.data.porMes.map((m: any) => m.total), 1);
        this.loading = false;
      },
      error: (e: any) => { console.error(e); this.loading = false; },
    });
  }

  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  barH(val: any): number { return (+val / this.maxMes) * 100; }
}`;

fs.writeFileSync('src/app/pages/dashboard/dashboard.component.ts', dashboard, 'utf8');
console.log('Dashboard OK');

// Fix deudores
const deudores = `import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { DeudoresService } from '../../services/deudores.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-deudores',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: \`
  <div class="page">
    <h1 class="title">Deudores</h1>
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (!loading && deudores.length === 0) { <div class="empty">Sin deudores.</div> }
    @if (!loading && deudores.length) {
      <div class="grid">
        @for (d of deudores; track d.id) {
          <a [routerLink]="['/deudores', d.id]" class="card">
            <div class="chead">
              <div class="avatar">{{ d.nombre[0] }}{{ d.apellidos[0] }}</div>
              <div>
                <div class="name">{{ d.nombre }} {{ d.apellidos }}</div>
                @if (d.dni) { <div class="sub">DNI {{ d.dni }}</div> }
              </div>
            </div>
            <div class="nums">
              <div class="nitem"><span class="nlbl">Prestado</span><span class="nval blue">S/ {{ fmt(d.total_prestado) }}</span></div>
              <div class="nitem"><span class="nlbl">Cobrado</span><span class="nval green">S/ {{ fmt(d.total_pagado) }}</span></div>
              <div class="nitem"><span class="nlbl">Pendiente</span><span class="nval red">S/ {{ fmt(d.saldo_pendiente) }}</span></div>
            </div>
            <div class="prog">
              <div class="pbar"><div class="pfill" [style.width.%]="pct(d.total_pagado, d.total_prestado)"></div></div>
              <span class="ppct">{{ pct(d.total_pagado, d.total_prestado) | number:"1.0-0" }}%</span>
            </div>
            <div class="foot">
              @if (d.ultimo_pago) { <span>Ultimo: {{ d.ultimo_pago | date:"dd/MM/yyyy" }}</span> }
              @else { <span class="mu">Sin pagos</span> }
              <span class="arrow">→</span>
            </div>
          </a>
        }
      </div>
    }
  </div>
  \`,
  styles: [\`.page{padding:24px;max-width:1200px}.title{font-size:1.35rem;font-weight:700;margin-bottom:20px}.empty{padding:40px;text-align:center;color:#7a839e}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.card{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:18px;text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:14px;transition:border-color .15s,transform .15s}.card:hover{border-color:#4f8ef7;transform:translateY(-2px)}.chead{display:flex;align-items:center;gap:12px}.avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#4f8ef7,#7c5cfc);display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;color:#fff;flex-shrink:0}.name{font-size:.92rem;font-weight:600}.sub{font-size:.68rem;color:#7a839e}.nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.nitem{display:flex;flex-direction:column;gap:2px}.nlbl{font-size:.6rem;color:#7a839e;text-transform:uppercase}.nval{font-size:.78rem;font-weight:700;font-family:monospace;color:#e8ecf4}.green{color:#22d3a0!important}.blue{color:#4f8ef7!important}.red{color:#f75f5f!important}.prog{display:flex;align-items:center;gap:8px}.pbar{flex:1;height:5px;background:#2e3450;border-radius:3px;overflow:hidden}.pfill{height:100%;background:#22d3a0;border-radius:3px}.foot{display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:#7a839e}.arrow{color:#4f8ef7}.mu{color:#7a839e}\`]
})
export class DeudoresComponent implements OnInit, OnDestroy {
  private svc = inject(DeudoresService);
  private router = inject(Router);
  private sub!: Subscription;
  deudores: any[] = [];
  loading = true;

  ngOnInit(): void {
    this.load();
    this.sub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      if (e.url === '/deudores') this.load();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  load(): void {
    this.loading = true;
    this.svc.getAll().subscribe({
      next: (d: any) => { this.deudores = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  pct(paid: any, total: any): number { return total ? Math.min(100,(+(paid||0)/+total)*100) : 0; }
}`;

fs.writeFileSync('src/app/pages/deudores/deudores.component.ts', deudores, 'utf8');
console.log('Deudores OK');

// Fix pagos
const pagos = `import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { PagosService } from '../../services/pagos.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

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
export class PagosComponent implements OnInit, OnDestroy {
  private svc = inject(PagosService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private sub!: Subscription;
  pagos: any[] = [];
  loading = true;
  filters = this.fb.group({ desde: [''], hasta: [''], metodo: [''] });
  get total(): number { return this.pagos.reduce((s,p) => s + +(p.monto||0), 0); }

  ngOnInit(): void {
    this.buscar();
    this.sub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      if (e.url === '/pagos') this.buscar();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  buscar(): void {
    this.loading = true;
    const v = this.filters.value as any;
    this.svc.getAll({ desde: v.desde||undefined, hasta: v.hasta||undefined, metodo: v.metodo||undefined, limit: 200 }).subscribe({
      next: (r: any) => { this.pagos = r.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
  limpiar(): void { this.filters.reset({ desde:'', hasta:'', metodo:'' }); this.buscar(); }
  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}`;

fs.writeFileSync('src/app/pages/pagos/pagos.component.ts', pagos, 'utf8');
console.log('Pagos OK');

// Fix prestamos
const prestamos = `import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { PrestamosService } from '../../services/prestamos.service';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

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
                <td>{{ p.estado }}</td>
              </tr>
            }
            @if (!prestamos.length) { <tr><td colspan="7" class="empty">Sin prestamos</td></tr> }
          </tbody>
        </table>
      </div>
    }
  </div>
  \`,
  styles: [\`.page{padding:24px;max-width:1300px}.title{font-size:1.35rem;font-weight:700;margin-bottom:18px}.empty{padding:30px;text-align:center;color:#7a839e}.twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.8rem}th{padding:9px 13px;text-align:left;font-size:.62rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}.amt{color:#4f8ef7;font-weight:700}.g{color:#22d3a0}.r{color:#f75f5f}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}.dlink{color:#4f8ef7;text-decoration:none;font-weight:600}\`]
})
export class PrestamosComponent implements OnInit, OnDestroy {
  private svc = inject(PrestamosService);
  private router = inject(Router);
  private sub!: Subscription;
  prestamos: any[] = [];
  loading = true;

  ngOnInit(): void {
    this.load();
    this.sub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e: any) => {
      if (e.url === '/prestamos') this.load();
    });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  load(): void {
    this.loading = true;
    this.svc.getAll().subscribe({
      next: (p: any) => { this.prestamos = p; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}`;

fs.writeFileSync('src/app/pages/prestamos/prestamos.component.ts', prestamos, 'utf8');
console.log('Prestamos OK');

console.log('\nTodos los componentes actualizados con recarga en navegacion');
