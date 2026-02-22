import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  templateUrl: './pagos.component.html',
  styleUrl: './pagos.component.css'
})
export class PagosComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  pagos: any[] = [];
  loading = true;
  filters = this.fb.group({ desde: [''], hasta: [''], metodo: [''] });

  // Modal de vista previa
  modalVisible = false;
  pagoPreview: any = null;
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
    const v = this.filters.value as any;
    let params = new HttpParams().set('limit', '200');
    if (v.desde) params = params.set('desde', v.desde);
    if (v.hasta) params = params.set('hasta', v.hasta);
    if (v.metodo) params = params.set('metodo', v.metodo);
    this.http.get<any>(environment.apiUrl + '/pagos', { params }).subscribe({
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

  abrirEditar(pago: any): void {
    this.modoModal = 'editar';
    this.pagoPreview = { ...pago };
    this.pagoForm.patchValue({
      deudor_nombre: pago.deudor_nombre || '',
      concepto: pago.concepto || '',
      monto: pago.monto || '',
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
    const v = this.pagoForm.value as any;
    const payload = { ...v, monto: +v.monto };
    if (this.modoModal === 'crear') {
      this.http.post<any>(environment.apiUrl + '/pagos', payload).subscribe({
        next: () => { this.cerrarModal(); this.buscar(); },
        error: () => { this.cerrarModal(); }
      });
    } else if (this.pagoPreview?.id) {
      this.http.put<any>(`${environment.apiUrl}/pagos/${this.pagoPreview.id}`, payload).subscribe({
        next: () => { this.cerrarModal(); this.buscar(); },
        error: () => { this.cerrarModal(); }
      });
    }
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.pagoPreview = null;
    this.cdr.detectChanges();
  }

  exportExcel(): void {
    const rows: any[][] = [
      ['#', 'Fecha', 'Deudor', 'Concepto', 'Monto', 'Metodo', 'N Operacion']
    ];
    this.pagos.forEach((p: any, i: number) => {
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
    const total = this.pagos.reduce((s: number, p: any) => s + +(p.monto || 0), 0);
    rows.push(['', '', '', 'TOTAL', total, '', '']);
    const csv = rows
      .map((r: any[]) => r.map((c: any) => '"' + String(c).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pagos_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  fmt(v: any): string {
    return (+(v ?? 0)).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
