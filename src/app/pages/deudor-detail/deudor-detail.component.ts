import { Component, OnInit, AfterViewInit, inject, ChangeDetectorRef, HostListener, ElementRef, ViewChild } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { DeudoresService } from '../../services/deudores.service';
import { PagosService } from '../../services/pagos.service';
import { PrestamosService } from '../../services/prestamos.service';
import { NotificationService } from '../../services/notification.service';
import { AlertasService } from '../../services/alertas.service';
import { ExportService } from '../../services/export.service';
import { OcrComprobanteService } from '../../services/ocr-comprobante.service';
import { ImagePreviewButtonComponent } from '../../shared/image-preview-button/image-preview-button.component';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Deudor, Pago, Prestamo, Cuota } from '../../models/index';
import { fechaNoFutura, montoMax, fechaFinMin, tasaInteresRango } from '../../shared/validators';

@Component({
  selector: 'app-deudor-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, ImagePreviewButtonComponent, FormatNumberPipe, SkeletonComponent],
  templateUrl: './deudor-detail.component.html',
  styleUrl: './deudor-detail.component.css'
})
export class DeudorDetailComponent implements OnInit, AfterViewInit {
  @ViewChild('evolucionChart') evolucionChartRef!: ElementRef<HTMLCanvasElement>;
  private route = inject(ActivatedRoute);
  private deudoresService = inject(DeudoresService);
  private pagosService = inject(PagosService);
  private prestamosService = inject(PrestamosService);
  private fb = inject(FormBuilder);
  cdr = inject(ChangeDetectorRef);
  private notify = inject(NotificationService);
  private alertasService = inject(AlertasService);
  private exportService = inject(ExportService);
  private ocrService = inject(OcrComprobanteService);

  deudor: Deudor | null = null;
  loading = true;

  saving = false; pagoOk = false; pagoErr = ''; pagoSubmitted = false;
  imagenFile: File | null = null; imagenPreview: string | null = null; imgError = '';
  ocrLoading = false;

  showPrestamo = false; savingPrestamo = false; prestamoOk = false; prestamoErr = ''; prestamoSubmitted = false;

  imgModal: string | null = null;
  editPago: Pago | null = null; savingEdit = false; editPagoErr = '';
  editImagenFile: File | null = null; editImagenPreview: string | null = null; editImagenError = ''; editRemoveImage = false;
  ocrEditLoading = false;
  deletePago: Pago | null = null; deleting = false;

  cronogramaPrestamo: Prestamo | null = null;
  cuotasCronograma: Cuota[] = [];
  loadingCuotas = false;

  editPrestamo: Prestamo | null = null;
  editPrestamoForm = this.fb.group({ estado: [''], notas: [''] });
  editPrestamoErr = '';
  savingEditPrestamo = false;

  exporting = false;
  enviandoWhatsApp = false;

  /** Cobrado: suma de pagos del deudor; si no hay array, usa el valor del API */
  get totalCobrado(): number {
    const d = this.deudor;
    if (!d) return 0;
    if (d.pagos?.length) return d.pagos.reduce((s, p) => s + +(p.monto ?? 0), 0);
    return +(d.total_pagado ?? 0);
  }

  /** Total prestado: suma de montos originales de préstamos; si no hay array, usa el valor del API */
  get totalPrestado(): number {
    const d = this.deudor;
    if (!d) return 0;
    if (d.prestamos?.length) return d.prestamos.reduce((s, p) => s + +(p.monto_original ?? 0), 0);
    return +(d.total_prestado ?? 0);
  }

  /** Saldo pendiente: total prestado - cobrado */
  get saldoPendiente(): number {
    return this.totalPrestado - this.totalCobrado;
  }

