import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-deudor-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  templateUrl: './deudor-detail.component.html',
  styleUrl: './deudor-detail.component.css'
})
export class DeudorDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  cdr = inject(ChangeDetectorRef);

  deudor: any;
  loading = true;

  saving = false; pagoOk = false; pagoErr = ''; pagoSubmitted = false;
  imagenFile: File | null = null; imagenPreview: string | null = null; imgError = '';

  showPrestamo = false; savingPrestamo = false; prestamoOk = false; prestamoErr = ''; prestamoSubmitted = false;

  imgModal: string | null = null;
  editPago: any = null; savingEdit = false; editPagoErr = '';
  editImagenFile: File | null = null; editImagenPreview: string | null = null; editImagenError = ''; editRemoveImage = false;
  deletePago: any = null; deleting = false;

  pagoForm = this.fb.group({
    prestamo_id: [null],
    fecha_pago: [new Date().toISOString().split('T')[0], Validators.required],
    monto: [null, [Validators.required, Validators.min(0.01)]],
    metodo_pago: ['', Validators.required],
    numero_operacion: [''], concepto: ['']
  });

  prestamoForm = this.fb.group({
    tipo: ['', Validators.required],
    monto_original: [null, [Validators.required, Validators.min(0.01)]],
    fecha_inicio: [new Date().toISOString().split('T')[0], Validators.required],
    fecha_fin: [''], tasa_interes: [0], cuota_mensual: [null],
    total_cuotas: [1], banco: [''], numero_operacion: [''],
    descripcion: [''], notas: ['']
  });

  editPagoForm = this.fb.group({
    fecha_pago: ['', Validators.required],
    monto: [null, [Validators.required, Validators.min(0.01)]],
    metodo_pago: ['', Validators.required],
    numero_operacion: [''], concepto: ['']
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    const id = this.route.snapshot.params['id'];
    this.http.get<any>(environment.apiUrl + '/deudores/' + id).subscribe({
      next: (d) => { this.deudor = d; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  imgUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return environment.apiUrl.replace(/\/api$/, '') + url;
  }

  verImagen(url: string): void { this.imgModal = this.imgUrl(url); this.cdr.detectChanges(); }

  editarPago(p: any): void {
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
    this.http.put(environment.apiUrl + '/pagos/' + this.editPago.id, fd).subscribe({
      next: () => { this.savingEdit = false; this.editPago = null; this.load(); },
      error: (e) => { this.savingEdit = false; this.editPagoErr = e.error?.error || 'Error al actualizar'; this.cdr.detectChanges(); }
    });
  }

  confirmarEliminar(p: any): void { this.deletePago = p; this.cdr.detectChanges(); }

  eliminarPago(): void {
    this.deleting = true;
    this.http.delete(environment.apiUrl + '/pagos/' + this.deletePago.id).subscribe({
      next: () => { this.deleting = false; this.deletePago = null; this.load(); },
      error: () => { this.deleting = false; this.cdr.detectChanges(); }
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
    this.http.post(environment.apiUrl + '/prestamos', body).subscribe({
      next: () => {
        this.savingPrestamo = false; this.prestamoOk = true; this.prestamoSubmitted = false;
        this.prestamoForm.reset({ fecha_inicio: new Date().toISOString().split('T')[0], tasa_interes: 0, total_cuotas: 1 });
        this.cdr.detectChanges(); this.load();
        setTimeout(() => { this.prestamoOk = false; this.showPrestamo = false; this.cdr.detectChanges(); }, 2000);
      },
      error: (e) => { this.savingPrestamo = false; this.prestamoErr = e.error?.error || 'Error'; this.cdr.detectChanges(); }
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

  registrarPago(): void {
    this.pagoSubmitted = true;
    if (this.pagoForm.invalid) { this.pagoForm.markAllAsTouched(); this.cdr.detectChanges(); return; }
    this.saving = true; this.pagoErr = ''; this.pagoOk = false;
    const v = this.pagoForm.value as any;
    const id = this.route.snapshot.params['id'];
    const fd = new FormData();
    Object.entries({ ...v, deudor_id: id }).forEach(([k, val]) => { if (val != null) fd.append(k, String(val)); });
    if (this.imagenFile) fd.append('imagen', this.imagenFile);
    this.http.post(environment.apiUrl + '/pagos', fd).subscribe({
      next: () => {
        this.saving = false; this.pagoOk = true; this.pagoSubmitted = false;
        this.imagenFile = null; this.imagenPreview = null;
        this.pagoForm.reset({ fecha_pago: new Date().toISOString().split('T')[0] });
        this.cdr.detectChanges(); this.load();
        setTimeout(() => { this.pagoOk = false; this.cdr.detectChanges(); }, 3000);
      },
      error: (e) => { this.saving = false; this.pagoErr = e.error?.error || 'Error'; this.cdr.detectChanges(); }
    });
  }

  exportExcel(): void {
    if (!this.deudor) return;
    const rows = [
      ['#', 'Fecha', 'Concepto', 'Monto', 'Metodo', 'N Operacion'],
      ...this.deudor.pagos.map((p: any, i: number) => [i+1, p.fecha_pago ? p.fecha_pago.split('T')[0] : '', p.concepto || '', +p.monto, p.metodo_pago, p.numero_operacion || ''])
    ];
    const total = this.deudor.pagos.reduce((s: number, p: any) => s + +p.monto, 0);
    rows.push(['', '', 'TOTAL', total, '', '']);
    const csv = rows.map((r: any[]) => r.map((c: any) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pagos_' + this.deudor.nombre + '_' + this.deudor.apellidos + '.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  exportPDF(): void {
    if (!this.deudor) return;
    const d = this.deudor;
    const now = new Date().toLocaleDateString('es-PE');
    const pagosRows = d.pagos.map((p: any, i: number) => `<tr><td>${i+1}</td><td>${p.fecha_pago ? p.fecha_pago.split('T')[0] : ''}</td><td>${p.concepto || '-'}</td><td style="text-align:right">S/ ${(+(p.monto||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</td><td>${p.metodo_pago}</td><td>${p.numero_operacion || '-'}</td></tr>`).join('');
    const total = d.pagos.reduce((s: number, p: any) => s + +p.monto, 0);
    const prestamosRows = d.prestamos.map((p: any) => `<tr><td>${p.tipo}</td><td>${p.descripcion || '-'}</td><td style="text-align:right">S/ ${(+(p.monto_original||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</td><td>${p.estado}</td><td>${p.fecha_inicio ? p.fecha_inicio.split('T')[0] : ''}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte - ${d.nombre} ${d.apellidos}</title>
    <style>body{font-family:Arial,sans-serif;font-size:11px;color:#222;padding:20px}h1{font-size:16px;margin-bottom:4px}.sub{color:#666;margin-bottom:16px;font-size:10px}.info{display:flex;gap:20px;margin-bottom:16px;background:#f5f5f5;padding:12px;border-radius:4px}.info-item{display:flex;flex-direction:column}.info-label{font-size:9px;color:#888;text-transform:uppercase}.info-val{font-size:13px;font-weight:bold}.green{color:#16a34a}.red{color:#dc2626}h2{font-size:12px;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px}th{background:#f5f5f5;padding:6px 8px;text-align:left;border:1px solid #ddd;font-size:9px}td{padding:5px 8px;border:1px solid #eee}tr:nth-child(even){background:#fafafa}.total-row{font-weight:bold;background:#f0f0f0}.footer{margin-top:20px;font-size:9px;color:#999;text-align:center}</style>
    </head><body>
    <h1>Reporte de Cobros</h1><div class="sub">Generado el ${now}</div>
    <div class="info">
      <div class="info-item"><span class="info-label">Deudor</span><span class="info-val">${d.nombre} ${d.apellidos}</span></div>
      ${d.dni ? '<div class="info-item"><span class="info-label">DNI</span><span class="info-val">'+d.dni+'</span></div>' : ''}
      ${d.telefono ? '<div class="info-item"><span class="info-label">Telefono</span><span class="info-val">'+d.telefono+'</span></div>' : ''}
      <div class="info-item"><span class="info-label">Total cobrado</span><span class="info-val green">S/ ${(+(d.total_pagado||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</span></div>
      <div class="info-item"><span class="info-label">Saldo pendiente</span><span class="info-val red">S/ ${(+(d.saldo_pendiente||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</span></div>
    </div>
    <h2>Prestamos (${d.prestamos.length})</h2>
    <table><thead><tr><th>Tipo</th><th>Descripcion</th><th>Monto</th><th>Estado</th><th>Inicio</th></tr></thead>
    <tbody>${prestamosRows || '<tr><td colspan="5" style="text-align:center;color:#999">Sin prestamos</td></tr>'}</tbody></table>
    <h2>Historial de pagos (${d.pagos.length})</h2>
    <table><thead><tr><th>#</th><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Metodo</th><th>N Op.</th></tr></thead>
    <tbody>${pagosRows || '<tr><td colspan="6" style="text-align:center;color:#999">Sin pagos</td></tr>'}
    <tr class="total-row"><td colspan="3" style="text-align:right">TOTAL COBRADO</td><td style="text-align:right">S/ ${total.toLocaleString('es-PE',{minimumFractionDigits:2})}</td><td colspan="2"></td></tr>
    </tbody></table>
    <div class="footer">Sistema de Cobros — Reporte generado automaticamente</div>
    </body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
  }

  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}
