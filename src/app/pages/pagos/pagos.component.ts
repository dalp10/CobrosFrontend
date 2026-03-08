import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { PagosService, PagosFilter } from '../../services/pagos.service';
import { NotificationService } from '../../services/notification.service';
import { ExportService } from '../../services/export.service';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Pago } from '../../models/index';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, FormatNumberPipe, SkeletonComponent],
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.css'
})
export class PagosComponent implements OnInit {
  private pagosService = inject(PagosService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private notify = inject(NotificationService);
  private exportService = inject(ExportService);

  pagos: Pago[] = [];
  loading = true;
  filters = this.fb.group({ desde: [''], hasta: [''], metodo: [''] });

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

  get total(): number {
    return this.pagos.reduce((s, p) => s + +(p.monto || 0), 0);
  }

  ngOnInit(): void {
    this.buscar();
  }

  buscar(): void {
    this.loading = true;
    const v = this.filters.value as { desde?: string; hasta?: string; metodo?: string };
    const filters: PagosFilter = { limit: 200 };
    if (v.desde) filters.desde = v.desde;
    if (v.hasta) filters.hasta = v.hasta;
    if (v.metodo) filters.metodo = v.metodo;
    this.pagosService.getAll(filters).subscribe({
      next: (r) => { this.pagos = r.data; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  limpiar(): void {
    this.filters.reset({ desde: '', hasta: '', metodo: '' });
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
