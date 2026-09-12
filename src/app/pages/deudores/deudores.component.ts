import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { DeudoresService } from '../../services/deudores.service';
import { NotificationService } from '../../services/notification.service';
import { ExportService } from '../../services/export.service';
import { ImagePreviewButtonComponent } from '../../shared/image-preview-button/image-preview-button.component';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { FormatPercentPipe } from '../../shared/pipes/format-percent.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Deudor } from '../../models/index';
import { telefonoPeruOptional } from '../../shared/validators';
import { ModalFocusDirective } from '../../shared/directives/modal-focus.directive';
import { withLoading } from '../../shared/utils/loading';

/** Valida DNI peruano: opcional; si tiene valor debe ser exactamente 8 dígitos */
function dniValidator(c: { value: unknown }) {
  const v = c.value;
  if (v == null || typeof v !== 'string') return null;
  const t = String(v).trim();
  if (t === '') return null;
  return /^\d{8}$/.test(t) ? null : { dni: { value: t } };
}

@Component({
  selector: 'app-deudores',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, ReactiveFormsModule, FormsModule, FormatNumberPipe, FormatPercentPipe, SkeletonComponent, ModalFocusDirective],
  templateUrl: './deudores.component.html',
  styleUrl: './deudores.component.css'
})
export class DeudoresComponent implements OnInit {
  private deudoresService = inject(DeudoresService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private notify = inject(NotificationService);
  private exportService = inject(ExportService);

  deudores: Deudor[] = [];
  filtered: Deudor[] = [];
  loading = true;
  showModal = false;
  editando: Deudor | null = null;
  saving = false;
  formErr = '';
  submitted = false;
  searchTerm = '';
  filtroEstado: 'todos' | 'al_dia' | 'en_mora' = 'todos';
  diasAlerta = 30;
  alertas: Deudor[] = [];

  readonly PAGE_SIZE = 20;
  deudoresVisible = this.PAGE_SIZE;

  get deudoresParaMostrar(): Deudor[] {
    return this.filtered.slice(0, this.deudoresVisible);
  }

  get hayMasDeudores(): boolean {
    return this.filtered.length > this.deudoresVisible;
  }

  get cantidadVerMas(): number {
    return Math.min(this.PAGE_SIZE, this.filtered.length - this.deudoresVisible);
  }

  get totalPendienteFiltrado(): number {
    return this.filtered.reduce((s, d) => s + +(d.saldo_pendiente ?? 0), 0);
  }

  verMasDeudores(): void {
    this.deudoresVisible += this.PAGE_SIZE;
  }

  form = this.fb.group({
    nombre:    ['', Validators.required],
    apellidos: ['', Validators.required],
    dni:       ['', dniValidator],
    telefono:  ['', telefonoPeruOptional()],
    email:     [''],
    direccion: [''],
    notas:     ['']
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.deudoresVisible = this.PAGE_SIZE;
    this.deudoresService.getAll().subscribe(withLoading(this.cdr, v => this.loading = v, {
      next: (d) => {
        this.deudores = d;
        this.filtrar();
        this.calcularAlertas();
      },
      error: () => { this.deudores = []; this.filtered = []; this.alertas = []; }
    }));
  }

  filtrar(): void {
    const list = Array.isArray(this.deudores) ? this.deudores : [];
    const term = this.searchTerm.toLowerCase().trim();
    this.deudoresVisible = this.PAGE_SIZE;
    let list2 = list;
    if (term) {
      list2 = list.filter(d =>
        (d && (d.nombre + ' ' + (d.apellidos || '')).toLowerCase().includes(term)) ||
        (d && (d.dni || '').includes(term)) ||
        (d && (d.telefono || '').includes(term))
      );
    }
    if (this.filtroEstado === 'al_dia') {
      list2 = list2.filter(d => +(d?.saldo_pendiente ?? 0) <= 0);
    } else if (this.filtroEstado === 'en_mora') {
      list2 = list2.filter(d => +(d?.saldo_pendiente ?? 0) > 0);
    }
    this.filtered = list2;
    this.cdr.detectChanges();
  }

  openModal(deudor?: Deudor): void {
    this.editando = deudor || null;
    this.submitted = false;
    this.formErr = '';
    if (deudor) {
      this.form.setValue({
        nombre:    deudor.nombre    || '',
        apellidos: deudor.apellidos || '',
        dni:       deudor.dni       || '',
        telefono:  deudor.telefono  || '',
        email:     deudor.email     || '',
        direccion: deudor.direccion || '',
        notas:     deudor.notas     || ''
      });
    } else {
      this.form.reset();
    }
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
    this.editando = null;
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showModal) this.closeModal();
  }

  fi(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.touched || this.submitted));
  }

  guardar(): void {
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notify.error('Completa los campos requeridos');
      this.cdr.detectChanges();
      return;
    }
    this.saving = true; this.formErr = '';
    const v = this.form.value;
    const body = {
      nombre: v.nombre ?? '',
      apellidos: v.apellidos ?? '',
      dni: v.dni ?? undefined,
      telefono: v.telefono ?? undefined,
      email: v.email ?? undefined,
      direccion: v.direccion ?? undefined,
      notas: v.notas ?? undefined
    };
    const req = this.editando
      ? this.deudoresService.update(this.editando.id, body)
      : this.deudoresService.create(body);
    req.subscribe({
      next: () => { this.saving = false; this.closeModal(); this.load(); this.notify.success(this.editando ? 'Deudor actualizado' : 'Deudor creado'); },
      error: (e) => { this.saving = false; this.formErr = e.error?.error || 'Error al guardar'; this.cdr.detectChanges(); this.notify.error(this.formErr); }
    });
  }

  calcularAlertas(): void {
    const list = Array.isArray(this.deudores) ? this.deudores : [];
    const hoy = new Date();
    this.alertas = list.filter(d => {
      if (!d || typeof d !== 'object') return false;
      if (+(d.saldo_pendiente ?? 0) <= 0) return false;
      if (!d.ultimo_pago) return true;
      const diff = Math.floor((hoy.getTime() - new Date(d.ultimo_pago).getTime()) / 86400000);
      return diff >= this.diasAlerta;
    });
    this.cdr.detectChanges();
  }

  diasDesde(fecha: string): number {
    return Math.floor((new Date().getTime() - new Date(fecha).getTime()) / 86400000);
  }

  exportExcel(): void {
    const rows: (string | number)[][] = [
      ['Nombre', 'Apellidos', 'DNI', 'Teléfono', 'Email', 'Total prestado', 'Total cobrado', 'Saldo pendiente', 'Último pago']
    ];
    this.filtered.forEach(d => {
      rows.push([
        d.nombre || '',
        d.apellidos || '',
        d.dni || '',
        d.telefono || '',
        d.email || '',
        +(d.total_prestado ?? 0),
        +(d.total_pagado ?? 0),
        +(d.saldo_pendiente ?? 0),
        d.ultimo_pago ? d.ultimo_pago.split('T')[0] : ''
      ]);
    });
    this.exportService.downloadCsv(rows, 'deudores_' + new Date().toISOString().split('T')[0] + '.csv');
    this.notify.success('Exportados ' + this.filtered.length + ' deudores');
  }

  exportPdf(): void {
    const list = this.filtered;
    const now = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalPrestado = list.reduce((s, d) => s + +(d.total_prestado ?? 0), 0);
    const totalCobrado = list.reduce((s, d) => s + +(d.total_pagado ?? 0), 0);
    const totalPendiente = list.reduce((s, d) => s + +(d.saldo_pendiente ?? 0), 0);
    const rows = list.map(d =>
      `<tr>
        <td>${(d.nombre || '')} ${(d.apellidos || '')}</td>
        <td>${d.dni || '—'}</td>
        <td>${d.telefono || '—'}</td>
        <td class="num">S/ ${fmt(+(d.total_prestado ?? 0))}</td>
        <td class="num">S/ ${fmt(+(d.total_pagado ?? 0))}</td>
        <td class="num pendiente">S/ ${fmt(+(d.saldo_pendiente ?? 0))}</td>
        <td>${d.ultimo_pago ? d.ultimo_pago.split('T')[0] : '—'}</td>
      </tr>`
    ).join('');
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Listado de deudores</title>
  <style>
    :root { --ink: #1e293b; --muted: #64748b; --border: #e2e8f0; --header-bg: #0f172a; --success: #059669; --danger: #dc2626; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 11px; color: var(--ink); line-height: 1.4; margin: 0; padding: 24px; background: #fff; }
    @media print { body { padding: 12px; } }
    .doc-header { background: var(--header-bg); color: #fff; padding: 18px 24px; margin: -24px -24px 20px -24px; }
    @media print { .doc-header { margin: -12px -12px 16px -12px; padding: 14px 18px; } }
    .doc-header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: -0.02em; }
    .doc-header .doc-meta { margin-top: 6px; font-size: 11px; opacity: .9; }
    .doc-summary { display: flex; gap: 24px; margin-bottom: 18px; padding: 12px 16px; background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; flex-wrap: wrap; }
    .doc-summary span { font-size: 11px; color: var(--muted); }
    .doc-summary strong { color: var(--ink); }
    .doc-summary .tot-pend { color: var(--danger); font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead { background: var(--header-bg); color: #fff; }
    th { padding: 10px 12px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: .05em; }
    th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
    td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #f1f5f9; }
    @media print { tbody tr:hover { background: inherit; } }
    td.pendiente { font-weight: 600; color: var(--danger); }
    .total-row { background: #f1f5f9 !important; font-weight: 700; border-top: 2px solid var(--border); }
    .total-row td { padding: 12px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 9px; color: var(--muted); text-align: center; }
    .empty-msg { text-align: center; padding: 24px; color: var(--muted); font-style: italic; }
  </style>
</head>
<body>
  <header class="doc-header">
    <h1>Listado de deudores</h1>
    <div class="doc-meta">Generado el ${now} · ${list.length} ${list.length === 1 ? 'deudor' : 'deudores'}</div>
  </header>

  <div class="doc-summary">
    <span>Total prestado: <strong>S/ ${fmt(totalPrestado)}</strong></span>
    <span>Total cobrado: <strong>S/ ${fmt(totalCobrado)}</strong></span>
    <span>Total pendiente: <strong class="tot-pend">S/ ${fmt(totalPendiente)}</strong></span>
  </div>

  <table>
    <thead>
      <tr>
        <th>Deudor</th>
        <th>DNI</th>
        <th>Teléfono</th>
        <th class="num">Prestado</th>
        <th class="num">Cobrado</th>
        <th class="num">Pendiente</th>
        <th>Último pago</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="7" class="empty-msg">No hay deudores para mostrar</td></tr>'}
      <tr class="total-row">
        <td colspan="3">Totales</td>
        <td class="num">S/ ${fmt(totalPrestado)}</td>
        <td class="num">S/ ${fmt(totalCobrado)}</td>
        <td class="num pendiente">S/ ${fmt(totalPendiente)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <footer class="footer">Sistema de Cobros · Listado de deudores generado automáticamente.</footer>
</body>
</html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 400);
    }
    this.notify.success('Abre la ventana de impresión para guardar como PDF');
  }
}
