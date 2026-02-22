import { Component, OnInit, AfterViewInit, inject, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
  <div class="page">
    <h1 class="title">Dashboard</h1>
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (data && !loading) {

      <!-- STATS -->
      <div class="stats">
        <div class="scard">
          <span class="sico">💰</span>
          <div>
            <span class="slbl">Total cobrado</span>
            <span class="sval green">S/ {{ fmt(data.totales.total_cobrado) }}</span>
          </div>
        </div>
        <div class="scard">
          <span class="sico">📤</span>
          <div>
            <span class="slbl">Total prestado</span>
            <span class="sval blue">S/ {{ fmt(data.totales.total_prestado) }}</span>
          </div>
        </div>
        <div class="scard">
          <span class="sico">⏳</span>
          <div>
            <span class="slbl">Pendiente</span>
            <span class="sval red">S/ {{ fmt(data.totales.total_prestado - data.totales.total_cobrado) }}</span>
          </div>
        </div>
        <div class="scard">
          <span class="sico">👥</span>
          <div>
            <span class="slbl">Deudores activos</span>
            <span class="sval white">{{ data.porDeudor.length }}</span>
          </div>
        </div>
      </div>

      <div class="row2">
        <!-- GRÁFICO DE BARRAS: cobros por mes -->
        <div class="card wide">
          <h2 class="ctitle">Cobros últimos 12 meses</h2>
          @if (data.porMes.length) {
            <canvas #barChart class="chart-canvas"></canvas>
          } @else {
            <div class="empty-chart">Sin datos de cobros</div>
          }
        </div>

        <!-- GRÁFICO DONA: por método de pago -->
        <div class="card narrow">
          <h2 class="ctitle">Por método de pago</h2>
          @if (data.porMetodo.length) {
            <canvas #donutChart class="donut-canvas"></canvas>
            <div class="legend">
              @for (m of data.porMetodo; track m.metodo_pago) {
                <div class="legend-item">
                  <span class="legend-dot" [style.background]="metodoColor(m.metodo_pago)"></span>
                  <span class="legend-lbl">{{ m.metodo_pago }}</span>
                  <span class="legend-val">S/ {{ fmt(m.total) }}</span>
                </div>
              }
            </div>
          } @else {
            <div class="empty-chart">Sin pagos</div>
          }
        </div>
      </div>

      <!-- TABLA DEUDORES -->
      <div class="card">
        <h2 class="ctitle">Resumen por deudor</h2>
        <div class="twrap">
          <table>
            <thead><tr><th>Deudor</th><th>Cobrado</th><th>Prestado</th><th>Pendiente</th><th>Último pago</th><th>Avance</th></tr></thead>
            <tbody>
              @for (d of data.porDeudor; track d.id) {
                <tr>
                  <td><a [routerLink]="['/deudores', d.id]" class="dlink">{{ d.nombre }}</a></td>
                  <td class="mo green">S/ {{ fmt(d.total_pagado) }}</td>
                  <td class="mo blue">S/ {{ fmt(d.total_prestado) }}</td>
                  <td class="mo red">S/ {{ fmt(d.total_prestado - d.total_pagado) }}</td>
                  <td class="mo mu">{{ d.ultimo_pago ? (d.ultimo_pago | date:"dd/MM/yyyy") : '—' }}</td>
                  <td>
                    <div class="prog-row">
                      <div class="pbar"><div class="pfill" [style.width.%]="pct(d.total_pagado, d.total_prestado)"></div></div>
                      <span class="ppct">{{ pct(d.total_pagado, d.total_prestado).toFixed(0) }}%</span>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

    }
  </div>
  `,
  styles: [`
    .page{padding:24px;max-width:1300px}
    .title{font-size:1.4rem;font-weight:700;margin-bottom:20px}
    .empty{padding:40px;text-align:center;color:#7a839e}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px}
    .scard{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:16px 20px;display:flex;align-items:center;gap:14px}
    .sico{font-size:1.6rem}
    .slbl{font-size:.65rem;color:#7a839e;text-transform:uppercase;display:block;margin-bottom:3px}
    .sval{font-size:1.15rem;font-weight:700;font-family:monospace;display:block}
    .green{color:#22d3a0}.blue{color:#4f8ef7}.red{color:#f75f5f}.white{color:#e8ecf4}
    .row2{display:grid;grid-template-columns:1fr 340px;gap:14px;margin-bottom:14px}
    @media(max-width:900px){.row2{grid-template-columns:1fr}}
    .card{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:18px;margin-bottom:14px}
    .ctitle{font-size:.82rem;font-weight:700;margin-bottom:14px;color:#e8ecf4}
    .chart-canvas{width:100%!important;height:200px!important}
    .donut-canvas{width:180px!important;height:180px!important;display:block;margin:0 auto 14px}
    .empty-chart{padding:40px;text-align:center;color:#7a839e;font-size:.8rem}
    .legend{display:flex;flex-direction:column;gap:8px}
    .legend-item{display:flex;align-items:center;gap:8px;font-size:.75rem}
    .legend-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
    .legend-lbl{flex:1;text-transform:capitalize;color:#e8ecf4}
    .legend-val{color:#22d3a0;font-family:monospace;font-weight:600}
    .twrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;font-size:.81rem}
    th{padding:8px 12px;text-align:left;font-size:.62rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}
    td{padding:8px 12px;border-bottom:1px solid rgba(46,52,80,.3)}
    .dlink{color:#4f8ef7;text-decoration:none;font-weight:600}.dlink:hover{text-decoration:underline}
    .mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}
    .prog-row{display:flex;align-items:center;gap:8px}
    .pbar{width:70px;height:5px;background:#2e3450;border-radius:3px;overflow:hidden}
    .pfill{height:100%;background:#22d3a0;border-radius:3px;transition:width .3s}
    .ppct{font-size:.68rem;color:#7a839e;min-width:28px}
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donutChart') donutChartRef!: ElementRef<HTMLCanvasElement>;

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  data: any;
  loading = true;

  ngOnInit(): void {
    this.http.get<any>(environment.apiUrl + '/pagos/resumen').subscribe({
      next: (r) => {
        this.data = {
          porDeudor: r.porDeudor.map((d: any) => ({
            ...d,
            total_pagado: +d.total_pagado,
            total_prestado: +d.total_prestado
          })),
          porMetodo: r.porMetodo.map((m: any) => ({ ...m, cantidad: +m.cantidad, total: +m.total })),
          porMes: r.porMes.map((m: any) => ({ ...m, total: +m.total })),
          totales: { total_cobrado: +r.totales.total_cobrado, total_prestado: +r.totales.total_prestado }
        };
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.drawCharts(), 100);
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  ngAfterViewInit(): void {}

  drawCharts(): void {
    this.drawBarChart();
    this.drawDonutChart();
  }

  drawBarChart(): void {
    const canvas = this.barChartRef?.nativeElement;
    if (!canvas || !this.data?.porMes?.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth || 600;
    const h = 200;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const data = this.data.porMes;
    const maxVal = Math.max(...data.map((d: any) => d.total), 1);
    const pad = { top: 20, right: 10, bottom: 40, left: 60 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = Math.max(10, chartW / data.length - 6);

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = '#2e3450';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
      const val = maxVal * (1 - i / 4);
      ctx.fillStyle = '#7a839e';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('S/' + Math.round(val).toLocaleString(), pad.left - 6, y + 4);
    }

    // Bars
    data.forEach((d: any, i: number) => {
      const x = pad.left + (chartW / data.length) * i + (chartW / data.length - barW) / 2;
      const barH2 = (d.total / maxVal) * chartH;
      const y = pad.top + chartH - barH2;

      // Gradient
      const grad = ctx.createLinearGradient(0, y, 0, y + barH2);
      grad.addColorStop(0, '#7c5cfc');
      grad.addColorStop(1, '#4f8ef7');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH2, 3);
      ctx.fill();

      // Label
      const mes = d.mes.substring(5, 7) + '/' + d.mes.substring(2, 4);
      ctx.fillStyle = '#7a839e';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(mes, x + barW / 2, h - pad.bottom + 14);
    });
  }

  drawDonutChart(): void {
    const canvas = this.donutChartRef?.nativeElement;
    if (!canvas || !this.data?.porMetodo?.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = 180 * dpr;
    canvas.height = 180 * dpr;
    ctx.scale(dpr, dpr);

    const cx = 90, cy = 90, r = 70, inner = 42;
    const total = this.data.porMetodo.reduce((s: number, m: any) => s + m.total, 0);
    const colors = ['#4f8ef7','#22d3a0','#b388ff','#f7874f','#f7c948','#f75f5f'];

    let angle = -Math.PI / 2;
    this.data.porMetodo.forEach((m: any, i: number) => {
      const slice = (m.total / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      angle += slice;
    });

    // Hole
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = '#1e2230';
    ctx.fill();

    // Center text
    ctx.fillStyle = '#e8ecf4';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('S/' + Math.round(total / 1000) + 'k', cx, cy + 4);
  }

  metodoColor(m: string): string {
    const map: Record<string, string> = { yape: '#b388ff', efectivo: '#22d3a0', transferencia: '#4f8ef7', plin: '#f7874f', pandero: '#f7c948' };
    return map[m] || '#7a839e';
  }

  fmt(v: any): string { return (+(v ?? 0)).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  pct(paid: any, total: any): number { return total ? Math.min(100, (+(paid || 0) / +total) * 100) : 0; }
  number(v: number, fmt: string): string { return v.toFixed(0); }
}