import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PagosService, PagosFilter } from '../../services/pagos.service';
import { DeudoresService } from '../../services/deudores.service';
import { PrestamosService } from '../../services/prestamos.service';
import { NotificationService } from '../../services/notification.service';
import { ExportService } from '../../services/export.service';
import { OcrComprobanteService } from '../../services/ocr-comprobante.service';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Pago, Deudor, Prestamo } from '../../models/index';
import type { MetodoPago } from '../../models/index';
import { firstValueFrom } from 'rxjs';
import { fechaNoFutura, montoMax, fechaHastaMin } from '../../shared/validators';
import { withLoading } from '../../shared/utils/loading';
import { formatSoles, formatFecha } from '../../shared/utils/format';
import { generarQrDataUrl } from '../../shared/utils/qr';
import { ModalFocusDirective } from '../../shared/directives/modal-focus.directive';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, FormatNumberPipe, SkeletonComponent, ModalFocusDirective],
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.css'
})
export class PagosComponent implements OnInit {
  private pagosService = inject(PagosService);
  private deudoresService = inject(DeudoresService);
  private prestamosService = inject(PrestamosService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private notify = inject(NotificationService);
  private exportService = inject(ExportService);
  private ocrService = inject(OcrComprobanteService);

  pagos: Pago[] = [];
  deudores: Deudor[] = [];
  loading = true;
  loadingMore = false;
  totalPagos = 0;
  currentPage = 1;
  readonly PAGE_SIZE = 50;
  filters = this.fb.group({
    desde: [''],
    hasta: ['', fechaHastaMin('desde')],
    metodo: [''],
    deudor_id: [''],
    concepto: ['']
  });

  // Modal de vista previa
  modalVisible = false;
  pagoPreview: Pago | null = null;
  pagoForm = this.fb.group({
    deudor_id: [null as number | null, Validators.required],
    prestamo_id: [null as number | null],
    concepto: [''],
    monto: [null as number | null, [Validators.required, Validators.min(0.01), montoMax(999_999.99)]],
    metodo_pago: ['efectivo', Validators.required],
    fecha_pago: [new Date().toISOString().split('T')[0], [Validators.required, fechaNoFutura()]],
    numero_operacion: ['']
  });
  prestamosDeudor: Prestamo[] = [];
  /** true si el pago en edición ya estaba asociado a un préstamo (no se puede cambiar) */
  prestamoYaAsociado = false;
  imagenFile: File | null = null;
  imagenPreview: string | null = null;
  imgError = '';
  ocrLoading = false;
  modoModal: 'crear' | 'editar' = 'crear';

  sortBy: 'fecha' | 'deudor' | 'monto' | 'metodo' = 'fecha';
  sortDir: 'asc' | 'desc' = 'desc';

  get total(): number {
    return this.pagosOrdenados.reduce((s, p) => s + +(p.monto || 0), 0);
  }

  get pagosOrdenados(): Pago[] {
    let list = [...this.pagos];
    const conceptoQ = (this.filters.get('concepto')?.value || '').trim().toLowerCase();
    if (conceptoQ) {
      list = list.filter(p => (p.concepto || '').toLowerCase().includes(conceptoQ));
    }
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      switch (this.sortBy) {
        case 'fecha': cmp = (a.fecha_pago || '').localeCompare(b.fecha_pago || ''); break;
        case 'deudor': cmp = (a.deudor_nombre || '').localeCompare(b.deudor_nombre || ''); break;
        case 'monto': cmp = +(a.monto ?? 0) - +(b.monto ?? 0); break;
        case 'metodo': cmp = (a.metodo_pago || '').localeCompare(b.metodo_pago || ''); break;
      }
      return dir * cmp;
    });
  }

  setSort(col: typeof this.sortBy): void {
    if (this.sortBy === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortBy = col; this.sortDir = 'asc'; }
    this.cdr.detectChanges();
  }

  get hayMasPagos(): boolean {
    return this.pagos.length < this.totalPagos && !this.loading && !this.loadingMore;
  }

  get cantidadVerMas(): number {
    const rest = this.totalPagos - this.pagos.length;
    return Math.min(this.PAGE_SIZE, rest);
  }

  ngOnInit(): void {
    this.deudoresService.getAll().subscribe(d => { this.deudores = d; this.cdr.detectChanges(); });
    this.buscar();
    this.filters.get('desde')?.valueChanges?.subscribe(() => this.filters.get('hasta')?.updateValueAndValidity());
    this.pagoForm.get('deudor_id')?.valueChanges.subscribe(deudorId => this.cargarPrestamosDeudor(deudorId));
  }

  /** Carga los préstamos activos/con saldo del deudor seleccionado, para poder asociar el pago a uno. */
  cargarPrestamosDeudor(deudorId: number | null): void {
    this.prestamosDeudor = [];
    if (this.pagoForm.get('prestamo_id')?.value && !this.prestamoYaAsociado) {
      this.pagoForm.patchValue({ prestamo_id: null });
    }
    if (!deudorId) { this.cdr.detectChanges(); return; }
    this.prestamosService.getAll(deudorId).subscribe(prestamos => {
      this.prestamosDeudor = prestamos.filter(p => +(p.saldo_pendiente ?? 0) > 0.01);
      this.cdr.detectChanges();
    });
  }

  buscar(): void {
    if (this.filters.invalid && this.filters.get('hasta')?.hasError('fechaHastaMenor')) {
      this.notify.error('La fecha "Hasta" debe ser mayor o igual que "Desde"');
      return;
    }
    this.loading = true;
    this.currentPage = 1;
    const v = this.filters.value as { desde?: string; hasta?: string; metodo?: string; deudor_id?: string | number };
    const filters: PagosFilter = { limit: this.PAGE_SIZE, page: 1 };
    if (v.desde) filters.desde = v.desde;
    if (v.hasta) filters.hasta = v.hasta;
    if (v.metodo) filters.metodo = v.metodo;
    const did = v.deudor_id != null && v.deudor_id !== '' ? +v.deudor_id : undefined;
    if (did && !isNaN(did)) filters.deudor_id = did;
    this.pagosService.getAll(filters).subscribe(withLoading(this.cdr, v => this.loading = v, {
      next: (r) => {
        this.pagos = r.data;
        this.totalPagos = r.total ?? r.data.length;
      }
    }));
  }

  cargarMas(): void {
    if (this.loadingMore || this.pagos.length >= this.totalPagos) return;
    this.loadingMore = true;
    const v = this.filters.value as { desde?: string; hasta?: string; metodo?: string; deudor_id?: string | number };
    const nextPage = this.currentPage + 1;
    const filters: PagosFilter = { limit: this.PAGE_SIZE, page: nextPage };
    if (v.desde) filters.desde = v.desde;
    if (v.hasta) filters.hasta = v.hasta;
    if (v.metodo) filters.metodo = v.metodo;
    const did = v.deudor_id != null && v.deudor_id !== '' ? +v.deudor_id : undefined;
    if (did && !isNaN(did)) filters.deudor_id = did;
    this.pagosService.getAll(filters).subscribe({
      next: (r) => {
        this.pagos = [...this.pagos, ...r.data];
        this.currentPage = nextPage;
        this.totalPagos = r.total ?? this.pagos.length;
        this.loadingMore = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingMore = false; this.cdr.detectChanges(); }
    });
  }

  limpiar(): void {
    this.filters.reset({ desde: '', hasta: '', metodo: '', deudor_id: '', concepto: '' });
    this.buscar();
  }

  aplicarFiltroConcepto(): void {
    this.cdr.detectChanges();
  }

  abrirCrear(): void {
    this.modoModal = 'crear';
    this.pagoPreview = null;
    this.imagenFile = null;
    this.imagenPreview = null;
    this.imgError = '';
    this.prestamoYaAsociado = false;
    this.prestamosDeudor = [];
    this.pagoForm.reset({
      deudor_id: null,
      prestamo_id: null,
      concepto: '',
      monto: null,
      metodo_pago: 'efectivo',
      fecha_pago: new Date().toISOString().split('T')[0],
      numero_operacion: ''
    });
    this.pagoForm.get('prestamo_id')?.enable();
    this.modalVisible = true;
    this.cdr.detectChanges();
  }

  abrirEditar(pago: Pago): void {
    this.modoModal = 'editar';
    this.pagoPreview = { ...pago };
    this.imagenFile = null;
    this.imagenPreview = null;
    this.imgError = '';
    this.prestamoYaAsociado = !!pago.prestamo_id;
    this.prestamosDeudor = [];
    this.pagoForm.patchValue({
      deudor_id: pago.deudor_id,
      prestamo_id: pago.prestamo_id ?? null,
      concepto: pago.concepto || '',
      monto: pago.monto ?? null,
      metodo_pago: pago.metodo_pago || 'efectivo',
      fecha_pago: pago.fecha_pago ? pago.fecha_pago.split('T')[0] : '',
      numero_operacion: pago.numero_operacion || ''
    }, { emitEvent: false });
    if (this.prestamoYaAsociado) {
      this.pagoForm.get('prestamo_id')?.disable();
      this.prestamosService.getAll(pago.deudor_id).subscribe(prestamos => {
        this.prestamosDeudor = prestamos;
        this.cdr.detectChanges();
      });
    } else {
      this.pagoForm.get('prestamo_id')?.enable();
      this.cargarPrestamosDeudor(pago.deudor_id);
    }
    this.modalVisible = true;
    this.cdr.detectChanges();
  }

  get selectedDeudor(): Deudor | undefined {
    const id = this.pagoForm.get('deudor_id')?.value;
    return id != null ? this.deudores.find(d => d.id === id) : undefined;
  }

  /** Saldo pendiente del deudor seleccionado (para advertencia en modal) */
  get saldoDeudorSeleccionado(): number {
    const d = this.selectedDeudor;
    return d != null ? +(d.saldo_pendiente ?? 0) : 0;
  }

  /** True si el monto del pago supera el saldo del deudor seleccionado */
  get pagoMontoExcedeSaldoDeudor(): boolean {
    const monto = Number(this.pagoForm.get('monto')?.value);
    if (!monto || isNaN(monto)) return false;
    const saldo = this.saldoDeudorSeleccionado;
    if (saldo <= 0) return false;
    return monto > saldo;
  }

  onFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    if (f) this.validateAndSetFile(f);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    let f = e.dataTransfer?.files?.[0];
    if (!f) {
      const item = Array.from(e.dataTransfer?.items ?? []).find(i => i.kind === 'file');
      f = item?.getAsFile() ?? undefined;
    }
    if (f) {
      this.validateAndSetFile(f);
    } else {
      this.imgError = 'No se pudo leer el archivo arrastrado. Intenta arrastrar la imagen desde el explorador de archivos.';
      this.cdr.detectChanges();
    }
  }

  validateAndSetFile(file: File): void {
    this.imgError = '';
    if (!file.type.startsWith('image/')) {
      this.imgError = 'Solo imágenes PNG/JPG';
      this.cdr.detectChanges();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.imgError = 'Máximo 5MB';
      this.cdr.detectChanges();
      return;
    }
    this.imagenFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.imagenPreview = (ev.target?.result as string) ?? null;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  removeImage(e: Event): void {
    e.stopPropagation();
    this.imagenFile = null;
    this.imagenPreview = null;
    this.imgError = '';
    this.cdr.detectChanges();
  }

  async extraerDatosPago(): Promise<void> {
    if (!this.imagenPreview || this.ocrLoading) return;
    this.ocrLoading = true;
    this.cdr.detectChanges();
    try {
      const datos = await this.ocrService.extraerDatos(this.imagenPreview);
      const patch: Record<string, unknown> = {};
      if (datos.monto != null) patch['monto'] = datos.monto;
      if (datos.fecha) patch['fecha_pago'] = datos.fecha;
      if (datos.numero_operacion) patch['numero_operacion'] = datos.numero_operacion;
      if (datos.concepto) patch['concepto'] = datos.concepto;
      if (datos.metodo_pago) patch['metodo_pago'] = datos.metodo_pago;
      if (Object.keys(patch).length) {
        this.pagoForm.patchValue(patch);
        this.notify.success('Datos extraídos. Revisa y completa si falta algo.');
      } else {
        this.notify.info('No se detectaron datos en la imagen. Prueba con otra foto más clara.');
      }
    } catch (e) {
      this.notify.error('No se pudo leer la imagen. Verifica que sea un comprobante legible.');
      console.error(e);
    } finally {
      this.ocrLoading = false;
      this.cdr.detectChanges();
    }
  }

  get previewData(): { deudor_nombre: string; concepto: string; monto: number; metodo_pago: string; fecha_pago: string; numero_operacion: string } {
    const v = this.pagoForm.value as { deudor_id?: number; concepto?: string; monto?: number; metodo_pago?: string; fecha_pago?: string; numero_operacion?: string };
    const d = this.selectedDeudor;
    return {
      deudor_nombre: d ? `${d.nombre} ${d.apellidos || ''}`.trim() || '-' : '-',
      concepto: v.concepto || '-',
      monto: v.monto ?? 0,
      metodo_pago: v.metodo_pago || '-',
      fecha_pago: v.fecha_pago || '',
      numero_operacion: v.numero_operacion || '-'
    };
  }

  confirmarGuardar(force = false): void {
    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      this.notify.error('Completa los campos requeridos');
      this.cdr.detectChanges();
      return;
    }
    const v = this.pagoForm.value as { deudor_id: number; prestamo_id?: number | null; concepto?: string; monto: number; metodo_pago: string; fecha_pago: string; numero_operacion?: string };
    if (this.modoModal === 'crear') {
      const fd = new FormData();
      fd.append('deudor_id', String(v.deudor_id));
      if (v.prestamo_id) fd.append('prestamo_id', String(v.prestamo_id));
      fd.append('fecha_pago', v.fecha_pago);
      fd.append('monto', String(v.monto));
      fd.append('metodo_pago', v.metodo_pago);
      if (v.numero_operacion) fd.append('numero_operacion', v.numero_operacion);
      if (v.concepto) fd.append('concepto', v.concepto);
      if (this.imagenFile) fd.append('imagen', this.imagenFile);
      if (force) fd.append('force', 'true');
      this.pagosService.createWithFormData(fd).subscribe({
        next: () => { this.cerrarModal(); this.buscar(); this.notify.success('Pago creado'); },
        error: (e) => {
          if (e.status === 409 && e.error?.duplicado) {
            const ex = e.error.pago_existente;
            const fechaEx = ex?.fecha_pago ? String(ex.fecha_pago).split('T')[0] : '';
            const msg = `Ya existe un pago similar registrado (S/ ${ex?.monto} el ${fechaEx}${ex?.numero_operacion ? `, N° op. ${ex.numero_operacion}` : ''}). ¿Deseas registrarlo de todas formas?`;
            if (confirm(msg)) {
              this.confirmarGuardar(true);
              return;
            }
            this.cdr.detectChanges();
            return;
          }
          this.notify.error(e.error?.error || 'Error al crear pago'); this.cdr.detectChanges();
        }
      });
    } else if (this.pagoPreview?.id) {
      if (this.imagenFile) {
        const fd = new FormData();
        fd.append('fecha_pago', v.fecha_pago);
        fd.append('monto', String(v.monto));
        fd.append('metodo_pago', v.metodo_pago);
        if (v.numero_operacion) fd.append('numero_operacion', v.numero_operacion);
        if (v.concepto) fd.append('concepto', v.concepto);
        if (!this.prestamoYaAsociado && v.prestamo_id) fd.append('prestamo_id', String(v.prestamo_id));
        fd.append('imagen', this.imagenFile);
        this.pagosService.updateWithFormData(this.pagoPreview.id, fd).subscribe({
          next: () => { this.cerrarModal(); this.buscar(); this.notify.success('Pago actualizado'); },
          error: (e) => { this.notify.error(e.error?.error || 'Error al actualizar'); this.cdr.detectChanges(); }
        });
      } else {
        this.pagosService.update(this.pagoPreview.id, {
          fecha_pago: v.fecha_pago,
          monto: v.monto,
          metodo_pago: v.metodo_pago as MetodoPago,
          numero_operacion: v.numero_operacion || undefined,
          concepto: v.concepto || undefined,
          ...(!this.prestamoYaAsociado && v.prestamo_id ? { prestamo_id: v.prestamo_id } : {})
        }).subscribe({
          next: () => { this.cerrarModal(); this.buscar(); this.notify.success('Pago actualizado'); },
          error: (e) => { this.notify.error(e.error?.error || 'Error al actualizar'); this.cdr.detectChanges(); }
        });
      }
    }
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.pagoPreview = null;
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.modalVisible) this.cerrarModal();
  }

  exportExcel(): void {
    const list = this.pagosOrdenados;
    const rows: (string | number)[][] = [
      ['#', 'Fecha', 'Deudor', 'Concepto', 'Monto', 'Metodo', 'N Operacion']
    ];
    list.forEach((p, i) => {
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
    const total = list.reduce((s, p) => s + +(p.monto || 0), 0);
    rows.push(['', '', '', 'TOTAL', total, '', '']);
    this.exportService.downloadCsv(rows, 'pagos_' + new Date().toISOString().split('T')[0] + '.csv');
  }

  async generarComprobante(p: Pago): Promise<void> {
    const fechaGen = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // Obtener el saldo pendiente actualizado (del préstamo afectado, o el total del cliente)
    let saldoInfo: { label: string; saldo: number } | null = null;
    let prestamoInfo: Prestamo | undefined;
    try {
      const deudor = await firstValueFrom(this.deudoresService.getById(p.deudor_id));
      prestamoInfo = p.prestamo_id ? deudor.prestamos?.find(pr => pr.id === p.prestamo_id) : undefined;
      if (prestamoInfo) {
        saldoInfo = { label: 'Saldo pendiente de este préstamo', saldo: +(prestamoInfo.saldo_pendiente ?? 0) };
      } else {
        saldoInfo = { label: 'Saldo pendiente total', saldo: +(deudor.saldo_pendiente ?? 0) };
      }
    } catch (e) {
      console.error(e);
    }

    const TIPO_LABELS: Record<string, string> = {
      prestamo_personal: 'Personal',
      prestamo_bancario: 'Bancario',
      pandero: 'Pandero',
      otro: 'Otro'
    };

    const qrTexto = [
      'Comprobante de pago',
      `N°: ${p.id}`,
      `Deudor: ${p.deudor_nombre || '—'}`,
      `Monto: ${formatSoles(p.monto)}`,
      `Fecha: ${formatFecha(p.fecha_pago)}`,
      `Método: ${p.metodo_pago}`,
      `N° operación: ${p.numero_operacion || '—'}`,
      ...(saldoInfo ? [`${saldoInfo.label}: ${saldoInfo.saldo > 0 ? formatSoles(saldoInfo.saldo) : 'S/ 0.00 (cancelado)'}`] : [])
    ].join('\n');

    let qrImg = '';
    try {
      qrImg = await generarQrDataUrl(qrTexto);
    } catch (e) {
      console.error(e);
    }

    const esYapePlin = p.metodo_pago === 'yape' || p.metodo_pago === 'plin';
    const baseUrl = environment.apiUrl.replace(/\/api$/, '');
    const imagenComprobanteUrl = esYapePlin && p.imagen_url
      ? (p.imagen_url.startsWith('http') ? p.imagen_url : baseUrl + p.imagen_url)
      : null;

    const filasCuotas = (p.cuotas_aplicadas ?? []).map(c => `
      <tr>
        <td class="text-center num">${c.numero_cuota}</td>
        <td class="text-right num">${formatSoles(c.monto_aplicado)}</td>
        <td class="text-right num">${formatSoles(c.capital_aplicado ?? 0)}</td>
        <td class="text-right num">${formatSoles(c.interes_aplicado ?? 0)}</td>
        <td class="text-right num">${formatSoles(c.monto_pagado)} / ${formatSoles(c.monto_esperado)}</td>
        <td class="text-center"><span class="badge badge-${c.estado}">${c.estado}</span></td>
        <td class="text-right num">${c.saldo_restante > 0 ? formatSoles(c.saldo_restante) : '—'}</td>
      </tr>`).join('');

    const interesEstePago = (p.cuotas_aplicadas ?? []).reduce((s, c) => s + (c.interes_aplicado ?? 0), 0);
    const capitalEstePago = (p.cuotas_aplicadas ?? []).reduce((s, c) => s + (c.capital_aplicado ?? 0), 0);

    const nombreDeudor = (p.deudor_nombre || '—').replace(/</g, '&lt;');

    const html = `
      <div class="recibo-topbar"></div>
      <div class="recibo-header">
        <div class="recibo-brand-row">
          <div class="recibo-mark">D</div>
          <div>
            <h1 class="recibo-brand">DALP Cobros</h1>
            <p class="recibo-sub">Comprobante de pago</p>
          </div>
        </div>
        <div class="recibo-badge-wrap">
          <span class="recibo-badge">✓ Pago registrado</span>
          <p class="recibo-num">N° ${String(p.id).padStart(6, '0')}</p>
        </div>
      </div>

      <div class="recibo-monto-row">
        <div class="recibo-monto-box">
          <span class="recibo-monto-label">Monto pagado</span>
          <span class="recibo-monto">${formatSoles(p.monto)}</span>
        </div>
        ${saldoInfo ? `
        <div class="recibo-monto-box ${saldoInfo.saldo > 0 ? 'recibo-saldo-pendiente' : 'recibo-saldo-ok'}">
          <span class="recibo-monto-label">${saldoInfo.label}</span>
          <span class="recibo-monto recibo-monto-sm">${saldoInfo.saldo > 0 ? formatSoles(saldoInfo.saldo) : '¡Cancelado!'}</span>
        </div>` : ''}
      </div>

      <div style="display:flex; gap:24px; align-items:flex-start;">
        <div class="recibo-grid" style="flex:1;">
          <div class="recibo-item"><span class="lbl">Cliente</span><span class="val">${nombreDeudor}</span></div>
          <div class="recibo-item"><span class="lbl">Fecha de pago</span><span class="val">${formatFecha(p.fecha_pago)}</span></div>
          <div class="recibo-item"><span class="lbl">Método de pago</span><span class="val">${(p.metodo_pago || '—')}</span></div>
          <div class="recibo-item"><span class="lbl">N° de operación</span><span class="val">${p.numero_operacion || '—'}</span></div>
          <div class="recibo-item" style="grid-column: 1 / -1;"><span class="lbl">Concepto</span><span class="val">${(p.concepto || '—').replace(/</g, '&lt;')}</span></div>
        </div>
        ${qrImg ? `<div class="recibo-qr-wrap"><img src="${qrImg}" alt="Código QR del comprobante" style="width:120px;height:120px;" /><p class="report-meta" style="margin-top:6px;">Escanea para verificar</p></div>` : ''}
      </div>

      ${filasCuotas ? `
      <div class="recibo-resumen-pago">
        <p class="recibo-resumen-titulo">¿Cómo se aplicó tu pago de ${formatSoles(p.monto)}?</p>
        <div class="recibo-resumen-row">
          <div class="recibo-resumen-item">
            <span class="lbl">Para reducir tu deuda (capital)</span>
            <span class="val">${formatSoles(capitalEstePago)}</span>
          </div>
          <div class="recibo-resumen-item">
            <span class="lbl">Para el interés del préstamo</span>
            <span class="val">${formatSoles(interesEstePago)}</span>
          </div>
        </div>
      </div>` : ''}

      ${prestamoInfo ? `
      <h2 class="report-meta" style="margin-top:12px; font-weight:600;">Préstamo afectado</h2>
      <div class="recibo-grid" style="margin-top:6px;">
        <div class="recibo-item"><span class="lbl">Tipo</span><span class="val">${TIPO_LABELS[prestamoInfo.tipo] || prestamoInfo.tipo}</span></div>
        <div class="recibo-item"><span class="lbl">Descripción</span><span class="val">${(prestamoInfo.descripcion || '—').replace(/</g, '&lt;')}</span></div>
        <div class="recibo-item"><span class="lbl">Capital prestado</span><span class="val">${formatSoles(prestamoInfo.monto_original)}</span></div>
        <div class="recibo-item"><span class="lbl">Monto total a pagar (capital + interés)</span><span class="val">${formatSoles((+prestamoInfo.monto_original || 0) + (+(prestamoInfo.interes_total ?? 0)))}</span></div>
        <div class="recibo-item"><span class="lbl">Total pagado hasta hoy</span><span class="val">${formatSoles(prestamoInfo.total_pagado ?? 0)}</span></div>
        <div class="recibo-item"><span class="lbl">Saldo pendiente</span><span class="val">${(prestamoInfo.saldo_pendiente ?? 0) > 0 ? formatSoles(prestamoInfo.saldo_pendiente ?? 0) : 'Cancelado'}</span></div>
        <div class="recibo-item"><span class="lbl">Estado del préstamo</span><span class="val"><span class="badge badge-${prestamoInfo.estado}">${prestamoInfo.estado}</span></span></div>
      </div>` : ''}

      ${filasCuotas ? `
      <div class="recibo-detalle-cuotas">
      <h2 class="report-meta" style="margin-top:12px; font-weight:600;">Detalle por cuota</h2>
      <table style="margin-top:8px;">
        <thead>
          <tr><th class="text-center">N° cuota</th><th class="text-right">Abonado este pago</th><th class="text-right">A capital</th><th class="text-right">A interés</th><th class="text-right">Cuota: pagado / total</th><th class="text-center">Estado</th><th class="text-right">Saldo de la cuota</th></tr>
        </thead>
        <tbody>
          ${filasCuotas}
          <tr class="total-row">
            <td><strong>Total de este pago</strong></td>
            <td class="text-right num">${formatSoles(p.monto)}</td>
            <td class="text-right num">${formatSoles(capitalEstePago)}</td>
            <td class="text-right num">${formatSoles(interesEstePago)}</td>
            <td colspan="3"></td>
          </tr>
        </tbody>
      </table>
      </div>` : ''}

      ${imagenComprobanteUrl ? `
      <div class="recibo-evidencia">
        <p class="recibo-evidencia-titulo">📱 Captura de ${p.metodo_pago === 'yape' ? 'Yape' : 'Plin'}</p>
        <img src="${imagenComprobanteUrl}" alt="Captura del pago por ${p.metodo_pago}" class="recibo-evidencia-img" />
      </div>` : ''}

      <div class="recibo-footer">
        <p class="recibo-thanks">¡Gracias por tu pago!</p>
        Este comprobante es un respaldo del pago registrado en DALP Cobros y conserva validez como constancia.<br>
        Generado el ${fechaGen}
      </div>`;

    const filename = 'comprobante_pago_' + p.id + '.pdf';
    this.exportService.downloadPdfFromHtml(html, filename);
  }
}