  /** Puntos para el gráfico de evolución del saldo (fecha, saldo acumulado) */
  get evolucionSaldo(): { fecha: string; saldo: number }[] {
    const d = this.deudor;
    if (!d?.prestamos?.length && !d?.pagos?.length) return [];
    const dates = new Set<string>();
    (d.prestamos || []).forEach(p => { if (p.fecha_inicio) dates.add(p.fecha_inicio.split('T')[0]); });
    (d.pagos || []).forEach(p => { if (p.fecha_pago) dates.add(p.fecha_pago.split('T')[0]); });
    const sorted = Array.from(dates).sort();
    if (sorted.length === 0) return [];
    const points: { fecha: string; saldo: number }[] = [];
    for (const fecha of sorted) {
      const prestadoHasta = (d.prestamos || []).reduce((s, p) => s + (p.fecha_inicio && p.fecha_inicio.split('T')[0] <= fecha ? +(p.monto_original ?? 0) : 0), 0);
      const pagadoHasta = (d.pagos || []).reduce((s, p) => s + (p.fecha_pago && p.fecha_pago.split('T')[0] <= fecha ? +(p.monto ?? 0) : 0), 0);
      points.push({ fecha, saldo: prestadoHasta - pagadoHasta });
    }
    const hoy = new Date().toISOString().split('T')[0];
    if (points.length && points[points.length - 1].fecha < hoy) {
      points.push({ fecha: hoy, saldo: this.saldoPendiente });
    }
    return points;
  }

  pagoForm = this.fb.group({
    prestamo_id: [null],
    fecha_pago: [new Date().toISOString().split('T')[0], [Validators.required, fechaNoFutura()]],
    monto: [null, [Validators.required, Validators.min(0.01), montoMax(999_999.99)]],
    metodo_pago: ['', Validators.required],
    numero_operacion: [''], concepto: ['']
  });

  prestamoForm = this.fb.group({
    tipo: ['', Validators.required],
    monto_original: [null, [Validators.required, Validators.min(0.01), montoMax(10_000_000)]],
    fecha_inicio: [new Date().toISOString().split('T')[0], Validators.required],
    fecha_fin: ['', fechaFinMin('fecha_inicio')], tasa_interes: [0, tasaInteresRango()], cuota_mensual: [null],
    total_cuotas: [1], banco: [''], numero_operacion: [''],
    descripcion: [''], notas: ['']
  });

  editPagoForm = this.fb.group({
    fecha_pago: ['', [Validators.required, fechaNoFutura()]],
    monto: [0 as number | null, [Validators.required, Validators.min(0.01), montoMax(999_999.99)]],
    metodo_pago: ['', Validators.required],
    numero_operacion: [''], concepto: ['']
  });

  /** Préstamo seleccionado en el formulario de pago */
  get prestamoSeleccionadoPago(): Prestamo | null {
    const id = this.pagoForm.get('prestamo_id')?.value;
    if (id == null || !this.deudor?.prestamos?.length) return null;
    return this.deudor.prestamos.find(p => p.id === id) ?? null;
  }

  /** Saldo pendiente del préstamo seleccionado (0 si no hay préstamo) */
  get saldoPrestamoSeleccionado(): number {
    const p = this.prestamoSeleccionadoPago;
    return p != null ? +(p.saldo_pendiente ?? 0) : 0;
  }

  /** True si el monto del pago supera el saldo del préstamo seleccionado (advertencia) */
  get pagoMontoExcedeSaldo(): boolean {
    const monto = Number(this.pagoForm.get('monto')?.value);
    if (!monto || isNaN(monto)) return false;
    const saldo = this.saldoPrestamoSeleccionado;
    if (saldo <= 0) return false; // sin préstamo o ya pagado, no advertir
    return monto > saldo;
  }

