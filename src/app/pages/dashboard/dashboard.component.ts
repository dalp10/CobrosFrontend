import { Component, OnInit, AfterViewInit, inject, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
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

      const grad = ctx.createLinearGradient(0, y, 0, y + barH2);
      grad.addColorStop(0, '#7c5cfc');
      grad.addColorStop(1, '#4f8ef7');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH2, 3);
      ctx.fill();

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
    const colors = ['#4f8ef7', '#22d3a0', '#b388ff', '#f7874f', '#f7c948', '#f75f5f'];

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
    const map: Record<string, string> = {
      yape: '#b388ff',
      efectivo: '#22d3a0',
      transferencia: '#4f8ef7',
      plin: '#f7874f',
      pandero: '#f7c948'
    };
    return map[m] || '#7a839e';
  }

  fmt(v: any): string { return (+(v ?? 0)).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  pct(paid: any, total: any): number { return total ? Math.min(100, (+(paid || 0) / +total) * 100) : 0; }
}
