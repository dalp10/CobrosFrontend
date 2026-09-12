import { Component, OnInit, AfterViewInit, inject, ChangeDetectorRef, HostListener, ElementRef, ViewChild } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
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
import { Deudor, Pago, Prestamo, Cuota, CuotaAplicada } from '../../models/index';
import { fechaNoFutura, montoMax, fechaFinMin, tasaInteresRango } from '../../shared/validators';
import { ModalFocusDirective } from '../../shared/directives/modal-focus.directive';
import { formatMonto, formatSoles, formatFecha } from '../../shared/utils/format';
import { generarQrDataUrl } from '../../shared/utils/qr';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-deudor-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, ImagePreviewButtonComponent, FormatNumberPipe, SkeletonComponent, ModalFocusDirective],
  templateUrl: './deudor-detail.component.html',
  styleUrl: './deudor-detail.component.css'
})
export class DeudorDetailComponent implements OnInit, AfterViewInit {
  @ViewChild('evolucionChart') evolucionChartRef!: ElementRef<HTMLCanvasElement>;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
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

  /** Pestaña activa: resumen | prestamos | pagos */
  tabActivo: 'resumen' | 'prestamos' | 'pagos' = 'resumen';

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

  showReprogramar = false;
  savingReprogramar = false;
  reprogramarErr = '';
  reprogramarForm = this.fb.group({
    cuota_mensual: [null as number | null, [Validators.required, Validators.min(0.01), montoMax(1_000_000)]],
    total_cuotas: [null as number | null, [Validators.required, Validators.min(1)]],
    fecha_inicio: ['']
  });

  editPrestamo: Prestamo | null = null;
  editPrestamoForm = this.fb.group({
    estado: [''],
    notas: [''],
    monto_original: [null as number | null, [Validators.required, Validators.min(0.01), montoMax(10_000_000)]]
  });
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

  /** Saldo pendiente: suma de los saldos pendientes por préstamo (incluye intereses) */
  get saldoPendiente(): number {
    const d = this.deudor;
    if (!d) return 0;
    if (d.prestamos?.length) return d.prestamos.reduce((s, p) => s + +(p.saldo_pendiente ?? 0), 0);
    return +(d.saldo_pendiente ?? 0);
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

  compromisoForm = this.fb.group({
    fecha_compromiso_pago: [null as string | null],
    monto_compromiso_pago: [null as number | null],
    notas_compromiso: ['']
  });
  savingCompromiso = false;
  compromisoErr = '';

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
    this.route.queryParams.subscribe(qp => {
      const t = qp['tab'];
      if (t === 'resumen' || t === 'prestamos' || t === 'pagos') this.tabActivo = t;
    });
    this.prestamoForm.get('fecha_inicio')?.valueChanges?.subscribe(() => {
      this.prestamoForm.get('fecha_fin')?.updateValueAndValidity();
    });
  }