  ngOnInit(): void {
    this.load();
    this.prestamoForm.get('fecha_inicio')?.valueChanges?.subscribe(() => {
      this.prestamoForm.get('fecha_fin')?.updateValueAndValidity();
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.drawEvolucionChart(), 200);
  }

  load(): void {
    this.loading = true;
    const id = +this.route.snapshot.params['id'];
    this.deudoresService.getById(id).subscribe({
      next: (d) => {
        this.deudor = d;
        let pending = 2;
        const done = () => { pending--; if (pending === 0) { this.loading = false; this.cdr.detectChanges(); setTimeout(() => this.drawEvolucionChart(), 100); } };
        this.pagosService.getAll({ deudor_id: id, limit: 2000 }).subscribe({
          next: (r) => { if (this.deudor) this.deudor = { ...this.deudor, pagos: r.data || [] }; done(); this.cdr.detectChanges(); },
          error: () => done()
        });
        this.prestamosService.getAll(id).subscribe({
          next: (prestamos) => { if (this.deudor) this.deudor = { ...this.deudor, prestamos: prestamos || [] }; done(); this.cdr.detectChanges(); },
          error: () => done()
        });
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  imgUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return environment.apiUrl.replace(/\/api$/, '') + url;
  }

  verImagen(url: string): void { this.imgModal = this.imgUrl(url); this.cdr.detectChanges(); }

  editarPago(p: Pago): void {
    this.editPago = p; this.editPagoErr = '';
    this.editImagenFile = null;
    this.editImagenError = '';
    this.editRemoveImage = false;
    this.editImagenPreview = p.imagen_url ? this.imgUrl(p.imagen_url) : null;
    const fecha = p.fecha_pago ? p.fecha_pago.split('T')[0] : '';
    this.editPagoForm.setValue({ fecha_pago: fecha, monto: p.monto, metodo_pago: p.metodo_pago, numero_operacion: p.numero_operacion || '', concepto: p.concepto || '' });
    this.cdr.detectChanges();
  }

  cerrarEditPago(): void { this.editPago = null; this.cdr.detectChanges(); }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.imgModal) { this.imgModal = null; this.cdr.detectChanges(); }
    else if (this.editPago) this.cerrarEditPago();
    else if (this.deletePago) { this.deletePago = null; this.cdr.detectChanges(); }
    else if (this.cronogramaPrestamo) this.cerrarCronograma();
    else if (this.editPrestamo) this.cerrarEditarPrestamo();
  }

  onEditFileChange(e: any): void { const f = e.target.files?.[0]; if (f) this.validateAndSetEditFile(f); }
  onEditDrop(e: DragEvent): void { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) this.validateAndSetEditFile(f); }

  validateAndSetEditFile(file: File): void {
    this.editImagenError = '';
    if (!file.type.startsWith('image/')) { this.editImagenError = 'Solo imagenes PNG/JPG'; this.cdr.detectChanges(); return; }
    if (file.size > 5 * 1024 * 1024) { this.editImagenError = 'Maximo 5MB'; this.cdr.detectChanges(); return; }
    this.editImagenFile = file;
    this.editRemoveImage = false;
    const reader = new FileReader();
    reader.onload = (ev) => { this.editImagenPreview = ev.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
  }

  removeEditImage(e: Event): void {
    e.stopPropagation();
    this.editImagenFile = null;
    this.editImagenPreview = null;
    this.editRemoveImage = true;
    this.editImagenError = '';
    this.cdr.detectChanges();
  }

  guardarEditPago(): void {
    if (this.editPagoForm.invalid) return;
    this.savingEdit = true; this.editPagoErr = '';
    const v = this.editPagoForm.value as any;
    const fd = new FormData();
    Object.entries(v).forEach(([k, val]) => { if (val != null) fd.append(k, String(val)); });
    if (this.editImagenFile) fd.append('imagen', this.editImagenFile);
    if (this.editRemoveImage) fd.append('remove_imagen', 'true');
    if (!this.editPago) return;
    this.pagosService.updateWithFormData(this.editPago.id, fd).subscribe({
      next: () => { this.savingEdit = false; this.editPago = null; this.load(); this.notify.success('Pago actualizado'); },
      error: (e) => { this.savingEdit = false; this.editPagoErr = e.error?.error || 'Error al actualizar'; this.cdr.detectChanges(); this.notify.error(this.editPagoErr); }
    });
  }

  confirmarEliminar(p: Pago): void { this.deletePago = p; this.cdr.detectChanges(); }

  eliminarPago(): void {
    if (!this.deletePago) return;
    this.deleting = true;
    this.pagosService.delete(this.deletePago.id).subscribe({
      next: () => { this.deleting = false; this.deletePago = null; this.load(); this.notify.success('Pago eliminado'); },
      error: () => { this.deleting = false; this.cdr.detectChanges(); this.notify.error('No se pudo eliminar el pago'); }
    });
  }

  abrirCronograma(p: Prestamo): void {
    this.cronogramaPrestamo = p;
    this.cuotasCronograma = [];
    this.loadingCuotas = true;
    this.cdr.detectChanges();
    this.prestamosService.getCuotas(p.id).subscribe({
      next: (res) => {
        const cuotas = Array.isArray(res) ? res : (res as any)?.data ?? [];
        this.cuotasCronograma = cuotas;
        this.loadingCuotas = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loadingCuotas = false; this.cdr.detectChanges(); this.notify.error('No se pudieron cargar las cuotas'); }
    });
  }

  cerrarCronograma(): void {
    this.cronogramaPrestamo = null;
    this.cuotasCronograma = [];
    this.cdr.detectChanges();
  }

  get cronogramaTotalEsperado(): number {
    return this.cuotasCronograma.reduce((s, c) => s + +(c.monto_esperado ?? 0), 0);
  }
  get cronogramaTotalPagado(): number {
    return this.cuotasCronograma.reduce((s, c) => s + +(c.monto_pagado ?? 0), 0);
  }
  get cronogramaPendiente(): number {
    return this.cronogramaTotalEsperado - this.cronogramaTotalPagado;
  }

  abrirEditarPrestamo(p: Prestamo): void {
    this.editPrestamo = p;
    this.editPrestamoErr = '';
    this.editPrestamoForm.setValue({ estado: p.estado || 'activo', notas: p.notas || '' });
    this.cdr.detectChanges();
  }

  cerrarEditarPrestamo(): void {
    this.editPrestamo = null;
    this.cdr.detectChanges();
  }

  guardarEditarPrestamo(): void {
    if (!this.editPrestamo) return;
    const v = this.editPrestamoForm.value as { estado?: string; notas?: string };
    const estado = (v.estado === 'activo' || v.estado === 'vencido' || v.estado === 'pagado' || v.estado === 'cancelado')
      ? v.estado : 'activo';
    this.savingEditPrestamo = true;
    this.editPrestamoErr = '';
    this.prestamosService.update(this.editPrestamo.id, { estado, notas: v.notas || undefined }).subscribe({
      next: () => {
        this.savingEditPrestamo = false;
        this.editPrestamo = null;
        this.load();
        this.notify.success('Préstamo actualizado');
      },
      error: (e) => {
        this.savingEditPrestamo = false;
        this.editPrestamoErr = e.error?.error || e.error?.message || 'No se pudo actualizar';
        this.cdr.detectChanges();
      }
    });
  }

  togglePrestamo(): void {
    this.showPrestamo = !this.showPrestamo;
    if (!this.showPrestamo) { this.prestamoForm.reset({ fecha_inicio: new Date().toISOString().split('T')[0], tasa_interes: 0, total_cuotas: 1 }); }
    this.cdr.detectChanges();
  }

  pi(f: string): boolean { const c = this.prestamoForm.get(f); return !!(c && c.invalid && (c.touched || this.prestamoSubmitted)); }

  guardarPrestamo(): void {
    this.prestamoSubmitted = true;
    if (this.prestamoForm.invalid) { this.prestamoForm.markAllAsTouched(); this.cdr.detectChanges(); return; }
    this.savingPrestamo = true; this.prestamoErr = '';
    const v = this.prestamoForm.value as any;
    const id = this.route.snapshot.params['id'];
    const body: any = { ...v, deudor_id: +id };
    if (!body.fecha_fin) delete body.fecha_fin;
    if (!body.cuota_mensual) delete body.cuota_mensual;
    this.prestamosService.create(body).subscribe({
      next: () => {
        this.savingPrestamo = false; this.prestamoOk = true; this.prestamoSubmitted = false;
        this.prestamoForm.reset({ fecha_inicio: new Date().toISOString().split('T')[0], tasa_interes: 0, total_cuotas: 1 });
        this.cdr.detectChanges(); this.load(); this.notify.success('Préstamo creado');
        setTimeout(() => { this.prestamoOk = false; this.showPrestamo = false; this.cdr.detectChanges(); }, 2000);
      },
      error: (e) => { this.savingPrestamo = false; this.prestamoErr = e.error?.error || 'Error'; this.cdr.detectChanges(); this.notify.error(this.prestamoErr); }
    });
  }

  fi(f: string): boolean { const c = this.pagoForm.get(f); return !!(c && c.invalid && (c.touched || this.pagoSubmitted)); }

  onFileChange(e: any): void { const f = e.target.files?.[0]; if (f) this.validateAndSetFile(f); }
  onDrop(e: DragEvent): void { e.preventDefault(); const f = e.dataTransfer?.files?.[0]; if (f) this.validateAndSetFile(f); }

  validateAndSetFile(file: File): void {
    this.imgError = '';
    if (!file.type.startsWith('image/')) { this.imgError = 'Solo imagenes PNG/JPG'; this.cdr.detectChanges(); return; }
    if (file.size > 5 * 1024 * 1024) { this.imgError = 'Maximo 5MB'; this.cdr.detectChanges(); return; }
    this.imagenFile = file;
    const reader = new FileReader();
    reader.onload = (ev) => { this.imagenPreview = ev.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
  }

  removeImage(e: Event): void { e.stopPropagation(); this.imagenFile = null; this.imagenPreview = null; this.imgError = ''; }

  async extraerDatosPago(): Promise<void> {
    if (!this.imagenPreview || this.ocrLoading) return;
    this.ocrLoading = true;
    this.cdr.detectChanges();
    try {
      const datos = await this.ocrService.extraerDatos(this.imagenPreview);
      const patch: Record<string, unknown> = {};
      if (datos['monto'] != null) patch['monto'] = datos['monto'];
      if (datos['fecha']) patch['fecha_pago'] = datos['fecha'];
      if (datos['numero_operacion']) patch['numero_operacion'] = datos['numero_operacion'];
      if (datos['concepto']) patch['concepto'] = datos['concepto'];
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

  async extraerDatosEditPago(): Promise<void> {
    if (!this.editImagenPreview || this.ocrEditLoading) return;
    this.ocrEditLoading = true;
    this.cdr.detectChanges();
    try {
      const datos = await this.ocrService.extraerDatos(this.editImagenPreview);
      const patch: Record<string, unknown> = {};
      if (datos['monto'] != null) patch['monto'] = datos['monto'];
      if (datos['fecha']) patch['fecha_pago'] = datos['fecha'];
      if (datos['numero_operacion']) patch['numero_operacion'] = datos['numero_operacion'];
      if (datos['concepto']) patch['concepto'] = datos['concepto'];
      if (Object.keys(patch).length) {
        this.editPagoForm.patchValue(patch);
        this.notify.success('Datos extraídos. Revisa y guarda.');
      } else {
        this.notify.info('No se detectaron datos en la imagen.');
      }
    } catch (e) {
      this.notify.error('No se pudo leer la imagen.');
      console.error(e);
    } finally {
      this.ocrEditLoading = false;
      this.cdr.detectChanges();
    }
  }

  registrarPago(): void {
    this.pagoSubmitted = true;
    if (this.pagoForm.invalid) { this.pagoForm.markAllAsTouched(); this.cdr.detectChanges(); return; }
    this.saving = true; this.pagoErr = ''; this.pagoOk = false;
    const v = this.pagoForm.value as any;
    const id = this.route.snapshot.params['id'];
    const fd = new FormData();
    Object.entries({ ...v, deudor_id: id }).forEach(([k, val]) => { if (val != null) fd.append(k, String(val)); });
    if (this.imagenFile) fd.append('imagen', this.imagenFile);
    this.pagosService.createWithFormData(fd).subscribe({
      next: () => {
        this.saving = false; this.pagoOk = true; this.pagoSubmitted = false;
        this.imagenFile = null; this.imagenPreview = null;
        this.pagoForm.reset({ fecha_pago: new Date().toISOString().split('T')[0] });
        this.cdr.detectChanges(); this.load(); this.notify.success('Pago registrado');
        setTimeout(() => { this.pagoOk = false; this.cdr.detectChanges(); }, 3000);
      },
      error: (e) => { this.saving = false; this.pagoErr = e.error?.error || 'Error'; this.cdr.detectChanges(); this.notify.error(this.pagoErr); }
    });
  }

  drawEvolucionChart(): void {
    const canvas = this.evolucionChartRef?.nativeElement;
    const points = this.evolucionSaldo;
    if (!canvas || !points.length) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth || 400;
    const h = 180;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const pad = { top: 16, right: 10, bottom: 32, left: 56 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const maxSaldo = Math.max(...points.map(p => p.saldo), 1);
    const minSaldo = Math.min(0, ...points.map(p => p.saldo));
    const range = maxSaldo - minSaldo || 1;
    ctx.strokeStyle = '#4f8ef7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = pad.left + (chartW / (points.length - 1 || 1)) * i;
      const y = pad.top + chartH - ((p.saldo - minSaldo) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = '#7a839e';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    points.forEach((p, i) => {
      const x = pad.left + (chartW / (points.length - 1 || 1)) * i;
      const label = p.fecha.slice(0, 7);
      ctx.fillText(label, x, h - pad.bottom + 12);
    });
  }

  enviarRecordatorioWhatsApp(): void {
    if (!this.deudor) return;
    if (!this.deudor.telefono) {
      this.notify.error('Este deudor no tiene teléfono registrado.');
      return;
    }
    this.enviandoWhatsApp = true;
    this.cdr.detectChanges();
    const saldo = this.saldoPendiente;
    const titulo = '📋 *Recordatorio de cobro*\n\n';
    const mensaje = saldo > 0
      ? titulo + `Hola ${this.deudor.nombre}, le recordamos que tiene un saldo pendiente de S/ ${saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}. ¿Podría regularizar? Gracias.`
      : undefined;
    this.alertasService.enviarWhatsApp({ deudor_id: this.deudor.id, mensaje }).subscribe({
      next: () => {
        this.enviandoWhatsApp = false;
        this.cdr.detectChanges();
        this.notify.success('Mensaje enviado por WhatsApp');
      },
      error: (err) => {
        this.enviandoWhatsApp = false;
        this.cdr.detectChanges();
        this.notify.error(err.error?.error || 'No se pudo enviar el mensaje');
      }
    });
  }

  exportExcel(): void {
    if (!this.deudor) return;
    const id = this.deudor.id;
    this.exporting = true;
    this.pagosService.getAll({ deudor_id: id, limit: 2000 }).subscribe({
      next: (r) => {
        this.exporting = false;
        this.cdr.detectChanges();
        const pagos = r.data || [];
        const baseUrl = environment.apiUrl.replace(/\/api$/, '');
        const rows: (string | number)[][] = [
          ['#', 'Fecha', 'Concepto', 'Monto', 'Método', 'N.º Operación', 'Comprobante (enlace)'],
          ...pagos.map((p, i) => [
            i + 1,
            p.fecha_pago ? p.fecha_pago.split('T')[0] : '',
            p.concepto || '',
            +p.monto,
            p.metodo_pago,
            p.numero_operacion || '',
            p.imagen_url ? (p.imagen_url.startsWith('http') ? p.imagen_url : baseUrl + p.imagen_url) : ''
          ])
        ];
        const total = pagos.reduce((s, p) => s + +p.monto, 0);
        rows.push(['', '', 'TOTAL', total, '', '', '']);
        this.exportService.downloadCsv(rows, 'pagos_' + this.deudor!.nombre + '_' + this.deudor!.apellidos + '.csv');
        this.notify.success('Exportado ' + pagos.length + ' pago(s)');
      },
      error: () => { this.exporting = false; this.notify.error('No se pudieron cargar los pagos para exportar'); this.cdr.detectChanges(); }
    });
  }

  exportPDF(): void {
    if (!this.deudor) return;
    const id = this.deudor.id;
    this.exporting = true;
    this.pagosService.getAll({ deudor_id: id, limit: 2000 }).subscribe({
      next: (r) => {
        this.exporting = false;
        this.cdr.detectChanges();
        const pagos = r.data || [];
        const d = this.deudor!;
        const baseUrl = environment.apiUrl.replace(/\/api$/, '');
        const now = new Date().toLocaleDateString('es-PE');
        const prestamos = d.prestamos ?? [];
        const prestamosRows = prestamos.map((p) => `<tr><td>${p.tipo}</td><td>${p.descripcion || '-'}</td><td style="text-align:right">S/ ${(+(p.monto_original||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</td><td>${p.estado}</td><td>${p.fecha_inicio ? p.fecha_inicio.split('T')[0] : ''}</td></tr>`).join('');
        const pagosRows = pagos.map((p, i) => {
          const linkComp = p.imagen_url ? `<a href="${p.imagen_url.startsWith('http') ? p.imagen_url : baseUrl + p.imagen_url}" target="_blank" rel="noopener">Ver comprobante</a>` : '-';
          return `<tr><td>${i+1}</td><td>${p.fecha_pago ? p.fecha_pago.split('T')[0] : ''}</td><td>${p.concepto || '-'}</td><td style="text-align:right">S/ ${(+(p.monto||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</td><td>${p.metodo_pago}</td><td>${p.numero_operacion || '-'}</td><td>${linkComp}</td></tr>`;
        }).join('');
        const total = pagos.reduce((s, p) => s + +p.monto, 0);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte - ${d.nombre} ${d.apellidos}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;color:#222;padding:20px}h1{font-size:16px;margin-bottom:4px}.sub{color:#666;margin-bottom:16px;font-size:10px}.info{display:flex;gap:20px;margin-bottom:16px;background:#f5f5f5;padding:12px;border-radius:4px}.info-item{display:flex;flex-direction:column}.info-label{font-size:9px;color:#888;text-transform:uppercase}.info-val{font-size:13px;font-weight:bold}.green{color:#16a34a}.red{color:#dc2626}h2{font-size:12px;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px}th{background:#f5f5f5;padding:6px 8px;text-align:left;border:1px solid #ddd;font-size:9px}td{padding:5px 8px;border:1px solid #eee}tr:nth-child(even){background:#fafafa}.total-row{font-weight:bold;background:#f0f0f0}.footer{margin-top:20px;font-size:9px;color:#999;text-align:center} a{color:#2563eb}</style>
    </head><body>
    <h1>Reporte de Cobros</h1><div class="sub">Generado el ${now} — ${pagos.length} pago(s)</div>
    <div class="info">
      <div class="info-item"><span class="info-label">Deudor</span><span class="info-val">${d.nombre} ${d.apellidos}</span></div>
      ${d.dni ? '<div class="info-item"><span class="info-label">DNI</span><span class="info-val">'+d.dni+'</span></div>' : ''}
      ${d.telefono ? '<div class="info-item"><span class="info-label">Telefono</span><span class="info-val">'+d.telefono+'</span></div>' : ''}
      <div class="info-item"><span class="info-label">Total cobrado</span><span class="info-val green">S/ ${(+(d.total_pagado||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</span></div>
      <div class="info-item"><span class="info-label">Saldo pendiente</span><span class="info-val red">S/ ${(+(d.saldo_pendiente||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</span></div>
    </div>
    <h2>Préstamos (${prestamos.length})</h2>
    <table><thead><tr><th>Tipo</th><th>Descripcion</th><th>Monto</th><th>Estado</th><th>Inicio</th></tr></thead>
    <tbody>${prestamosRows || '<tr><td colspan="5" style="text-align:center;color:#999">Sin prestamos</td></tr>'}</tbody></table>
    <h2>Historial de pagos (${pagos.length})</h2>
    <table><thead><tr><th>#</th><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Método</th><th>N Op.</th><th>Comprobante</th></tr></thead>
    <tbody>${pagosRows || '<tr><td colspan="7" style="text-align:center;color:#999">Sin pagos</td></tr>'}
    <tr class="total-row"><td colspan="3" style="text-align:right">TOTAL COBRADO</td><td style="text-align:right">S/ ${total.toLocaleString('es-PE',{minimumFractionDigits:2})}</td><td colspan="3"></td></tr>
    </tbody></table>
    <div class="footer">Sistema de Cobros — Reporte generado automáticamente. Los enlaces de comprobante abren la imagen del pago.</div>
    </body></html>`;
        const win = window.open('', '_blank');
        if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
        this.notify.success('Exportado ' + pagos.length + ' pago(s)');
      },
      error: () => { this.exporting = false; this.notify.error('No se pudieron cargar los pagos para exportar'); this.cdr.detectChanges(); }
    });
  }
}
