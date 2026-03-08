import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PagosService, PagosFilter } from '../../services/pagos.service';
import { DeudoresService } from '../../services/deudores.service';
import { NotificationService } from '../../services/notification.service';
import { ExportService } from '../../services/export.service';
import { OcrComprobanteService } from '../../services/ocr-comprobante.service';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Pago, Deudor } from '../../models/index';
import type { MetodoPago } from '../../models/index';
import { fechaNoFutura, montoMax, fechaHastaMin } from '../../shared/validators';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, FormatNumberPipe, SkeletonComponent],
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.css'
})
export class PagosComponent implements OnInit {
  private pagosService = inject(PagosService);
  private deudoresService = inject(DeudoresService);
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
    concepto: [''],
    monto: [null as number | null, [Validators.required, Validators.min(0.01), montoMax(999_999.99)]],
    metodo_pago: ['efectivo', Validators.required],
    fecha_pago: [new Date().toISOString().split('T')[0], [Validators.required, fechaNoFutura()]],
    numero_operacion: ['']
  });
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
    this.pagosService.getAll(filters).subscribe({
      next: (r) => {
        this.pagos = r.data;
        this.totalPagos = r.total ?? r.data.length;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
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
    this.pagoForm.reset({
      deudor_id: null,
      concepto: '',
      monto: null,
      metodo_pago: 'efectivo',
      fecha_pago: new Date().toISOString().split('T')[0],
      numero_operacion: ''
    });
    this.modalVisible = true;
    this.cdr.detectChanges();
  }

  abrirEditar(pago: Pago): void {
    this.modoModal = 'editar';
    this.pagoPreview = { ...pago };
    this.imagenFile = null;
    this.imagenPreview = null;
    this.imgError = '';
    this.pagoForm.patchValue({
      deudor_id: pago.deudor_id,
      concepto: pago.concepto || '',
      monto: pago.monto ?? null,
      metodo_pago: pago.metodo_pago || 'efectivo',
      fecha_pago: pago.fecha_pago ? pago.fecha_pago.split('T')[0] : '',
      numero_operacion: pago.numero_operacion || ''
    });
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
    const f = e.dataTransfer?.files?.[0];
    if (f) this.validateAndSetFile(f);
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

  confirmarGuardar(): void {
    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }
    const v = this.pagoForm.value as { deudor_id: number; concepto?: string; monto: number; metodo_pago: string; fecha_pago: string; numero_operacion?: string };
    if (this.modoModal === 'crear') {
      const fd = new FormData();
      fd.append('deudor_id', String(v.deudor_id));
      fd.append('fecha_pago', v.fecha_pago);
      fd.append('monto', String(v.monto));
      fd.append('metodo_pago', v.metodo_pago);
      if (v.numero_operacion) fd.append('numero_operacion', v.numero_operacion);
      if (v.concepto) fd.append('concepto', v.concepto);
      if (this.imagenFile) fd.append('imagen', this.imagenFile);
      this.pagosService.createWithFormData(fd).subscribe({
        next: () => { this.cerrarModal(); this.buscar(); this.notify.success('Pago creado'); },
        error: (e) => { this.notify.error(e.error?.error || 'Error al crear pago'); this.cdr.detectChanges(); }
      });
    } else if (this.pagoPreview?.id) {
      if (this.imagenFile) {
        const fd = new FormData();
        fd.append('fecha_pago', v.fecha_pago);
        fd.append('monto', String(v.monto));
        fd.append('metodo_pago', v.metodo_pago);
        if (v.numero_operacion) fd.append('numero_operacion', v.numero_operacion);
        if (v.concepto) fd.append('concepto', v.concepto);
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
          concepto: v.concepto || undefined
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
}