  irATab(tab: 'resumen' | 'prestamos' | 'pagos'): void {
    this.tabActivo = tab;
    this.router.navigate([], { queryParams: { tab }, queryParamsHandling: 'merge', relativeTo: this.route });
    if (tab === 'resumen' && this.evolucionSaldo.length > 0) {
      setTimeout(() => this.drawEvolucionChart(), 100);
    }
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
        this.patchCompromisoFormFromDeudor();
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
      next: (cuotas) => {
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
    this.showReprogramar = false;
    this.reprogramarErr = '';
    this.reprogramarForm.reset();
    this.cdr.detectChanges();
  }

  toggleReprogramar(): void {
    this.showReprogramar = !this.showReprogramar;
    this.reprogramarErr = '';
    if (this.showReprogramar && this.cronogramaPrestamo) {
      this.reprogramarForm.reset({
        cuota_mensual: this.cronogramaPrestamo.cuota_mensual ?? null,
        total_cuotas: this.cuotasCronograma.filter(c => c.estado !== 'pagado').length || null,
        fecha_inicio: ''
      });
    }
    this.cdr.detectChanges();
  }

  guardarReprogramacion(): void {
    if (!this.cronogramaPrestamo || this.reprogramarForm.invalid) return;
    const { cuota_mensual, total_cuotas, fecha_inicio } = this.reprogramarForm.value;
    this.savingReprogramar = true;
    this.reprogramarErr = '';
    this.cdr.detectChanges();
    this.prestamosService.reprogramar(this.cronogramaPrestamo.id, {
      cuota_mensual: Number(cuota_mensual),
      total_cuotas: Number(total_cuotas),
      ...(fecha_inicio ? { fecha_inicio } : {})
    }).subscribe({
      next: (res) => {
        this.cuotasCronograma = res.cuotas;
        this.cronogramaPrestamo = { ...this.cronogramaPrestamo!, total_cuotas: res.total_cuotas, cuota_mensual: res.cuota_mensual };
        this.savingReprogramar = false;
        this.showReprogramar = false;
        this.notify.success('Cronograma reprogramado correctamente');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.savingReprogramar = false;
        this.reprogramarErr = err.error?.error || 'No se pudo reprogramar el cronograma';
        this.cdr.detectChanges();
      }
    });
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

  get editPrestamoMontoError(): string | null {
    const c = this.editPrestamoForm.get('monto_original');
    if (!c?.invalid || !c?.touched) return null;
    return c.hasError('montoMax') ? 'Máximo S/ 10,000,000' : 'Debe ser mayor a 0';
  }

  abrirEditarPrestamo(p: Prestamo): void {
    // Diferir al siguiente ciclo para evitar NG0100 (validación del form cambia tras setValue)
    setTimeout(() => {
      this.editPrestamo = p;
      this.editPrestamoErr = '';
      this.editPrestamoForm.setValue({
        estado: p.estado || 'activo',
        notas: p.notas || '',
        monto_original: p.monto_original ?? null
      });
      this.cdr.markForCheck();
    }, 0);
  }

  cerrarEditarPrestamo(): void {
    this.editPrestamo = null;
    this.cdr.markForCheck();
  }

  patchCompromisoFormFromDeudor(): void {
    const d = this.deudor;
    if (!d) return;
    this.compromisoForm.patchValue({
      fecha_compromiso_pago: d.fecha_compromiso_pago ? d.fecha_compromiso_pago.split('T')[0] : null,
      monto_compromiso_pago: d.monto_compromiso_pago ?? null,
      notas_compromiso: d.notas_compromiso ?? ''
    }, { emitEvent: false });
  }

  guardarCompromiso(): void {
    if (!this.deudor) return;
    const v = this.compromisoForm.value as { fecha_compromiso_pago?: string | null; monto_compromiso_pago?: number | null; notas_compromiso?: string };
    this.savingCompromiso = true;
    this.compromisoErr = '';
    const payload: Partial<Deudor> = {
      fecha_compromiso_pago: v.fecha_compromiso_pago?.trim() || null,
      monto_compromiso_pago: v.monto_compromiso_pago != null && v.monto_compromiso_pago > 0 ? v.monto_compromiso_pago : null,
      notas_compromiso: v.notas_compromiso?.trim() || null
    };
    this.deudoresService.update(this.deudor.id, payload).subscribe({
      next: () => {
        // Diferir al siguiente ciclo para evitar NG0100 (ExpressionChangedAfterItHasBeenCheckedError)
        setTimeout(() => {
          this.savingCompromiso = false;
          this.load();
          this.notify.success('Compromiso de pago actualizado');
        }, 0);
      },
      error: (e) => {
        this.savingCompromiso = false;
        this.compromisoErr = e.error?.error || 'Error al guardar';
        this.notify.error(this.compromisoErr);
        this.cdr.markForCheck();
      }
    });
  }

  guardarEditarPrestamo(): void {
    if (!this.editPrestamo) return;
    const v = this.editPrestamoForm.value as { estado?: string; notas?: string; monto_original?: number | null };
    if (this.editPrestamoForm.invalid) {
      this.editPrestamoForm.markAllAsTouched();
      this.notify.error('Revisa el monto (debe ser mayor a 0)');
      setTimeout(() => this.cdr.markForCheck(), 0);
      return;
    }
    const estado: Prestamo['estado'] = (v.estado === 'activo' || v.estado === 'vencido' || v.estado === 'pagado' || v.estado === 'cancelado')
      ? v.estado : 'activo';
    const payload: Partial<Prestamo> = { estado, notas: v.notas || undefined };
    if (v.monto_original != null && v.monto_original > 0) payload.monto_original = v.monto_original;
    this.savingEditPrestamo = true;
    this.editPrestamoErr = '';
    this.prestamosService.update(this.editPrestamo.id, payload).subscribe({
      next: () => {
        // Diferir todo al siguiente ciclo para evitar ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.savingEditPrestamo = false;
          this.editPrestamo = null;
          this.load();
          this.notify.success('Préstamo actualizado');
        }, 0);
      },
      error: (e) => {
        this.savingEditPrestamo = false;
        this.editPrestamoErr = e.error?.error || e.error?.message || 'No se pudo actualizar';
        this.notify.error(this.editPrestamoErr);
        setTimeout(() => this.cdr.markForCheck(), 0);
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
    if (this.prestamoForm.invalid) {
      this.prestamoForm.markAllAsTouched();
      this.notify.error('Completa los campos requeridos');
      this.cdr.detectChanges();
      return;
    }
    this.savingPrestamo = true; this.prestamoErr = '';
    const v = this.prestamoForm.value;
    const id = this.route.snapshot.params['id'];
    const body: Partial<Prestamo> = { ...v, deudor_id: +id } as Partial<Prestamo>;
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
      next: (pago) => {
        this.saving = false; this.pagoOk = true; this.pagoSubmitted = false;
        this.imagenFile = null; this.imagenPreview = null;
        this.pagoForm.reset({ fecha_pago: new Date().toISOString().split('T')[0] });
        this.cdr.detectChanges(); this.load();
        this.notify.success(this.mensajePagoRegistrado(pago.cuotas_aplicadas));
        setTimeout(() => { this.pagoOk = false; this.cdr.detectChanges(); }, 3000);
      },
      error: (e) => { this.saving = false; this.pagoErr = e.error?.error || 'Error'; this.cdr.detectChanges(); this.notify.error(this.pagoErr); }
    });
  }

  /** Describe cómo se repartió el pago sobre el cronograma de cuotas, para informar al cliente. */
  private mensajePagoRegistrado(cuotasAplicadas?: CuotaAplicada[]): string {
    if (!cuotasAplicadas?.length) return 'Pago registrado';
    const detalle = cuotasAplicadas.map(c => {
      if (c.estado === 'pagado') return `Cuota ${c.numero_cuota}: completada (+${formatSoles(c.monto_aplicado)})`;
      return `Cuota ${c.numero_cuota}: ${formatSoles(c.monto_pagado)} de ${formatSoles(c.monto_esperado)} (falta ${formatSoles(c.saldo_restante)})`;
    }).join(' · ');
    return `Pago registrado. ${detalle}`;
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
    this.notify.showProgress('Enviando mensaje por WhatsApp...');
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
        const now = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
        const prestamos = d.prestamos ?? [];
        const prestamosRows = prestamos.map((p) => `<tr><td>${(p.tipo || '').replace(/_/g, ' ')}</td><td>${p.descripcion || '—'}</td><td class="num">S/ ${formatMonto(p.monto_original || 0)}</td><td><span class="badge badge-${p.estado}">${p.estado}</span></td><td>${p.fecha_inicio ? p.fecha_inicio.split('T')[0] : '—'}</td></tr>`).join('');
        const pagosRows = pagos.map((p, i) => {
          const linkComp = p.imagen_url ? `<a href="${p.imagen_url.startsWith('http') ? p.imagen_url : baseUrl + p.imagen_url}" target="_blank" rel="noopener">Comprobante</a>` : '—';
          return `<tr><td class="num">${i + 1}</td><td>${p.fecha_pago ? p.fecha_pago.split('T')[0] : '—'}</td><td>${p.concepto || '—'}</td><td class="num">S/ ${formatMonto(p.monto || 0)}</td><td>${p.metodo_pago}</td><td>${p.numero_operacion || '—'}</td><td>${linkComp}</td></tr>`;
        }).join('');
        const total = pagos.reduce((s, p) => s + +p.monto, 0);
        const totalPrestado = prestamos.reduce((s, p) => s + +(p.monto_original || 0), 0);
        const saldoPendiente = this.saldoPendiente;

        const pagosConImagen = pagos.filter(p => !!p.imagen_url);
        const evidenciasHtml = pagosConImagen.map(p => {
          const url = p.imagen_url!.startsWith('http') ? p.imagen_url! : baseUrl + p.imagen_url;
          const fecha = p.fecha_pago ? p.fecha_pago.split('T')[0] : '—';
          return `
          <div class="evidencia-item">
            <img src="${url}" alt="Comprobante de pago" />
            <div class="evidencia-caption">
              <div class="monto">S/ ${formatMonto(p.monto || 0)} · ${fecha}</div>
              <div>${(p.concepto || '—').replace(/</g, '&lt;')} · ${p.metodo_pago}</div>
            </div>
          </div>`;
        }).join('');
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Reporte de cobros — ${d.nombre} ${d.apellidos}</title>
  <style>
    :root { --ink: #1e293b; --muted: #64748b; --border: #e2e8f0; --bg: #f8fafc; --primary: #0f766e; --success: #059669; --danger: #dc2626; --header-bg: #0f172a; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 11px; color: var(--ink); line-height: 1.4; margin: 0; padding: 24px; background: #fff; }
    @media print { body { padding: 12px; } .no-print { display: none; } }
    .doc-header { background: var(--header-bg); color: #fff; padding: 16px 20px; margin: -24px -24px 20px -24px; }
    @media print { .doc-header { margin: -12px -12px 16px -12px; padding: 12px 16px; } }
    .doc-header h1 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
    .doc-header .doc-meta { margin-top: 4px; font-size: 10px; opacity: .85; }
    .deudor-card { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; }
    .deudor-name { font-size: 16px; font-weight: 600; color: var(--ink); margin-bottom: 12px; }
    .deudor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px 24px; }
    .deudor-item .label { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 2px; }
    .deudor-item .value { font-size: 13px; font-weight: 600; }
    .kpi-row { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
    .kpi { flex: 1; min-width: 120px; padding: 10px 14px; border-radius: 6px; text-align: center; }
    .kpi .label { font-size: 9px; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
    .kpi-cobrado { background: #ecfdf5; color: var(--success); border: 1px solid #a7f3d0; }
    .kpi-cobrado .value { font-size: 15px; font-weight: 700; color: #047857; }
    .kpi-pendiente { background: #fef2f2; color: var(--danger); border: 1px solid #fecaca; }
    .kpi-pendiente .value { font-size: 15px; font-weight: 700; color: #b91c1c; }
    .section { margin-bottom: 20px; break-inside: avoid; }
    .section-title { font-size: 12px; font-weight: 600; color: var(--ink); margin: 0 0 8px 0; padding-bottom: 6px; border-bottom: 2px solid var(--primary); }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 0; }
    thead { background: var(--header-bg); color: #fff; }
    th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
    th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; }
    td { padding: 7px 10px; border-bottom: 1px solid var(--border); }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr:hover { background: #f1f5f9; }
    @media print { tbody tr:hover { background: inherit; } }
    .total-row { background: #f1f5f9 !important; font-weight: 700; border-top: 2px solid var(--border); }
    .total-row td { padding: 10px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 600; text-transform: uppercase; }
    .badge-activo { background: #dbeafe; color: #1d4ed8; }
    .badge-pagado { background: #d1fae5; color: #065f46; }
    .badge-vencido { background: #fef3c7; color: #b45309; }
    .badge-cancelado { background: #f3f4f6; color: #6b7280; }
    a { color: #0369a1; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 9px; color: var(--muted); text-align: center; }
    .empty-msg { text-align: center; color: var(--muted); padding: 16px; font-style: italic; }
    .evidencia-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .evidencia-item { border: 1px solid var(--border); border-radius: 6px; overflow: hidden; break-inside: avoid; }
    .evidencia-item img { display: block; width: 100%; height: 180px; object-fit: contain; background: #f8fafc; }
    .evidencia-caption { padding: 6px 8px; font-size: 9px; color: var(--ink); border-top: 1px solid var(--border); }
    .evidencia-caption .monto { font-weight: 700; }
    @media print { .evidencia-item { break-inside: avoid; page-break-inside: avoid; } }
  </style>
</head>
<body>
  <header class="doc-header">
    <h1>Reporte de cobros</h1>
    <div class="doc-meta">Generado el ${now} · Cliente: ${d.nombre} ${d.apellidos}</div>
  </header>

  <section class="deudor-card">
    <div class="deudor-name">${d.nombre} ${d.apellidos}</div>
    <div class="deudor-grid">
      ${d.dni ? `<div class="deudor-item"><span class="label">DNI</span><span class="value">${d.dni}</span></div>` : ''}
      ${d.telefono ? `<div class="deudor-item"><span class="label">Teléfono</span><span class="value">${d.telefono}</span></div>` : ''}
      ${d.email ? `<div class="deudor-item"><span class="label">Email</span><span class="value">${d.email}</span></div>` : ''}
    </div>
    <div class="kpi-row">
      <div class="kpi kpi-cobrado"><div class="label">Total cobrado</div><div class="value">S/ ${formatMonto(total)}</div></div>
      <div class="kpi kpi-pendiente"><div class="label">Saldo pendiente</div><div class="value">S/ ${formatMonto(saldoPendiente)}</div></div>
    </div>
  </section>
  ${d.fecha_compromiso_pago || d.monto_compromiso_pago || d.notas_compromiso ? `
  <section class="section">
    <h2 class="section-title">Compromiso de pago</h2>
    <p><strong>Fecha:</strong> ${d.fecha_compromiso_pago ? d.fecha_compromiso_pago.split('T')[0] : '—'}
       ${d.monto_compromiso_pago ? ` · <strong>Monto:</strong> S/ ${formatMonto(d.monto_compromiso_pago)}` : ''}</p>
    ${d.notas_compromiso ? `<p>${d.notas_compromiso}</p>` : ''}
  </section>
  ` : ''}

  <section class="section">
    <h2 class="section-title">Préstamos (${prestamos.length})</h2>
    <table>
      <thead><tr><th>Tipo</th><th>Descripción</th><th class="num">Monto</th><th>Estado</th><th>Inicio</th></tr></thead>
      <tbody>${prestamosRows || '<tr><td colspan="5" class="empty-msg">Sin préstamos registrados</td></tr>'}</tbody>
    </table>
  </section>

  <section class="section">
    <h2 class="section-title">Historial de pagos (${pagos.length})</h2>
    <table>
      <thead><tr><th class="num">#</th><th>Fecha</th><th>Concepto</th><th class="num">Monto</th><th>Método</th><th>N.º Op.</th><th>Comprobante</th></tr></thead>
      <tbody>
        ${pagosRows || '<tr><td colspan="7" class="empty-msg">Sin pagos registrados</td></tr>'}
        <tr class="total-row"><td colspan="3" style="text-align:right">Total cobrado</td><td class="num">S/ ${formatMonto(total)}</td><td colspan="3"></td></tr>
      </tbody>
    </table>
  </section>

  ${evidenciasHtml ? `
  <section class="section">
    <h2 class="section-title">Evidencias de pago (${pagosConImagen.length})</h2>
    <div class="evidencia-grid">
      ${evidenciasHtml}
    </div>
  </section>
  ` : ''}

  <footer class="footer">DALP Cobros · Reporte generado automáticamente. Los enlaces abren el comprobante del pago.</footer>
</body>
</html>`;
        const win = window.open('', '_blank');
        if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
        this.notify.success('Exportado ' + pagos.length + ' pago(s)');
      },
      error: () => { this.exporting = false; this.notify.error('No se pudieron cargar los pagos para exportar'); this.cdr.detectChanges(); }
    });
  }

  /** Genera un PDF con el saldo pendiente del deudor y sus próximas cuotas, con QR de verificación. */
  async exportEstadoCuenta(): Promise<void> {
    if (!this.deudor) return;
    const d = this.deudor;
    const prestamosActivos = (d.prestamos ?? []).filter(p => p.estado === 'activo' || p.estado === 'vencido');

    if (!prestamosActivos.length) {
      this.generarPdfEstadoCuenta(d, [], []);
      return;
    }

    this.exporting = true;
    this.cdr.detectChanges();
    forkJoin(prestamosActivos.map(p => this.prestamosService.getCuotas(p.id))).subscribe({
      next: (cuotasPorPrestamo) => {
        this.exporting = false;
        this.cdr.detectChanges();
        const cuotasPendientes = cuotasPorPrestamo
          .flatMap((cuotas, i) => cuotas
            .filter(c => c.estado === 'pendiente' || c.estado === 'parcial' || c.estado === 'vencido')
            .map(c => ({ cuota: c, prestamo: prestamosActivos[i] }))
          )
          .sort((a, b) => (a.cuota.fecha_vencimiento || '').localeCompare(b.cuota.fecha_vencimiento || ''));
        this.generarPdfEstadoCuenta(d, cuotasPendientes, prestamosActivos);
      },
      error: () => {
        this.exporting = false;
        this.cdr.detectChanges();
        this.notify.error('No se pudieron cargar las cuotas para el estado de cuenta');
      }
    });
  }

  private async generarPdfEstadoCuenta(d: Deudor, cuotasPendientes: { cuota: Cuota; prestamo: Prestamo }[], prestamosActivos: Prestamo[]): Promise<void> {
    const fechaGen = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const proximaCuota = cuotasPendientes[0];

    const qrTexto = [
      'Estado de cuenta',
      `Cliente: ${d.nombre} ${d.apellidos || ''}`.trim(),
      `Saldo pendiente: ${formatSoles(this.saldoPendiente)}`,
      proximaCuota ? `Próxima cuota: ${formatSoles(proximaCuota.cuota.monto_esperado)} (${formatFecha(proximaCuota.cuota.fecha_vencimiento)})` : 'Sin cuotas pendientes',
      `Generado: ${fechaGen}`
    ].join('\n');

    let qrImg = '';
    try {
      qrImg = await generarQrDataUrl(qrTexto);
    } catch (e) {
      console.error(e);
    }

    const tieneIntereses = cuotasPendientes.some(({ cuota }) => +(cuota.monto_interes || 0) > 0);

    const prestamosConCuotas = new Set(cuotasPendientes.map(({ prestamo }) => prestamo.id));
    const unSoloPrestamo = prestamosConCuotas.size <= 1;

    const filasCuotas = cuotasPendientes.map(({ cuota, prestamo }) => `
      <tr>
        ${unSoloPrestamo ? '' : `<td>${(prestamo.descripcion || prestamo.tipo || '—').replace(/_/g, ' ')}</td>`}
        <td class="text-center num">${cuota.numero_cuota}</td>
        <td>${formatFecha(cuota.fecha_vencimiento)}</td>
        ${tieneIntereses ? `
        <td class="text-right num">${formatSoles(cuota.monto_capital || 0)}</td>
        <td class="text-right num">${formatSoles(cuota.monto_interes || 0)}</td>` : ''}
        <td class="text-right num">${formatSoles(cuota.monto_esperado)}</td>
        <td class="text-center"><span class="badge badge-${cuota.estado}">${cuota.estado}</span></td>
      </tr>`).join('');

    const saldoCapitalPendiente = prestamosActivos.reduce((s, p) => s + +(p.saldo_capital ?? 0), 0);
    const saldoInteresPendiente = prestamosActivos.reduce((s, p) => s + (+(p.interes_total ?? 0) - +(p.interes_pagado ?? 0)), 0);

    // Si no hay cronograma de cuotas, mostrar el saldo pendiente por préstamo (con cuota mensual si está definida)
    const pagosPorPrestamo = (d.pagos ?? []).reduce<Record<number, number>>((acc, p) => {
      if (p.prestamo_id != null) acc[p.prestamo_id] = (acc[p.prestamo_id] ?? 0) + +(p.monto ?? 0);
      return acc;
    }, {});
    const prestamosConSaldo = !cuotasPendientes.length
      ? prestamosActivos
          .map(p => ({ prestamo: p, saldo: +(p.monto_original ?? 0) - (pagosPorPrestamo[p.id] ?? 0) }))
          .filter(({ saldo }) => saldo > 0)
      : [];
    const filasPrestamos = prestamosConSaldo.map(({ prestamo, saldo }) => `
      <tr>
        <td>${(prestamo.descripcion || prestamo.tipo || '—').replace(/_/g, ' ')}</td>
        <td>${prestamo.fecha_fin ? formatFecha(prestamo.fecha_fin) : '—'}</td>
        <td class="text-right num">${formatSoles(saldo)}</td>
        <td class="text-right num">${prestamo.cuota_mensual ? formatSoles(+prestamo.cuota_mensual) : '—'}</td>
        <td class="text-center"><span class="badge badge-${prestamo.estado}">${prestamo.estado}</span></td>
      </tr>`).join('');

    const nombreCliente = (d.nombre + ' ' + (d.apellidos || '')).trim().replace(/</g, '&lt;');
    const prestamoUnico = unSoloPrestamo && cuotasPendientes.length
      ? cuotasPendientes[0].prestamo
      : null;

    const html = `
      <div class="report-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h1 class="report-title">Estado de cuenta</h1>
          <p class="report-meta">Cliente: ${nombreCliente}${d.dni ? ` · DNI ${d.dni}` : ''}</p>
          <p class="report-meta">Generado el ${fechaGen}</p>
        </div>
        ${qrImg ? `<div style="text-align:center;"><img src="${qrImg}" alt="Código QR del estado de cuenta" style="width:90px;height:90px;" /><p class="report-meta" style="margin-top:4px;">Escanea para verificar</p></div>` : ''}
      </div>
      <div class="report-summary">
        ${tieneIntereses ? `
        <div class="report-summary-item"><span class="label">Capital pendiente</span><strong>${formatSoles(saldoCapitalPendiente)}</strong></div>
        <div class="report-summary-item"><span class="label">Interés pendiente</span><strong>${formatSoles(saldoInteresPendiente)}</strong></div>` : ''}
        <div class="report-summary-item"><span class="label">Saldo pendiente total</span><strong>${formatSoles(this.saldoPendiente)}</strong></div>
        ${proximaCuota ? `
        <div class="report-summary-item"><span class="label">Próxima cuota</span><strong>${formatSoles(proximaCuota.cuota.monto_esperado)} · ${formatFecha(proximaCuota.cuota.fecha_vencimiento)}</strong></div>` : ''}
      </div>
      ${filasCuotas ? `
      <h2 class="report-meta" style="margin-top:20px; font-weight:600;">Próximas cuotas${prestamoUnico ? ` — ${(prestamoUnico.descripcion || prestamoUnico.tipo || '').replace(/_/g, ' ')}` : ''}</h2>
      <table style="margin-top:8px;">
        <thead>
          <tr>
            ${unSoloPrestamo ? '' : '<th>Préstamo</th>'}<th class="text-center">N° cuota</th><th>Vencimiento</th>
            ${tieneIntereses ? '<th class="text-right">Capital</th><th class="text-right">Interés</th>' : ''}
            <th class="text-right">Monto</th><th class="text-center">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${filasCuotas}
        </tbody>
      </table>` : `
      <h2 class="report-meta" style="margin-top:20px; font-weight:600;">Préstamos con saldo pendiente</h2>
      <table style="margin-top:8px;">
        <thead>
          <tr><th>Préstamo</th><th>Vencimiento</th><th class="text-right">Saldo</th><th class="text-right">Cuota mensual</th><th class="text-center">Estado</th></tr>
        </thead>
        <tbody>
          ${filasPrestamos || '<tr><td colspan="5" class="empty-msg">No hay préstamos con saldo pendiente</td></tr>'}
        </tbody>
      </table>`}
      <div class="report-footer">
        ${tieneIntereses ? 'El "Capital" es lo que reduce tu deuda original; el "Interés" es el costo del préstamo. ' : ''}Este documento es un resumen del estado de cuenta generado por DALP Cobros. Los montos pueden variar si se registran nuevos pagos o cuotas.
      </div>`;

    const filename = 'estado_cuenta_' + d.nombre + '_' + (d.apellidos || '') + '.pdf';
    this.exportService.downloadPdfFromHtml(html, filename);
  }

  /** Genera un PDF con el cronograma completo de cuotas (todos los préstamos del cliente). */
  exportCronograma(): void {
    if (!this.deudor) return;
    const d = this.deudor;
    const prestamos = d.prestamos ?? [];
    if (!prestamos.length) {
      this.notify.error('Este cliente no tiene préstamos registrados.');
      return;
    }

    this.exporting = true;
    this.cdr.detectChanges();
    forkJoin(prestamos.map(p => this.prestamosService.getCuotas(p.id))).subscribe({
      next: (cuotasPorPrestamo) => {
        this.exporting = false;
        this.cdr.detectChanges();
        const filas = cuotasPorPrestamo
          .flatMap((cuotas, i) => cuotas.map(c => ({ cuota: c, prestamo: prestamos[i] })))
          .sort((a, b) => (a.prestamo.id - b.prestamo.id) || (a.cuota.numero_cuota - b.cuota.numero_cuota));
        if (!filas.length) {
          this.notify.error('No hay un cronograma de cuotas generado para este cliente.');
          return;
        }
        this.generarPdfCronograma(d, filas);
      },
      error: () => {
        this.exporting = false;
        this.cdr.detectChanges();
        this.notify.error('No se pudo cargar el cronograma de cuotas');
      }
    });
  }

  private generarPdfCronograma(d: Deudor, filas: { cuota: Cuota; prestamo: Prestamo }[]): void {
    const fechaGen = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const nombreCompleto = (d.nombre + ' ' + (d.apellidos || '')).trim();

    const tieneIntereses = filas.some(({ cuota }) => +(cuota.monto_interes || 0) > 0);

    const filasHtml = filas.map(({ cuota, prestamo }) => `
      <tr>
        <td>${(prestamo.descripcion || prestamo.tipo || '—').replace(/_/g, ' ')}</td>
        <td class="text-center num">${cuota.numero_cuota}</td>
        <td>${formatFecha(cuota.fecha_vencimiento)}</td>
        ${tieneIntereses ? `
        <td class="text-right num">${formatSoles(cuota.monto_capital || 0)}</td>
        <td class="text-right num">${formatSoles(cuota.monto_interes || 0)}</td>` : ''}
        <td class="text-right num">${formatSoles(cuota.monto_esperado)}</td>
        <td class="text-right num">${formatSoles(cuota.monto_pagado || 0)}</td>
        <td class="text-center"><span class="badge badge-${cuota.estado}">${cuota.estado}</span></td>
      </tr>`).join('');

    const totalEsperado = filas.reduce((s, { cuota }) => s + +(cuota.monto_esperado || 0), 0);
    const totalPagado = filas.reduce((s, { cuota }) => s + +(cuota.monto_pagado || 0), 0);
    const totalCapital = filas.reduce((s, { cuota }) => s + +(cuota.monto_capital || 0), 0);
    const totalInteres = filas.reduce((s, { cuota }) => s + +(cuota.monto_interes || 0), 0);

    const html = `
      <div class="report-header">
        <h1 class="report-title">Cronograma de pagos</h1>
        <p class="report-meta">Cliente: ${nombreCompleto.replace(/</g, '&lt;')} · Generado el ${fechaGen}</p>
      </div>
      <div class="report-summary">
        <div class="report-summary-item"><span class="label">Total de cuotas</span><strong>${filas.length}</strong></div>
        ${tieneIntereses ? `
        <div class="report-summary-item"><span class="label">Capital a pagar</span><strong>${formatSoles(totalCapital)}</strong></div>
        <div class="report-summary-item"><span class="label">Interés a pagar</span><strong>${formatSoles(totalInteres)}</strong></div>` : ''}
        <div class="report-summary-item"><span class="label">Monto total del cronograma</span><strong>${formatSoles(totalEsperado)}</strong></div>
        <div class="report-summary-item"><span class="label">Monto pagado</span><strong>${formatSoles(totalPagado)}</strong></div>
        <div class="report-summary-item"><span class="label">Saldo pendiente</span><strong>${formatSoles(totalEsperado - totalPagado)}</strong></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Préstamo</th><th class="text-center">N° cuota</th><th>Vencimiento</th>
            ${tieneIntereses ? '<th class="text-right">Capital</th><th class="text-right">Interés</th>' : ''}
            <th class="text-right">Total cuota</th><th class="text-right">Pagado</th><th class="text-center">Estado</th>
          </tr>
        </thead>
        <tbody>${filasHtml}</tbody>
      </table>
      ${tieneIntereses ? `
      <div class="report-footer">
        <strong>¿Cómo leer este cronograma?</strong> Cada cuota se divide en dos partes: el <strong>capital</strong> (lo que reduce tu deuda original) y el <strong>interés</strong> (el costo del préstamo). A medida que avanzas en el cronograma, el interés disminuye y el capital aumenta. Documento generado por DALP Cobros.
      </div>` : `
      <div class="report-footer">
        Este documento detalla el calendario completo de cuotas registradas para este cliente. Generado por DALP Cobros.
      </div>`}`;

    const filename = 'cronograma_' + d.nombre + '_' + (d.apellidos || '') + '.pdf';
    this.exportService.downloadPdfFromHtml(html, filename);
  }

  /** Genera un PDF con el resumen de pagos agrupado por año y mes. */
  exportResumenAnual(): void {
    if (!this.deudor) return;
    const d = this.deudor;
    this.exporting = true;
    this.cdr.detectChanges();
    this.pagosService.getAll({ deudor_id: d.id, limit: 2000 }).subscribe({
      next: (r) => {
        this.exporting = false;
        this.cdr.detectChanges();
        this.generarPdfResumenAnual(d, r.data || []);
      },
      error: () => {
        this.exporting = false;
        this.cdr.detectChanges();
        this.notify.error('No se pudieron cargar los pagos para el resumen anual');
      }
    });
  }

  private generarPdfResumenAnual(d: Deudor, pagos: Pago[]): void {
    const fechaGen = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const nombreCompleto = (d.nombre + ' ' + (d.apellidos || '')).trim().replace(/</g, '&lt;');
    const filename = 'resumen_anual_' + d.nombre + '_' + (d.apellidos || '') + '.pdf';

    if (!pagos.length) {
      const html = `
        <div class="report-header">
          <h1 class="report-title">Resumen anual de pagos</h1>
          <p class="report-meta">Cliente: ${nombreCompleto} · Generado el ${fechaGen}</p>
        </div>
        <p class="empty-msg">Sin pagos registrados</p>
        <div class="report-footer">Documento generado por DALP Cobros.</div>`;
      this.exportService.downloadPdfFromHtml(html, filename);
      return;
    }

    const porAnio = new Map<string, Pago[]>();
    for (const p of pagos) {
      const anio = (p.fecha_pago || '').slice(0, 4) || '—';
      if (!porAnio.has(anio)) porAnio.set(anio, []);
      porAnio.get(anio)!.push(p);
    }
    const anios = Array.from(porAnio.keys()).sort().reverse();
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    const seccionesAnio = anios.map(anio => {
      const lista = porAnio.get(anio)!;
      const totalAnio = lista.reduce((s, p) => s + +(p.monto || 0), 0);
      const porMes = new Map<number, number>();
      for (const p of lista) {
        const mesIdx = p.fecha_pago ? new Date(p.fecha_pago).getMonth() : 0;
        porMes.set(mesIdx, (porMes.get(mesIdx) || 0) + +(p.monto || 0));
      }
      const filasMes = meses
        .map((nombreMes, i) => ({ nombreMes, total: porMes.get(i) || 0 }))
        .filter(({ total }) => total > 0)
        .map(({ nombreMes, total }) => `<tr><td>${nombreMes} ${anio}</td><td class="text-right num">${formatSoles(total)}</td></tr>`)
        .join('');

      return `
        <h2 class="report-meta" style="margin-top:20px; font-weight:600; font-size:14px;">Año ${anio} — ${lista.length} pago${lista.length !== 1 ? 's' : ''}</h2>
        <table style="margin-top:8px;">
          <thead><tr><th>Mes</th><th class="text-right">Total cobrado</th></tr></thead>
          <tbody>
            ${filasMes}
            <tr class="total-row"><td>Total ${anio}</td><td class="text-right num"><strong>${formatSoles(totalAnio)}</strong></td></tr>
          </tbody>
        </table>`;
    }).join('');

    const totalGeneral = pagos.reduce((s, p) => s + +(p.monto || 0), 0);

    const html = `
      <div class="report-header">
        <h1 class="report-title">Resumen anual de pagos</h1>
        <p class="report-meta">Cliente: ${nombreCompleto} · Generado el ${fechaGen}</p>
      </div>
      <div class="report-summary">
        <div class="report-summary-item"><span class="label">Total de pagos</span><strong>${pagos.length}</strong></div>
        <div class="report-summary-item"><span class="label">Total cobrado</span><strong>${formatSoles(totalGeneral)}</strong></div>
        <div class="report-summary-item"><span class="label">Años con actividad</span><strong>${anios.length}</strong></div>
      </div>
      ${seccionesAnio}
      <div class="report-footer">
        Este resumen agrupa todos los pagos registrados por año y mes. Generado por DALP Cobros.
      </div>`;

    this.exportService.downloadPdfFromHtml(html, filename);
  }

  /** Genera una constancia de cancelación total (solo disponible cuando el saldo pendiente es 0 o menor). */
  async exportConstanciaCancelacion(): Promise<void> {
    if (!this.deudor) return;
    if (this.saldoPendiente > 0) {
      this.notify.error('El cliente aún tiene saldo pendiente.');
      return;
    }
    const d = this.deudor;
    const fechaGen = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
    const nombreCompleto = (d.nombre + ' ' + (d.apellidos || '')).trim();
    const totalPrestado = this.totalPrestado;
    const totalCobrado = this.totalCobrado;

    const qrTexto = [
      'Constancia de cancelación total',
      `Cliente: ${nombreCompleto}`,
      d.dni ? `DNI: ${d.dni}` : '',
      `Monto total cancelado: ${formatSoles(totalCobrado)}`,
      `Emitido: ${fechaGen}`
    ].filter(Boolean).join('\n');

    let qrImg = '';
    try {
      qrImg = await generarQrDataUrl(qrTexto);
    } catch (e) {
      console.error(e);
    }

    const prestamos = d.prestamos ?? [];
    const filasPrestamos = prestamos.map(p => `
      <tr>
        <td>${(p.descripcion || p.tipo || '—').replace(/_/g, ' ')}</td>
        <td class="text-right num">${formatSoles(p.monto_original || 0)}</td>
        <td>${p.fecha_inicio ? formatFecha(p.fecha_inicio) : '—'}</td>
        <td class="text-center"><span class="badge badge-pagado">cancelado</span></td>
      </tr>`).join('');

    const html = `
      <div class="recibo-topbar"></div>
      <div class="recibo-header">
        <div class="recibo-brand-row">
          <div class="recibo-mark">D</div>
          <div>
            <h1 class="recibo-brand">DALP Cobros</h1>
            <p class="recibo-sub">Constancia de cancelación total</p>
          </div>
        </div>
        <div class="recibo-badge-wrap">
          <span class="recibo-badge">✓ Libre de deuda</span>
          <p class="recibo-num">Emitido: ${fechaGen}</p>
        </div>
      </div>

      <div class="recibo-monto-box">
        <span class="recibo-monto-label">Monto total cancelado</span>
        <span class="recibo-monto">${formatSoles(totalCobrado)}</span>
      </div>

      <div style="display:flex; gap:24px; align-items:flex-start;">
        <div class="recibo-grid" style="flex:1;">
          <div class="recibo-item"><span class="lbl">Cliente</span><span class="val">${nombreCompleto.replace(/</g, '&lt;')}</span></div>
          ${d.dni ? `<div class="recibo-item"><span class="lbl">DNI</span><span class="val">${d.dni}</span></div>` : ''}
          <div class="recibo-item"><span class="lbl">Monto total prestado</span><span class="val">${formatSoles(totalPrestado)}</span></div>
          <div class="recibo-item"><span class="lbl">Saldo pendiente</span><span class="val">S/ 0.00</span></div>
        </div>
        ${qrImg ? `<div class="recibo-qr-wrap"><img src="${qrImg}" alt="Código QR de verificación" style="width:120px;height:120px;" /><p class="report-meta" style="margin-top:6px;">Escanea para verificar</p></div>` : ''}
      </div>

      ${filasPrestamos ? `
      <h2 class="report-meta" style="margin-top:20px; font-weight:600;">Préstamos cancelados</h2>
      <table style="margin-top:8px;">
        <thead><tr><th>Préstamo</th><th class="text-right">Monto</th><th>Inicio</th><th class="text-center">Estado</th></tr></thead>
        <tbody>${filasPrestamos}</tbody>
      </table>` : ''}

      <div class="recibo-footer">
        <p class="recibo-thanks">¡Gracias por tu confianza!</p>
        Por medio del presente documento, DALP Cobros certifica que el cliente arriba indicado ha cancelado en su totalidad la(s) deuda(s) registrada(s) a su nombre, sin mantener saldos pendientes a la fecha de emisión.<br>
        Generado el ${fechaGen}
      </div>`;

    const filename = 'constancia_cancelacion_' + d.nombre + '_' + (d.apellidos || '') + '.pdf';
    this.exportService.downloadPdfFromHtml(html, filename);
  }
}
