const fs = require('fs');

const dashboard = `import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PagosService } from '../../services/pagos.service';

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
                <span class="blbl">{{ m.mes | slice:5:7 }}/{{ m.mes | slice:2:4 }}</span>
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
export class DashboardComponent implements OnInit {
  private svc = inject(PagosService);
  data: any;
  loading = true;
  private maxMes = 1;

  ngOnInit(): void {
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
