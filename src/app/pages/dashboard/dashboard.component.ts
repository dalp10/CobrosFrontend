import { Component, OnInit, AfterViewInit, OnDestroy, inject, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PagosService } from '../../services/pagos.service';
import { PrestamosService } from '../../services/prestamos.service';
import { NotificationService } from '../../services/notification.service';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { FormatPercentPipe } from '../../shared/pipes/format-percent.pipe';
import { DashboardSkeletonComponent } from './dashboard-skeleton.component';
import { ResumenDashboard } from '../../models/index';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, FormatNumberPipe, FormatPercentPipe, DashboardSkeletonComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('barChart') barChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donutChart') donutChartRef!: ElementRef<HTMLCanvasElement>;

  private pagosService = inject(PagosService);
  private prestamosService = inject(PrestamosService);
  private cdr = inject(ChangeDetectorRef);
  private notify = inject(NotificationService);

  data: ResumenDashboard | null = null;
  prestamosVencidos = 0;
  loading = true;
  error = false;
  private resizeObserver: ResizeObserver | null = null;

  /** Tooltip al pasar el mouse sobre gráficos */
  tooltip: { mes?: string; metodo?: string; total: number; pct?: number; x: number; y: number } | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(forceRefresh = false): void {
    this.loading = true;
    this.error = false;
    this.prestamosService.getAll().subscribe(prestamos => {
      this.prestamosVencidos = prestamos.filter(p => p.estado === 'vencido').length;
      this.cdr.detectChanges();
    });
    this.pagosService.getResumen(forceRefresh).subscribe({
      next: (r) => {
        this.data = r;
        this.loading = false;
        this.error = false;
        this.cdr.detectChanges();
        setTimeout(() => this.drawCharts(), 100);
      },
      error: () => {
        this.loading = false;
        this.error = true;
        this.notify.error('No se pudo cargar el resumen');
        this.cdr.detectChanges();
      }
    });
  }

  /** Ordenar deudores: mayor pendiente primero, luego sin último pago */
  get deudoresOrdenados(): ResumenDashboard['porDeudor'] {
    if (!this.data?.porDeudor?.length) return [];
    return [...this.data.porDeudor].sort((a, b) => {
      const pendA = a.total_prestado - a.total_pagado;
      const pendB = b.total_prestado - b.total_pagado;
      if (pendB !== pendA) return pendB - pendA;
      const ultA = a.ultimo_pago ? new Date(a.ultimo_pago).getTime() : 0;
      const ultB = b.ultimo_pago ? new Date(b.ultimo_pago).getTime() : 0;
      return ultA - ultB;
    });
  }

  readonly PAGE_SIZE = 10;
  deudoresVisible = this.PAGE_SIZE;

  get deudoresParaTabla(): ResumenDashboard['porDeudor'] {
    const list = this.deudoresOrdenados;
    return list.slice(0, this.deudoresVisible);
  }

  get hayMasDeudores(): boolean {
    return this.deudoresOrdenados.length > this.deudoresVisible;
  }

  get cantidadVerMas(): number {
    const rest = this.deudoresOrdenados.length - this.deudoresVisible;
    return Math.min(this.PAGE_SIZE, rest);
  }

  verMasDeudores(): void {
    this.deudoresVisible += this.PAGE_SIZE;
  }

  /** Formatea monto para tooltips */
  formatMonto(value: number): string {
    return 'S/ ' + value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  onBarMouseMove(event: MouseEvent): void {
    const canvas = this.barChartRef?.nativeElement;
    if (!canvas || !this.data?.porMes?.length) return;
    const rect = canvas.getBoundingClientRect();
    const pad = { top: 20, right: 10, bottom: 40, left: 60 };
    const w = canvas.offsetWidth || 600;
    const h = 200;
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = Math.max(10, chartW / this.data.porMes.length - 6);
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const barAreaTop = pad.top;
    const barAreaBottom = pad.top + chartH;
    if (mouseY < barAreaTop || mouseY > barAreaBottom) {
      this.tooltip = null;
      this.cdr.detectChanges();
      return;
    }
    const index = Math.floor((mouseX - pad.left) / (chartW / this.data.porMes.length));
    if (index < 0 || index >= this.data.porMes.length) {
      this.tooltip = null;
      this.cdr.detectChanges();
      return;
    }
    const d = this.data.porMes[index];
    const mesLabel = this.formatMesLabel(d.mes);
    this.tooltip = {
      mes: mesLabel,
      total: d.total,
      x: event.clientX + 12,
      y: event.clientY + 12,
    };
    this.cdr.detectChanges();
  }

  onBarMouseLeave(): void {
    this.tooltip = null;
    this.cdr.detectChanges();
  }

  onDonutMouseMove(event: MouseEvent): void {
    const canvas = this.donutChartRef?.nativeElement;
    if (!canvas || !this.data?.porMetodo?.length) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ((event.clientX - rect.left) / rect.width) * 180;
    const my = ((event.clientY - rect.top) / rect.height) * 180;
    const cx = 90;
    const cy = 90;
    const r = 70;
    const inner = 42;
    const dx = mx - cx;
    const dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < inner || dist > r) {
      this.tooltip = null;
      this.cdr.detectChanges();
      return;
    }
    let angle = Math.atan2(dy, dx);
    angle = angle + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const total = this.data.porMetodo.reduce((s, m) => s + m.total, 0);
    let acc = 0;
    for (let i = 0; i < this.data.porMetodo.length; i++) {
      const m = this.data.porMetodo[i];
      const slice = (m.total / total) * Math.PI * 2;
      if (angle >= acc && angle < acc + slice) {
        const pct = total ? (m.total / total) * 100 : 0;
        this.tooltip = {
          metodo: m.metodo_pago,
          total: m.total,
          pct,
          x: event.clientX + 12,
          y: event.clientY + 12,
        };
        this.cdr.detectChanges();
        return;
      }
      acc += slice;
    }
    this.tooltip = null;
    this.cdr.detectChanges();
  }

  onDonutMouseLeave(): void {
    this.tooltip = null;
    this.cdr.detectChanges();
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  drawCharts(): void {
    this.drawBarChart();
    this.drawDonutChart();
    this.setupResizeObserver();
  }

  private setupResizeObserver(): void {
    if (this.resizeObserver) return;
    this.resizeObserver = new ResizeObserver(() => {
      if (this.data && !this.loading) this.drawCharts();
    });
    const barEl = this.barChartRef?.nativeElement;
    const donutEl = this.donutChartRef?.nativeElement;
    if (barEl) this.resizeObserver.observe(barEl);
    if (donutEl) this.resizeObserver.observe(donutEl);
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
    const maxVal = Math.max(...data.map(d => d.total), 1);
    const pad = { top: 20, right: 10, bottom: 40, left: 60 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = Math.max(10, chartW / data.length - 6);

    ctx.clearRect(0, 0, w, h);

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

    data.forEach((d, i: number) => {
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

      const mes = this.formatMesLabel(d.mes);
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
    const total = this.data.porMetodo.reduce((s, m) => s + m.total, 0);
    const colors = ['#4f8ef7', '#22d3a0', '#b388ff', '#f7874f', '#f7c948', '#f75f5f'];

    let angle = -Math.PI / 2;
    this.data.porMetodo.forEach((m, i: number) => {
      const slice = (m.total / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      angle += slice;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = '#1e2230';
    ctx.fill();

    const centerText = total >= 1000
      ? 'S/ ' + Math.round(total / 1000) + 'k'
      : 'S/ ' + total.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: total < 1 ? 2 : 0 });
    ctx.fillStyle = '#e8ecf4';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(centerText, cx, cy + 4);
  }

  /** Formatea mes para el gráfico: acepta YYYY-MM o YYYY-MM-DD y devuelve "Mar 25" o "03/25" */
  formatMesLabel(mes: string): string {
    if (!mes || mes.length < 7) return mes;
    const [y, m] = mes.split('-').map(Number);
    if (!m) return mes;
    const date = new Date(y, m - 1, 1);
    const short = date.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' });
    return short.replace('.', ''); // "mar 25" o "mar. 25" -> "mar 25"
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
}
