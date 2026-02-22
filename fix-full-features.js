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
        <div class="header-row">
          <h1>{{ deudor.nombre }} {{ deudor.apellidos }}</h1>
          <button class="btn-pdf" (click)="exportPDF()">📄 PDF</button>
          <button class="btn-excel" (click)="exportExcel()">📊 Excel</button>
        </div>
        <div class="tags">
          @if (deudor.dni) { <span class="tag">DNI: {{ deudor.dni }}</span> }
          @if (deudor.telefono) { <span class="tag">Tel: {{ deudor.telefono }}</span> }
          <span class="tag g">Cobrado: S/ {{ fmt(deudor.total_pagado) }}</span>
          <span class="tag r">Pendiente: S/ {{ fmt(deudor.saldo_pendiente) }}</span>
        </div>
      </div>

      <!-- PRESTAMOS -->
      <div class="sec-head">
        <span class="sec-lbl">Prestamos</span>
        <button class="btn-sm" (click)="togglePrestamo()">{{ showPrestamo ? '✕ Cancelar' : '+ Nuevo prestamo' }}</button>
      </div>
      @if (showPrestamo) {
        <div class="pform mb">
          <form [formGroup]="prestamoForm" (ngSubmit)="guardarPrestamo()">
            <div class="fgrid">
              <div class="f" [class.has-error]="pi('tipo')">
                <label>Tipo <span class="req">*</span></label>
                <select formControlName="tipo" [class.input-err]="pi('tipo')">
                  <option value="">Seleccionar...</option>
                  <option value="personal">Personal</option>
                  <option value="hipotecario">Hipotecario</option>
                  <option value="vehicular">Vehicular</option>
                  <option value="comercial">Comercial</option>
                  <option value="pandero">Pandero</option>
                  <option value="otro">Otro</option>
                </select>
                @if (pi('tipo')) { <span class="ferr">Selecciona un tipo</span> }
              </div>
              <div class="f" [class.has-error]="pi('monto_original')">
                <label>Monto <span class="req">*</span></label>
                <input type="number" formControlName="monto_original" placeholder="0.00" step="0.01" [class.input-err]="pi('monto_original')">
                @if (pi('monto_original')) { <span class="ferr">Obligatorio y mayor a 0</span> }
              </div>
              <div class="f" [class.has-error]="pi('fecha_inicio')">
                <label>Fecha inicio <span class="req">*</span></label>
                <input type="date" formControlName="fecha_inicio" [class.input-err]="pi('fecha_inicio')">
                @if (pi('fecha_inicio')) { <span class="ferr">Obligatorio</span> }
              </div>
              <div class="f"><label>Fecha fin</label><input type="date" formControlName="fecha_fin"></div>
              <div class="f"><label>Tasa interes %</label><input type="number" formControlName="tasa_interes" placeholder="0.00" step="0.01" min="0"></div>
              <div class="f"><label>Cuota mensual S/</label><input type="number" formControlName="cuota_mensual" placeholder="0.00" step="0.01" min="0"></div>
              <div class="f"><label>Total cuotas</label><input type="number" formControlName="total_cuotas" placeholder="1" min="1"></div>
              <div class="f"><label>Banco / Entidad</label><input type="text" formControlName="banco" placeholder="BCP, BBVA..."></div>
              <div class="f full"><label>Descripcion</label><input type="text" formControlName="descripcion" placeholder="Ej: Prestamo para negocio"></div>
              <div class="f full"><label>Notas</label><textarea formControlName="notas" rows="2"></textarea></div>
            </div>
            @if (prestamoErr) { <div class="form-alert">❌ {{ prestamoErr }}</div> }
            <div class="faction">
              <button type="submit" class="btn" [disabled]="savingPrestamo">{{ savingPrestamo ? 'Guardando...' : '✅ Crear prestamo' }}</button>
              @if (prestamoOk) { <span class="ok">✅ Creado!</span> }
            </div>
          </form>
        </div>
      }
      <div class="lgrid">
        @for (p of deudor.prestamos; track p.id) {
          <div class="lcard">
            <div class="lcard-head"><span class="ltype">{{ p.tipo }}</span><span [class]="'est e-'+p.estado">{{ p.estado }}</span></div>
            <span class="ldesc">{{ p.descripcion || 'Sin descripcion' }}</span>
            <span class="lamt">S/ {{ fmt(p.monto_original) }}</span>
            <div class="lmeta">
              <span class="tsm">{{ p.fecha_inicio | date:"dd/MM/yyyy" }}</span>
              @if (p.tasa_interes) { <span class="tsm">{{ p.tasa_interes }}%</span> }
              @if (p.cuota_mensual) { <span class="tsm">Cuota: S/ {{ fmt(p.cuota_mensual) }}</span> }
            </div>
          </div>
        }
        @if (!deudor.prestamos?.length) { <div class="empty">Sin prestamos.</div> }
      </div>

      <!-- PAGOS -->
      <div class="sec-lbl" style="margin:20px 0 10px;border-bottom:1px solid #2e3450;padding-bottom:6px">Historial de pagos</div>
      <div class="twrap">
        <table>
          <thead><tr><th>#</th><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Metodo</th><th>N Op.</th><th>Imagen</th><th>Acciones</th></tr></thead>
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
                    <button class="img-btn" (click)="verImagen(p.imagen_url)">🖼️ Ver</button>
                  } @else { <span class="mu">-</span> }
                </td>
                <td>
                  <div class="row-actions">
                    <button class="act-btn edit" (click)="editarPago(p)" title="Editar">✏️</button>
                    <button class="act-btn del" (click)="confirmarEliminar(p)" title="Eliminar">🗑️</button>
                  </div>
                </td>
              </tr>
            }
            @if (!deudor.pagos?.length) { <tr><td colspan="8" class="empty">Sin pagos</td></tr> }
          </tbody>
        </table>
      </div>

      <!-- REGISTRAR PAGO -->
      <div class="sec-lbl" style="margin:20px 0 10px;border-bottom:1px solid #2e3450;padding-bottom:6px">Registrar pago</div>
      <div class="pform">
        <form [formGroup]="pagoForm" (ngSubmit)="registrarPago()">
          <div class="fgrid">
            <div class="f">
              <label>Prestamo</label>
              <select formControlName="prestamo_id">
                <option [ngValue]="null">Sin especificar</option>
                @for (p of deudor.prestamos; track p.id) { <option [ngValue]="p.id">{{ p.descripcion || p.tipo }}</option> }
              </select>
            </div>
            <div class="f" [class.has-error]="fi('fecha_pago')">
              <label>Fecha <span class="req">*</span></label>
              <input type="date" formControlName="fecha_pago" [class.input-err]="fi('fecha_pago')">
              @if (fi('fecha_pago')) { <span class="ferr">Obligatorio</span> }
            </div>
            <div class="f" [class.has-error]="fi('monto')">
              <label>Monto <span class="req">*</span></label>
              <input type="number" formControlName="monto" placeholder="0.00" step="0.01" [class.input-err]="fi('monto')">
              @if (fi('monto')) { <span class="ferr">Obligatorio y mayor a 0</span> }
            </div>
            <div class="f" [class.has-error]="fi('metodo_pago')">
              <label>Metodo <span class="req">*</span></label>
              <select formControlName="metodo_pago" [class.input-err]="fi('metodo_pago')">
                <option value="">Seleccionar...</option>
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="transferencia">Transferencia</option>
                <option value="pandero">Pandero</option>
              </select>
              @if (fi('metodo_pago')) { <span class="ferr">Obligatorio</span> }
            </div>
            <div class="f"><label>N Operacion</label><input type="text" formControlName="numero_operacion" placeholder="Opcional"></div>
            <div class="f"><label>Concepto</label><input type="text" formControlName="concepto" placeholder="Opcional"></div>
            <div class="f full">
              <label>Comprobante <span class="hint">(PNG/JPG max 5MB)</span></label>
              <div class="upload-area" (click)="fileInput.click()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)" [class.upload-has-file]="imagenPreview">
                @if (imagenPreview) {
                  <img [src]="imagenPreview" class="preview">
                  <button type="button" class="remove-img" (click)="removeImage($event)">✕ Quitar</button>
                } @else {
                  <span class="upload-icon">📎</span>
                  <span class="upload-txt">Click o arrastra una imagen</span>
                  <span class="upload-sub">PNG, JPG hasta 5MB</span>
                }
              </div>
              @if (imgError) { <span class="ferr">{{ imgError }}</span> }
              <input #fileInput type="file" accept="image/png,image/jpg,image/jpeg" style="display:none" (change)="onFileChange($event)">
            </div>
          </div>
          <div class="faction">
            <button type="submit" class="btn" [disabled]="saving">
              @if (saving) { <span class="spinner"></span> }
              {{ saving ? 'Guardando...' : '✅ Registrar Pago' }}
            </button>
            @if (pagoOk) { <span class="ok">✅ Pago registrado!</span> }
            @if (pagoErr) { <span class="err">❌ {{ pagoErr }}</span> }
          </div>
        </form>
      </div>
    }
  </div>

  <!-- MODAL: VER IMAGEN -->
  @if (imgModal) {
    <div class="overlay" (click)="imgModal=null;cdr.detectChanges()">
      <div class="img-modal" (click)="$event.stopPropagation()">
        <div class="img-modal-head">
          <span>Comprobante</span>
          <div style="display:flex;gap:8px">
            <a [href]="imgModal" target="_blank" class="btn-dl">⬇️ Descargar</a>
            <button class="close-btn" (click)="imgModal=null;cdr.detectChanges()">✕</button>
          </div>
        </div>
        <img [src]="imgModal" class="img-full">
      </div>
    </div>
  }

  <!-- MODAL: EDITAR PAGO -->
  @if (editPago) {
    <div class="overlay" (click)="cerrarEditPago()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <h2>Editar pago</h2>
          <button class="close-btn" (click)="cerrarEditPago()">✕</button>
        </div>
        <form [formGroup]="editPagoForm" (ngSubmit)="guardarEditPago()">
          <div class="fgrid">
            <div class="f"><label>Fecha <span class="req">*</span></label><input type="date" formControlName="fecha_pago"></div>
            <div class="f"><label>Monto <span class="req">*</span></label><input type="number" formControlName="monto" step="0.01"></div>
            <div class="f"><label>Metodo <span class="req">*</span></label>
              <select formControlName="metodo_pago">
                <option value="efectivo">Efectivo</option>
                <option value="yape">Yape</option>
                <option value="plin">Plin</option>
                <option value="transferencia">Transferencia</option>
                <option value="pandero">Pandero</option>
              </select>
            </div>
            <div class="f"><label>N Operacion</label><input type="text" formControlName="numero_operacion"></div>
            <div class="f full"><label>Concepto</label><input type="text" formControlName="concepto"></div>
          </div>
          @if (editPagoErr) { <div class="form-alert">❌ {{ editPagoErr }}</div> }
          <div class="mfooter">
            <button type="button" class="btn-cancel" (click)="cerrarEditPago()">Cancelar</button>
            <button type="submit" class="btn-save" [disabled]="savingEdit">{{ savingEdit ? 'Guardando...' : 'Guardar cambios' }}</button>
          </div>
        </form>
      </div>
    </div>
  }

  <!-- MODAL: CONFIRMAR ELIMINAR -->
  @if (deletePago) {
    <div class="overlay" (click)="deletePago=null;cdr.detectChanges()">
      <div class="modal-sm" (click)="$event.stopPropagation()">
        <h3>¿Eliminar pago?</h3>
        <p>Pago de <strong>S/ {{ fmt(deletePago.monto) }}</strong> del {{ deletePago.fecha_pago | date:"dd/MM/yyyy" }}</p>
        <p class="warn-txt">Esta acción no se puede deshacer.</p>
        <div class="mfooter">
          <button class="btn-cancel" (click)="deletePago=null;cdr.detectChanges()">Cancelar</button>
          <button class="btn-del" (click)="eliminarPago()" [disabled]="deleting">{{ deleting ? 'Eliminando...' : '🗑️ Eliminar' }}</button>
        </div>
      </div>
    </div>
  }
  \`,
  styles: [\`
    .page{padding:24px;max-width:1100px}
    .empty{padding:30px;text-align:center;color:#7a839e}
    .back{color:#7a839e;text-decoration:none;font-size:.75rem;display:block;margin-bottom:8px}.back:hover{color:#4f8ef7}
    .header{margin-bottom:22px}
    .header-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
    h1{font-size:1.35rem;font-weight:700;flex:1}
    .btn-pdf{background:rgba(247,95,95,.15);color:#f75f5f;border:1px solid #f75f5f;border-radius:8px;padding:5px 12px;font-size:.73rem;cursor:pointer;font-family:inherit}
    .btn-excel{background:rgba(34,211,160,.15);color:#22d3a0;border:1px solid #22d3a0;border-radius:8px;padding:5px 12px;font-size:.73rem;cursor:pointer;font-family:inherit}
    .tags{display:flex;gap:8px;flex-wrap:wrap}
    .tag{font-size:.7rem;padding:3px 10px;border-radius:20px;background:#252a3a;border:1px solid #2e3450}
    .tag.g{color:#22d3a0;border-color:#22d3a0}.tag.r{color:#f75f5f;border-color:#f75f5f}
    .sec-head{display:flex;justify-content:space-between;align-items:center;margin:20px 0 10px;border-bottom:1px solid #2e3450;padding-bottom:8px}
    .sec-lbl{font-size:.68rem;text-transform:uppercase;letter-spacing:1px;color:#7a839e;font-weight:700}
    .btn-sm{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:8px;padding:5px 13px;font-size:.73rem;font-weight:600;cursor:pointer;font-family:inherit}
    .mb{margin-bottom:16px}
    .lgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:18px}
    .lcard{background:#1e2230;border:1px solid #2e3450;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px}
    .lcard-head{display:flex;justify-content:space-between;align-items:center}
    .ltype{font-size:.62rem;color:#7a839e;text-transform:uppercase;font-weight:600}
    .ldesc{font-size:.84rem;font-weight:600}
    .lamt{font-size:1.1rem;font-weight:700;color:#4f8ef7;font-family:monospace}
    .lmeta{display:flex;gap:6px;flex-wrap:wrap}
    .tsm{font-size:.62rem;padding:2px 6px;border-radius:8px;background:#252a3a;border:1px solid #2e3450}
    .est{font-size:.62rem;padding:2px 7px;border-radius:8px}
    .e-activo{background:rgba(79,142,247,.15);color:#4f8ef7}.e-pagado{background:rgba(34,211,160,.15);color:#22d3a0}.e-vencido{background:rgba(247,95,95,.15);color:#f75f5f}.e-cancelado{background:rgba(122,131,158,.15);color:#7a839e}
    .twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto;margin-bottom:18px}
    table{width:100%;border-collapse:collapse;font-size:.81rem}
    th{padding:9px 13px;text-align:left;font-size:.65rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}
    td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}
    .amt{color:#22d3a0;font-weight:600}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}
    .mb{font-size:.63rem;padding:2px 7px;border-radius:10px;text-transform:capitalize}
    .m-yape{background:rgba(100,50,200,.2);color:#b388ff}.m-efectivo{background:rgba(34,211,160,.15);color:#22d3a0}.m-transferencia{background:rgba(79,142,247,.15);color:#4f8ef7}.m-plin{background:rgba(247,135,79,.15);color:#f7874f}.m-pandero{background:rgba(247,201,72,.15);color:#f7c948}
    .img-btn{background:none;border:1px solid #2e3450;border-radius:6px;padding:3px 8px;font-size:.72rem;cursor:pointer;color:#e8ecf4}.img-btn:hover{border-color:#4f8ef7}
    .row-actions{display:flex;gap:4px}
    .act-btn{background:none;border:1px solid #2e3450;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:.8rem}
    .act-btn.edit:hover{border-color:#4f8ef7}.act-btn.del:hover{border-color:#f75f5f}
    .pform{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:20px}
    .fgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:13px}
    .f{display:flex;flex-direction:column;gap:5px}.f.full{grid-column:1/-1}
    .f.has-error label{color:#f75f5f}
    label{font-size:.68rem;color:#7a839e;text-transform:uppercase;letter-spacing:.4px}
    .req{color:#f75f5f}.hint{color:#7a839e;text-transform:none;font-weight:400}
    input,select,textarea{background:#0d0f14;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:8px 11px;font-size:.82rem;outline:none;font-family:inherit;transition:border-color .15s;width:100%;box-sizing:border-box}
    input:focus,select:focus,textarea:focus{border-color:#4f8ef7}
    input.input-err,select.input-err{border-color:#f75f5f!important}
    textarea{resize:vertical;min-height:60px}
    select option{background:#1e2230}
    .ferr{font-size:.68rem;color:#f75f5f}
    .form-alert{background:rgba(247,95,95,.1);border:1px solid rgba(247,95,95,.3);border-radius:8px;padding:10px 14px;font-size:.78rem;color:#f75f5f;margin-top:12px}
    .upload-area{background:#0d0f14;border:2px dashed #2e3450;border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:border-color .15s;min-height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
    .upload-area:hover{border-color:#4f8ef7}.upload-has-file{border-color:#4f8ef7;border-style:solid}
    .upload-icon{font-size:1.5rem}.upload-txt{font-size:.82rem;color:#e8ecf4}.upload-sub{font-size:.68rem;color:#7a839e}
    .preview{max-height:140px;max-width:100%;border-radius:6px;object-fit:contain}
    .remove-img{background:rgba(247,95,95,.15);color:#f75f5f;border:1px solid #f75f5f;border-radius:6px;padding:4px 10px;font-size:.7rem;cursor:pointer;margin-top:6px;font-family:inherit}
    .faction{margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
    .btn{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:10px 22px;font-weight:600;font-size:.82rem;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:8px}
    .btn:disabled{opacity:.6;cursor:not-allowed}
    .spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
    @keyframes spin{to{transform:rotate(360deg)}}
    .ok{font-size:.78rem;color:#22d3a0;font-weight:500}.err{font-size:.78rem;color:#f75f5f}
    /* Overlays */
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(3px)}
    .modal{background:#1e2230;border:1px solid #2e3450;border-radius:16px;padding:24px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto}
    .modal-sm{background:#1e2230;border:1px solid #2e3450;border-radius:16px;padding:28px;width:100%;max-width:380px;text-align:center}
    .modal-sm h3{font-size:1rem;font-weight:700;margin-bottom:10px}
    .modal-sm p{font-size:.82rem;color:#7a839e;margin-bottom:6px}
    .warn-txt{color:#f75f5f!important;font-size:.75rem!important}
    .modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
    .modal-head h2{font-size:1rem;font-weight:700}
    .close-btn{background:none;border:none;color:#7a839e;font-size:1.1rem;cursor:pointer}.close-btn:hover{color:#f75f5f}
    .mfooter{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
    .btn-cancel{background:none;border:1px solid #2e3450;color:#7a839e;border-radius:10px;padding:9px 18px;font-size:.82rem;cursor:pointer;font-family:inherit}
    .btn-save{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit}
    .btn-save:disabled,.btn-del:disabled{opacity:.6;cursor:not-allowed}
    .btn-del{background:rgba(247,95,95,.15);color:#f75f5f;border:1px solid #f75f5f;border-radius:10px;padding:9px 18px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit}
    .btn-dl{background:rgba(79,142,247,.15);color:#4f8ef7;border:1px solid #4f8ef7;border-radius:8px;padding:4px 10px;font-size:.72rem;text-decoration:none}
    .img-modal{background:#1e2230;border:1px solid #2e3450;border-radius:16px;padding:16px;max-width:90vw;max-height:90vh;display:flex;flex-direction:column;gap:12px}
    .img-modal-head{display:flex;justify-content:space-between;align-items:center;font-size:.85rem;font-weight:600}
    .img-full{max-width:80vw;max-height:75vh;object-fit:contain;border-radius:8px}
  \`]
})
export class DeudorDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  cdr = inject(ChangeDetectorRef);

  deudor: any;
  loading = true;

  // Pago nuevo
  saving = false; pagoOk = false; pagoErr = ''; pagoSubmitted = false;
  imagenFile: File | null = null; imagenPreview: string | null = null; imgError = '';

  // Prestamo nuevo
  showPrestamo = false; savingPrestamo = false; prestamoOk = false; prestamoErr = ''; prestamoSubmitted = false;

  // Ver imagen
  imgModal: string | null = null;

  // Editar pago
  editPago: any = null; savingEdit = false; editPagoErr = '';

  // Eliminar pago
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

  // Ver imagen
  verImagen(url: string): void { this.imgModal = url; this.cdr.detectChanges(); }

  // Editar pago
  editarPago(p: any): void {
    this.editPago = p; this.editPagoErr = '';
    const fecha = p.fecha_pago ? p.fecha_pago.split('T')[0] : '';
    this.editPagoForm.setValue({ fecha_pago: fecha, monto: p.monto, metodo_pago: p.metodo_pago, numero_operacion: p.numero_operacion || '', concepto: p.concepto || '' });
    this.cdr.detectChanges();
  }

  cerrarEditPago(): void { this.editPago = null; this.cdr.detectChanges(); }

  guardarEditPago(): void {
    if (this.editPagoForm.invalid) return;
    this.savingEdit = true; this.editPagoErr = '';
    this.http.put(environment.apiUrl + '/pagos/' + this.editPago.id, this.editPagoForm.value).subscribe({
      next: () => { this.savingEdit = false; this.editPago = null; this.load(); },
      error: (e) => { this.savingEdit = false; this.editPagoErr = e.error?.error || 'Error al actualizar'; this.cdr.detectChanges(); }
    });
  }

  // Eliminar pago
  confirmarEliminar(p: any): void { this.deletePago = p; this.cdr.detectChanges(); }

  eliminarPago(): void {
    this.deleting = true;
    this.http.delete(environment.apiUrl + '/pagos/' + this.deletePago.id).subscribe({
      next: () => { this.deleting = false; this.deletePago = null; this.load(); },
      error: () => { this.deleting = false; this.cdr.detectChanges(); }
    });
  }

  // Prestamo
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

  // Pago
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

  // Export Excel
  exportExcel(): void {
    if (!this.deudor) return;
    const rows = [
      ['#', 'Fecha', 'Concepto', 'Monto', 'Metodo', 'N Operacion'],
      ...this.deudor.pagos.map((p: any, i: number) => [
        i + 1,
        p.fecha_pago ? p.fecha_pago.split('T')[0] : '',
        p.concepto || '',
        +p.monto,
        p.metodo_pago,
        p.numero_operacion || ''
      ])
    ];
    const total = this.deudor.pagos.reduce((s: number, p: any) => s + +p.monto, 0);
    rows.push(['', '', 'TOTAL', total, '', '']);

    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\\n');
    const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pagos_' + this.deudor.nombre + '_' + this.deudor.apellidos + '.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  // Export PDF
  exportPDF(): void {
    if (!this.deudor) return;
    const d = this.deudor;
    const now = new Date().toLocaleDateString('es-PE');
    const pagosRows = d.pagos.map((p: any, i: number) => \`
      <tr>
        <td>\${i+1}</td>
        <td>\${p.fecha_pago ? p.fecha_pago.split('T')[0] : ''}</td>
        <td>\${p.concepto || '-'}</td>
        <td style="text-align:right">S/ \${(+(p.monto||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</td>
        <td>\${p.metodo_pago}</td>
        <td>\${p.numero_operacion || '-'}</td>
      </tr>\`).join('');
    const total = d.pagos.reduce((s: number, p: any) => s + +p.monto, 0);
    const prestamosRows = d.prestamos.map((p: any) => \`
      <tr>
        <td>\${p.tipo}</td>
        <td>\${p.descripcion || '-'}</td>
        <td style="text-align:right">S/ \${(+(p.monto_original||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</td>
        <td>\${p.estado}</td>
        <td>\${p.fecha_inicio ? p.fecha_inicio.split('T')[0] : ''}</td>
      </tr>\`).join('');

    const html = \`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Reporte - \${d.nombre} \${d.apellidos}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:11px;color:#222;padding:20px}
      h1{font-size:16px;margin-bottom:4px}
      .sub{color:#666;margin-bottom:16px;font-size:10px}
      .info{display:flex;gap:20px;margin-bottom:16px;background:#f5f5f5;padding:12px;border-radius:4px}
      .info-item{display:flex;flex-direction:column}
      .info-label{font-size:9px;color:#888;text-transform:uppercase}
      .info-val{font-size:13px;font-weight:bold}
      .green{color:#16a34a}.red{color:#dc2626}.blue{color:#2563eb}
      h2{font-size:12px;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:16px}
      th{background:#f5f5f5;padding:6px 8px;text-align:left;border:1px solid #ddd;font-size:9px}
      td{padding:5px 8px;border:1px solid #eee}
      tr:nth-child(even){background:#fafafa}
      .total-row{font-weight:bold;background:#f0f0f0}
      .footer{margin-top:20px;font-size:9px;color:#999;text-align:center}
    </style></head><body>
    <h1>Reporte de Cobros</h1>
    <div class="sub">Generado el \${now}</div>
    <div class="info">
      <div class="info-item"><span class="info-label">Deudor</span><span class="info-val">\${d.nombre} \${d.apellidos}</span></div>
      \${d.dni ? '<div class="info-item"><span class="info-label">DNI</span><span class="info-val">' + d.dni + '</span></div>' : ''}
      \${d.telefono ? '<div class="info-item"><span class="info-label">Telefono</span><span class="info-val">' + d.telefono + '</span></div>' : ''}
      <div class="info-item"><span class="info-label">Total cobrado</span><span class="info-val green">S/ \${(+(d.total_pagado||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</span></div>
      <div class="info-item"><span class="info-label">Saldo pendiente</span><span class="info-val red">S/ \${(+(d.saldo_pendiente||0)).toLocaleString('es-PE',{minimumFractionDigits:2})}</span></div>
    </div>
    <h2>Prestamos (\${d.prestamos.length})</h2>
    <table><thead><tr><th>Tipo</th><th>Descripcion</th><th>Monto</th><th>Estado</th><th>Inicio</th></tr></thead>
    <tbody>\${prestamosRows || '<tr><td colspan="5" style="text-align:center;color:#999">Sin prestamos</td></tr>'}</tbody></table>
    <h2>Historial de pagos (\${d.pagos.length})</h2>
    <table><thead><tr><th>#</th><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Metodo</th><th>N Op.</th></tr></thead>
    <tbody>\${pagosRows || '<tr><td colspan="6" style="text-align:center;color:#999">Sin pagos</td></tr>'}
    <tr class="total-row"><td colspan="3" style="text-align:right">TOTAL COBRADO</td><td style="text-align:right">S/ \${total.toLocaleString('es-PE',{minimumFractionDigits:2})}</td><td colspan="2"></td></tr>
    </tbody></table>
    <div class="footer">Sistema de Cobros — Reporte generado automaticamente</div>
    </body></html>\`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 500); }
  }

  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}`;

fs.writeFileSync('src/app/pages/deudor-detail/deudor-detail.component.ts', detail, 'utf8');
console.log('DeudorDetail OK - imagen, editar/eliminar pagos, Excel, PDF');
