const fs = require('fs');

const detail = `import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-deudor-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  template: \`
  <div class="page">
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (deudor && !loading) {
      <div class="header">
        <a routerLink="/deudores" class="back">← Deudores</a>
        <h1>{{ deudor.nombre }} {{ deudor.apellidos }}</h1>
        <div class="tags">
          @if (deudor.dni) { <span class="tag">DNI: {{ deudor.dni }}</span> }
          @if (deudor.telefono) { <span class="tag">Tel: {{ deudor.telefono }}</span> }
          <span class="tag g">Cobrado: S/ {{ fmt(deudor.total_pagado) }}</span>
          <span class="tag r">Pendiente: S/ {{ fmt(deudor.saldo_pendiente) }}</span>
        </div>
      </div>

      <div class="sec">Prestamos</div>
      <div class="lgrid">
        @for (p of deudor.prestamos; track p.id) {
          <div class="lcard">
            <span class="ltype">{{ p.tipo }}</span>
            <span class="ldesc">{{ p.descripcion }}</span>
            <span class="lamt">S/ {{ fmt(p.monto_original) }}</span>
            <div class="lmeta">
              <span class="tsm">{{ p.fecha_inicio | date:"dd/MM/yyyy" }}</span>
              <span [class]="'tsm e-'+p.estado">{{ p.estado }}</span>
            </div>
          </div>
        }
        @if (!deudor.prestamos?.length) { <div class="empty">Sin prestamos</div> }
      </div>

      <div class="sec">Historial de pagos</div>
      <div class="twrap">
        <table>
          <thead><tr><th>#</th><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Metodo</th><th>N Op.</th><th>Imagen</th></tr></thead>
          <tbody>
            @for (p of deudor.pagos; track p.id; let i = $index) {
              <tr>
                <td class="mu">{{ i+1 }}</td>
                <td class="mo">{{ p.fecha_pago | date:"dd/MM/yyyy" }}</td>
                <td>{{ p.concepto || '-' }}</td>
                <td class="amt mo">S/ {{ fmt(p.monto) }}</td>
                <td><span [class]="'mb m-'+p.metodo_pago">{{ p.metodo_pago }}</span></td>
                <td class="mo mu">{{ p.numero_operacion || '-' }}</td>
                <td>
                  @if (p.imagen_url) {
                    <a [href]="p.imagen_url" target="_blank" class="imglink">Ver</a>
                  } @else { <span class="mu">-</span> }
                </td>
              </tr>
            }
            @if (!deudor.pagos?.length) { <tr><td colspan="7" class="empty">Sin pagos</td></tr> }
          </tbody>
        </table>
      </div>

      <div class="sec">Registrar pago</div>
      <div class="pform">
        <form [formGroup]="pagoForm" (ngSubmit)="registrarPago()">
          <div class="fgrid">

            <div class="f">
              <label>Prestamo</label>
              <select formControlName="prestamo_id">
                <option [ngValue]="null">Sin especificar</option>
                @for (p of deudor.prestamos; track p.id) { <option [ngValue]="p.id">{{ p.descripcion }}</option> }
              </select>
            </div>

            <div class="f" [class.has-error]="isInvalid('fecha_pago')">
              <label>Fecha <span class="req">*</span></label>
              <input type="date" formControlName="fecha_pago" [class.input-err]="isInvalid('fecha_pago')">
              @if (isInvalid('fecha_pago')) { <span class="ferr">La fecha es obligatoria</span> }
            </div>

            <div class="f" [class.has-error]="isInvalid('monto')">
              <label>Monto <span class="req">*</span></label>
              <input type="number" formControlName="monto" placeholder="0.00" step="0.01" [class.input-err]="isInvalid('monto')">
              @if (isInvalid('monto') && pagoForm.get('monto')?.errors?.['required']) { <span class="ferr">El monto es obligatorio</span> }
              @if (isInvalid('monto') && pagoForm.get('monto')?.errors?.['min']) { <span class="ferr">El monto debe ser mayor a 0</span> }
            </div>

            <div class="f" [class.has-error]="isInvalid('metodo_pago')">
              <label>Metodo <span class="req">*</span></label>
              <select formControlName="metodo_pago" [class.input-err]="isInvalid('metodo_pago')">
                <option value="">Seleccionar...</option>
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="transferencia">Transferencia</option>
                <option value="pandero">Pandero</option>
              </select>
              @if (isInvalid('metodo_pago')) { <span class="ferr">Selecciona un metodo</span> }
            </div>

            <div class="f">
              <label>N Operacion</label>
              <input type="text" formControlName="numero_operacion" placeholder="Opcional">
            </div>

            <div class="f">
              <label>Concepto</label>
              <input type="text" formControlName="concepto" placeholder="Opcional">
            </div>

            <div class="f full">
              <label>Comprobante <span class="hint">(imagen, max 5MB)</span></label>
              <div class="upload-area" (click)="fileInput.click()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)" [class.upload-has-file]="imagenPreview">
                @if (imagenPreview) {
                  <img [src]="imagenPreview" class="preview">
                  <button type="button" class="remove-img" (click)="removeImage($event)">✕ Quitar imagen</button>
                } @else {
                  <span class="upload-icon">📎</span>
                  <span class="upload-txt">Click o arrastra una imagen aqui</span>
                  <span class="upload-sub">PNG, JPG, JPEG hasta 5MB</span>
                }
              </div>
              @if (imgError) { <span class="ferr">{{ imgError }}</span> }
              <input #fileInput type="file" accept="image/png,image/jpg,image/jpeg" style="display:none" (change)="onFileChange($event)">
            </div>

          </div>

          @if (submitted && pagoForm.invalid) {
            <div class="form-alert">⚠️ Por favor completa los campos obligatorios marcados con *</div>
          }

          <div class="faction">
            <button type="submit" class="btn" [disabled]="saving">
              @if (saving) { <span class="spinner"></span> Guardando... }
              @else { ✅ Registrar Pago }
            </button>
            @if (pagoOk) { <span class="ok">✅ Pago registrado correctamente</span> }
            @if (pagoErr) { <span class="err">❌ {{ pagoErr }}</span> }
          </div>
        </form>
      </div>
    }
  </div>
  \`,
  styles: [\`
    .page{padding:24px;max-width:1100px}
    .empty{padding:30px;text-align:center;color:#7a839e}
    .back{color:#7a839e;text-decoration:none;font-size:.75rem;display:block;margin-bottom:8px}
    .back:hover{color:#4f8ef7}
    .header{margin-bottom:22px}
    h1{font-size:1.35rem;font-weight:700;margin-bottom:8px}
    .tags{display:flex;gap:8px;flex-wrap:wrap}
    .tag{font-size:.7rem;padding:3px 10px;border-radius:20px;background:#252a3a;border:1px solid #2e3450}
    .tag.g{color:#22d3a0;border-color:#22d3a0}
    .tag.r{color:#f75f5f;border-color:#f75f5f}
    .sec{font-size:.68rem;text-transform:uppercase;letter-spacing:1px;color:#7a839e;margin:20px 0 10px;font-weight:700;border-bottom:1px solid #2e3450;padding-bottom:6px}
    .lgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:18px}
    .lcard{background:#1e2230;border:1px solid #2e3450;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:4px}
    .ltype{font-size:.62rem;color:#7a839e;text-transform:uppercase}
    .ldesc{font-size:.84rem;font-weight:600}
    .lamt{font-size:1.1rem;font-weight:700;color:#4f8ef7;font-family:monospace}
    .lmeta{display:flex;gap:6px;flex-wrap:wrap}
    .tsm{font-size:.62rem;padding:2px 6px;border-radius:8px;background:#252a3a;border:1px solid #2e3450}
    .e-activo{color:#4f8ef7;border-color:#4f8ef7!important}
    .e-pagado{color:#22d3a0;border-color:#22d3a0!important}
    .e-vencido{color:#f75f5f;border-color:#f75f5f!important}
    .twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;font-size:.81rem}
    th{padding:9px 13px;text-align:left;font-size:.65rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}
    td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}
    .amt{color:#22d3a0;font-weight:600}
    .mo{font-family:monospace;font-size:.75rem}
    .mu{color:#7a839e}
    .mb{font-size:.63rem;padding:2px 7px;border-radius:10px;text-transform:capitalize}
    .m-yape{background:rgba(100,50,200,.2);color:#b388ff}
    .m-efectivo{background:rgba(34,211,160,.15);color:#22d3a0}
    .m-transferencia{background:rgba(79,142,247,.15);color:#4f8ef7}
    .m-plin{background:rgba(247,135,79,.15);color:#f7874f}
    .m-pandero{background:rgba(247,201,72,.15);color:#f7c948}
    .imglink{color:#4f8ef7;font-size:.72rem;text-decoration:none}
    .pform{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:20px}
    .fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:14px}
    .f{display:flex;flex-direction:column;gap:5px}
    .f.full{grid-column:1/-1}
    .f.has-error label{color:#f75f5f}
    label{font-size:.68rem;color:#7a839e;text-transform:uppercase;letter-spacing:.4px}
    .req{color:#f75f5f}
    .hint{color:#7a839e;text-transform:none;font-weight:400}
    input,select{background:#0d0f14;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:8px 11px;font-size:.82rem;outline:none;font-family:inherit;transition:border-color .15s}
    input:focus,select:focus{border-color:#4f8ef7}
    input.input-err,select.input-err{border-color:#f75f5f!important;background:rgba(247,95,95,.05)}
    select option{background:#1e2230}
    .ferr{font-size:.68rem;color:#f75f5f;margin-top:2px}
    .form-alert{background:rgba(247,95,95,.1);border:1px solid rgba(247,95,95,.3);border-radius:8px;padding:10px 14px;font-size:.78rem;color:#f75f5f;margin-top:12px}
    .upload-area{background:#0d0f14;border:2px dashed #2e3450;border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:border-color .15s;min-height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
    .upload-area:hover{border-color:#4f8ef7}
    .upload-has-file{border-color:#4f8ef7;border-style:solid}
    .upload-icon{font-size:1.5rem}
    .upload-txt{font-size:.82rem;color:#e8ecf4}
    .upload-sub{font-size:.68rem;color:#7a839e}
    .preview{max-height:140px;max-width:100%;border-radius:6px;object-fit:contain}
    .remove-img{background:rgba(247,95,95,.15);color:#f75f5f;border:1px solid #f75f5f;border-radius:6px;padding:4px 10px;font-size:.7rem;cursor:pointer;margin-top:6px;font-family:inherit}
    .faction{margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    .btn{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:10px 22px;font-weight:600;font-size:.82rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:8px;transition:opacity .15s}
    .btn:disabled{opacity:.6;cursor:not-allowed}
    .spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
    @keyframes spin{to{transform:rotate(360deg)}}
    .ok{font-size:.78rem;color:#22d3a0;font-weight:500}
    .err{font-size:.78rem;color:#f75f5f}
  \`]
})
export class DeudorDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  deudor: any;
  loading = true;
  saving = false;
  pagoOk = false;
  pagoErr = '';
  submitted = false;
  imagenFile: File | null = null;
  imagenPreview: string | null = null;
  imgError = '';

  pagoForm = this.fb.group({
    prestamo_id: [null],
    fecha_pago: [new Date().toISOString().split('T')[0], Validators.required],
    monto: [null, [Validators.required, Validators.min(0.01)]],
    metodo_pago: ['efectivo', Validators.required],
    numero_operacion: [''],
    concepto: ['']
  });

  ngOnInit(): void { this.load(); }

  isInvalid(field: string): boolean {
    const c = this.pagoForm.get(field);
    return !!(c && c.invalid && (c.touched || this.submitted));
  }

  load(): void {
    this.loading = true;
    const id = this.route.snapshot.params['id'];
    this.http.get<any>(environment.apiUrl + '/deudores/' + id).subscribe({
      next: (d) => { this.deudor = d; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  onFileChange(event: any): void {
    const file = event.target.files?.[0];
    if (file) this.validateAndSetFile(file);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.validateAndSetFile(file);
  }

  validateAndSetFile(file: File): void {
    this.imgError = '';
    if (!file.type.startsWith('image/')) {
      this.imgError = 'Solo se permiten imagenes (PNG, JPG, JPEG)';
      this.cdr.detectChanges();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.imgError = 'La imagen no puede superar los 5MB';
      this.cdr.detectChanges();
      return;
    }
    this.imagenFile = file;
    const reader = new FileReader();
    reader.onload = (e) => { this.imagenPreview = e.target?.result as string; this.cdr.detectChanges(); };
    reader.readAsDataURL(file);
  }

  removeImage(event: Event): void {
    event.stopPropagation();
    this.imagenFile = null;
    this.imagenPreview = null;
    this.imgError = '';
  }

  registrarPago(): void {
    this.submitted = true;
    if (this.pagoForm.invalid) {
      this.pagoForm.markAllAsTouched();
      this.cdr.detectChanges();
      return;
    }
    this.saving = true; this.pagoErr = ''; this.pagoOk = false;
    const v = this.pagoForm.value as any;
    const id = this.route.snapshot.params['id'];
    const fd = new FormData();
    Object.entries({ ...v, deudor_id: id }).forEach(([k, val]) => { if (val != null) fd.append(k, String(val)); });
    if (this.imagenFile) fd.append('imagen', this.imagenFile);
    this.http.post(environment.apiUrl + '/pagos', fd).subscribe({
      next: () => {
        this.saving = false; this.pagoOk = true; this.submitted = false;
        this.imagenFile = null; this.imagenPreview = null;
        this.pagoForm.reset({ fecha_pago: new Date().toISOString().split('T')[0], metodo_pago: 'efectivo' });
        this.cdr.detectChanges();
        this.load();
        setTimeout(() => { this.pagoOk = false; this.cdr.detectChanges(); }, 4000);
      },
      error: (e) => { this.saving = false; this.pagoErr = e.error?.error || 'Error al registrar el pago'; this.cdr.detectChanges(); }
    });
  }

  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}`;

fs.writeFileSync('src/app/pages/deudor-detail/deudor-detail.component.ts', detail, 'utf8');
console.log('DeudorDetail OK - con validaciones visuales');
