import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { PagosService, PagosFilter } from '../../services/pagos.service';
import { DeudoresService } from '../../services/deudores.service';
import { NotificationService } from '../../services/notification.service';
import { ExportService } from '../../services/export.service';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Pago, Deudor } from '../../models/index';

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

  pagos: Pago[] = [];
  deudores: Deudor[] = [];
  loading = true;
  loadingMore = false;
  totalPagos = 0;
  currentPage = 1;
  readonly PAGE_SIZE = 50;
  filters = this.fb.group({ desde: [''], hasta: [''], metodo: [''], deudor_id: [''] });

  // Modal de vista previa
  modalVisible = false;
  pagoPreview: Pago | null = null;
  pagoForm = this.fb.group({
    deudor_nombre: [''],
    concepto: [''],
    monto: [''],
    metodo_pago: [''],
    fecha_pago: [''],
    numero_operacion: ['']
  });
  modoModal: 'crear' | 'editar' = 'crear';

  sortBy: 'fecha' | 'deudor' | 'monto' | 'metodo' = 'fecha';
  sortDir: 'asc' | 'desc' = 'desc';

  get total(): number {
    return this.pagos.reduce((s, p) => s + +(p.monto || 0), 0);
  }

  get pagosOrdenados(): Pago[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...this.pagos].sort((a, b) => {
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
  }

  buscar(): void {
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
    this.filters.reset({ desde: '', hasta: '', metodo: '', deudor_id: '' });
    this.buscar();
  }

  abrirCrear(): void {
    this.modoModal = 'crear';
    this.pagoPreview = null;
    this.pagoForm.reset({
      deudor_nombre: '',
      concepto: '',
      monto: '',
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
    this.pagoForm.patchValue({
      deudor_nombre: pago.deudor_nombre || '',
      concepto: pago.concepto || '',
      monto: pago.monto != null ? String(pago.monto) : '',
      metodo_pago: pago.metodo_pago || 'efectivo',
      fecha_pago: pago.fecha_pago ? pago.fecha_pago.split('T')[0] : '',
      numero_operacion: pago.numero_operacion || ''
    });
    this.modalVisible = true;
    this.cdr.detectChanges();
  }

  get previewData(): any {
    const v = this.pagoForm.value as any;
    return {
      deudor_nombre: v.deudor_nombre || '-',
      concepto: v.concepto || '-',
      monto: v.monto || 0,
      metodo_pago: v.metodo_pago || '-',
      fecha_pago: v.fecha_pago || '',
      numero_operacion: v.numero_operacion || '-'
    };
  }

  confirmarGuardar(): void {
    const v = this.pagoForm.value as { deudor_nombre?: string; concepto?: string; monto?: string; metodo_pago?: string; fecha_pago?: string; numero_operacion?: string };
    const montoNum = +(v.monto ?? 0);
    const payload = { ...v, monto: montoNum };
    if (this.modoModal === 'crear') {
      this.pagosService.create(payload as any).subscribe({
        next: () => { this.cerrarModal(); this.buscar(); this.notify.success('Pago creado'); },
        error: (e) => { this.cerrarModal(); this.notify.error(e.error?.error || 'Error al crear pago'); }
      });
    } else if (this.pagoPreview?.id) {
      this.pagosService.update(this.pagoPreview.id, payload as Partial<Pago>).subscribe({
        next: () => { this.cerrarModal(); this.buscar(); this.notify.success('Pago actualizado'); },
        error: (e) => { this.cerrarModal(); this.notify.error(e.error?.error || 'Error al actualizar'); }
      });
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
    const rows: (string | number)[][] = [
      ['#', 'Fecha', 'Deudor', 'Concepto', 'Monto', 'Metodo', 'N Operacion']
    ];
    this.pagos.forEach((p, i) => {
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
    const total = this.pagos.reduce((s, p) => s + +(p.monto || 0), 0);
    rows.push(['', '', '', 'TOTAL', total, '', '']);
    this.exportService.downloadCsv(rows, 'pagos_' + new Date().toISOString().split('T')[0] + '.csv');
  }
}
