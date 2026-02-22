import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-deudores',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, ReactiveFormsModule, FormsModule],
  template: `
  <div class="page">
    <div class="topbar">
      <h1 class="title">Deudores</h1>
      <button class="btn-new" (click)="openModal()">+ Nuevo deudor</button>
    </div>

    <!-- ALERTAS -->
    @if (alertas.length) {
      <div class="alertas-box">
        <div class="alertas-head">
          <span>⚠️ Deudores sin pago reciente</span>
          <div class="dias-ctrl">
            <span>Mostrar sin pago hace más de</span>
            <select [(ngModel)]="diasAlerta" (change)="calcularAlertas()" [ngModelOptions]="{standalone:true}" class="dias-sel">
              <option [ngValue]="15">15 días</option>
              <option [ngValue]="30">30 días</option>
              <option [ngValue]="60">60 días</option>
              <option [ngValue]="90">90 días</option>
            </select>
          </div>
        </div>
        <div class="alertas-list">
          @for (a of alertas; track a.id) {
            <div class="alerta-item">
              <div class="alerta-avatar">{{ a.nombre[0] }}{{ a.apellidos[0] }}</div>
              <div class="alerta-info">
                <a [routerLink]="['/deudores', a.id]" class="alerta-name">{{ a.nombre }} {{ a.apellidos }}</a>
                <span class="alerta-meta">
                  @if (a.ultimo_pago) { Último pago: {{ a.ultimo_pago | date:"dd/MM/yyyy" }} (hace {{ diasDesde(a.ultimo_pago) }} días) }
                  @else { Sin pagos registrados }
                </span>
              </div>
              <span class="alerta-pendiente">S/ {{ fmt(a.saldo_pendiente) }}</span>
            </div>
          }
        </div>
      </div>
    }
    <div class="dias-config" style="margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <span style="font-size:.72rem;color:#7a839e">Alertas sin pago hace más de</span>
      <select [(ngModel)]="diasAlerta" (change)="calcularAlertas()" [ngModelOptions]="{standalone:true}" class="dias-sel">
        <option [ngValue]="15">15 días</option>
        <option [ngValue]="30">30 días</option>
        <option [ngValue]="60">60 días</option>
        <option [ngValue]="90">90 días</option>
      </select>
    </div>

    <input class="search" type="text" placeholder="Buscar por nombre, apellido o DNI..." [(ngModel)]="searchTerm" (input)="filtrar()" [ngModelOptions]="{standalone: true}">

    @if (loading) { <div class="empty">Cargando...</div> }
    @if (!loading && filtered.length === 0) { <div class="empty">Sin deudores encontrados.</div> }
    @if (!loading && filtered.length) {
      <div class="grid">
        @for (d of filtered; track d.id) {
          <div class="card">
            <div class="chead">
              <div class="avatar">{{ d.nombre[0] }}{{ d.apellidos[0] }}</div>
              <div class="cinfo">
                <a [routerLink]="['/deudores', d.id]" class="name">{{ d.nombre }} {{ d.apellidos }}</a>
                @if (d.dni) { <div class="sub">DNI {{ d.dni }}</div> }
                @if (d.telefono) { <div class="sub">{{ d.telefono }}</div> }
              </div>
              <div class="cactions">
                <button class="icon-btn edit" (click)="openModal(d)" title="Editar">✏️</button>
              </div>
            </div>
            <div class="nums">
              <div class="nitem"><span class="nlbl">Prestado</span><span class="nval blue">S/ {{ fmt(d.total_prestado) }}</span></div>
              <div class="nitem"><span class="nlbl">Cobrado</span><span class="nval green">S/ {{ fmt(d.total_pagado) }}</span></div>
              <div class="nitem"><span class="nlbl">Pendiente</span><span class="nval red">S/ {{ fmt(d.saldo_pendiente) }}</span></div>
            </div>
            <div class="prog">
              <div class="pbar"><div class="pfill" [style.width.%]="pct(d.total_pagado, d.total_prestado)"></div></div>
              <span class="ppct">{{ pct(d.total_pagado, d.total_prestado) | number:"1.0-0" }}%</span>
            </div>
            <div class="foot">
              @if (d.ultimo_pago) { <span>Ultimo pago: {{ d.ultimo_pago | date:"dd/MM/yyyy" }}</span> }
              @else { <span class="mu">Sin pagos aun</span> }
              <a [routerLink]="['/deudores', d.id]" class="ver">Ver detalle →</a>
            </div>
          </div>
        }
      </div>
    }
  </div>

  <!-- MODAL -->
  @if (showModal) {
    <div class="overlay" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <h2>{{ editando ? 'Editar deudor' : 'Nuevo deudor' }}</h2>
          <button class="close-btn" (click)="closeModal()">✕</button>
        </div>
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="mgrid">
            <div class="f" [class.has-error]="fi('nombre')">
              <label>Nombre <span class="req">*</span></label>
              <input type="text" formControlName="nombre" placeholder="Juan">
              @if (fi('nombre')) { <span class="ferr">El nombre es obligatorio</span> }
            </div>
            <div class="f" [class.has-error]="fi('apellidos')">
              <label>Apellidos <span class="req">*</span></label>
              <input type="text" formControlName="apellidos" placeholder="Perez Garcia">
              @if (fi('apellidos')) { <span class="ferr">Los apellidos son obligatorios</span> }
            </div>
            <div class="f">
              <label>DNI</label>
              <input type="text" formControlName="dni" placeholder="12345678" maxlength="8">
            </div>
            <div class="f">
              <label>Telefono</label>
              <input type="text" formControlName="telefono" placeholder="999888777">
            </div>
            <div class="f">
              <label>Email</label>
              <input type="email" formControlName="email" placeholder="correo@ejemplo.com">
            </div>
            <div class="f">
              <label>Direccion</label>
              <input type="text" formControlName="direccion" placeholder="Av. Lima 123">
            </div>
            <div class="f full">
              <label>Notas</label>
              <textarea formControlName="notas" placeholder="Informacion adicional..." rows="2"></textarea>
            </div>
          </div>

          @if (formErr) { <div class="form-alert">❌ {{ formErr }}</div> }

          <div class="mfooter">
            <button type="button" class="btn-cancel" (click)="closeModal()">Cancelar</button>
            <button type="submit" class="btn-save" [disabled]="saving">
              {{ saving ? 'Guardando...' : (editando ? 'Guardar cambios' : 'Crear deudor') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  }
  `,
  styles: [`
    .page{padding:24px;max-width:1200px}
    .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    .title{font-size:1.35rem;font-weight:700}
    .btn-new{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:9px 18px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit}
    .alertas-box{background:rgba(247,201,72,.06);border:1px solid rgba(247,201,72,.25);border-radius:12px;padding:14px 16px;margin-bottom:16px}
    .alertas-head{display:flex;justify-content:space-between;align-items:center;font-size:.78rem;font-weight:600;color:#f7c948;margin-bottom:10px}
    .alertas-list{display:flex;flex-direction:column;gap:8px}
    .alerta-item{display:flex;align-items:center;gap:10px;background:rgba(247,201,72,.05);border-radius:8px;padding:8px 10px}
    .alerta-avatar{width:32px;height:32px;border-radius:50%;background:rgba(247,201,72,.2);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:#f7c948;flex-shrink:0}
    .alerta-info{flex:1}
    .alerta-name{color:#f7c948;text-decoration:none;font-size:.82rem;font-weight:600;display:block}.alerta-name:hover{text-decoration:underline}
    .alerta-meta{font-size:.67rem;color:#7a839e}
    .alerta-pendiente{font-family:monospace;font-size:.78rem;color:#f75f5f;font-weight:700}
    .dias-sel{background:#1e2230;border:1px solid #2e3450;border-radius:6px;color:#e8ecf4;padding:3px 8px;font-size:.72rem;outline:none;font-family:inherit}
    .dias-ctrl{display:flex;align-items:center;gap:8px;font-size:.72rem;font-weight:400;color:#7a839e}
    .search{width:100%;background:#1e2230;border:1px solid #2e3450;border-radius:10px;color:#e8ecf4;padding:10px 14px;font-size:.85rem;outline:none;font-family:inherit;margin-bottom:18px;box-sizing:border-box}
    .search:focus{border-color:#4f8ef7}
    .empty{padding:40px;text-align:center;color:#7a839e}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
    .card{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:14px;transition:border-color .15s}
    .card:hover{border-color:#4f8ef7}
    .chead{display:flex;align-items:flex-start;gap:12px}
    .avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#4f8ef7,#7c5cfc);display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;color:#fff;flex-shrink:0}
    .cinfo{flex:1}
    .name{color:#e8ecf4;text-decoration:none;font-weight:600;font-size:.92rem;display:block}
    .name:hover{color:#4f8ef7}
    .sub{font-size:.68rem;color:#7a839e;margin-top:1px}
    .cactions{display:flex;gap:4px}
    .icon-btn{background:none;border:1px solid #2e3450;border-radius:6px;padding:4px 7px;cursor:pointer;font-size:.8rem;transition:border-color .15s}
    .icon-btn.edit:hover{border-color:#4f8ef7}
    .nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .nitem{display:flex;flex-direction:column;gap:2px}
    .nlbl{font-size:.6rem;color:#7a839e;text-transform:uppercase}
    .nval{font-size:.78rem;font-weight:700;font-family:monospace;color:#e8ecf4}
    .green{color:#22d3a0!important}.blue{color:#4f8ef7!important}.red{color:#f75f5f!important}
    .prog{display:flex;align-items:center;gap:8px}
    .pbar{flex:1;height:5px;background:#2e3450;border-radius:3px;overflow:hidden}
    .pfill{height:100%;background:#22d3a0;border-radius:3px}
    .foot{display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:#7a839e}
    .ver{color:#4f8ef7;text-decoration:none;font-size:.7rem}
    .mu{color:#7a839e}
    /* Modal */
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(2px)}
    .modal{background:#1e2230;border:1px solid #2e3450;border-radius:16px;padding:24px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto}
    .modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
    .modal-head h2{font-size:1rem;font-weight:700}
    .close-btn{background:none;border:none;color:#7a839e;font-size:1.1rem;cursor:pointer;padding:4px}
    .close-btn:hover{color:#f75f5f}
    .mgrid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
    .f{display:flex;flex-direction:column;gap:5px}
    .f.full{grid-column:1/-1}
    .f.has-error label{color:#f75f5f}
    label{font-size:.68rem;color:#7a839e;text-transform:uppercase;letter-spacing:.4px}
    .req{color:#f75f5f}
    input,select,textarea{background:#0d0f14;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:8px 11px;font-size:.82rem;outline:none;font-family:inherit;transition:border-color .15s;width:100%;box-sizing:border-box}
    input:focus,select:focus,textarea:focus{border-color:#4f8ef7}
    input.input-err{border-color:#f75f5f!important}
    textarea{resize:vertical;min-height:60px}
    .ferr{font-size:.68rem;color:#f75f5f}
    .form-alert{background:rgba(247,95,95,.1);border:1px solid rgba(247,95,95,.3);border-radius:8px;padding:10px 14px;font-size:.78rem;color:#f75f5f;margin-top:12px}
    .mfooter{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
    .btn-cancel{background:none;border:1px solid #2e3450;color:#7a839e;border-radius:10px;padding:9px 18px;font-size:.82rem;cursor:pointer;font-family:inherit}
    .btn-cancel:hover{border-color:#7a839e;color:#e8ecf4}
    .btn-save{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit}
    .btn-save:disabled{opacity:.6;cursor:not-allowed}
  `]
})
export class DeudoresComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  deudores: any[] = [];
  filtered: any[] = [];
  loading = true;
  showModal = false;
  editando: any = null;
  saving = false;
  formErr = '';
  submitted = false;
  searchTerm = '';
  diasAlerta = 30;
  alertas: any[] = [];

  form = this.fb.group({
    nombre:    ['', Validators.required],
    apellidos: ['', Validators.required],
    dni:       [''],
    telefono:  [''],
    email:     [''],
    direccion: [''],
    notas:     ['']
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.http.get<any[]>(environment.apiUrl + '/deudores').subscribe({
      next: (d) => { this.deudores = d; this.filtrar(); this.calcularAlertas(); this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  filtrar(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) { this.filtered = this.deudores; return; }
    this.filtered = this.deudores.filter(d =>
      (d.nombre + ' ' + d.apellidos).toLowerCase().includes(term) ||
      (d.dni || '').includes(term) ||
      (d.telefono || '').includes(term)
    );
    this.cdr.detectChanges();
  }

  openModal(deudor?: any): void {
    this.editando = deudor || null;
    this.submitted = false;
    this.formErr = '';
    if (deudor) {
      this.form.setValue({
        nombre:    deudor.nombre    || '',
        apellidos: deudor.apellidos || '',
        dni:       deudor.dni       || '',
        telefono:  deudor.telefono  || '',
        email:     deudor.email     || '',
        direccion: deudor.direccion || '',
        notas:     deudor.notas     || ''
      });
    } else {
      this.form.reset();
    }
    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
    this.editando = null;
    this.cdr.detectChanges();
  }

  fi(field: string): boolean {
    const c = this.form.get(field);
    return !!(c && c.invalid && (c.touched || this.submitted));
  }

  guardar(): void {
    this.submitted = true;
    if (this.form.invalid) { this.form.markAllAsTouched(); this.cdr.detectChanges(); return; }
    this.saving = true; this.formErr = '';
    const v = this.form.value;
    const req = this.editando
      ? this.http.put(environment.apiUrl + '/deudores/' + this.editando.id, v)
      : this.http.post(environment.apiUrl + '/deudores', v);
    req.subscribe({
      next: () => { this.saving = false; this.closeModal(); this.load(); },
      error: (e) => { this.saving = false; this.formErr = e.error?.error || 'Error al guardar'; this.cdr.detectChanges(); }
    });
  }

  calcularAlertas(): void {
    const hoy = new Date();
    this.alertas = this.deudores.filter(d => {
      if (+d.saldo_pendiente <= 0) return false;
      if (!d.ultimo_pago) return true;
      const diff = Math.floor((hoy.getTime() - new Date(d.ultimo_pago).getTime()) / 86400000);
      return diff >= this.diasAlerta;
    });
    this.cdr.detectChanges();
  }

  diasDesde(fecha: string): number {
    return Math.floor((new Date().getTime() - new Date(fecha).getTime()) / 86400000);
  }

  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  pct(paid: any, total: any): number { return total ? Math.min(100,(+(paid||0)/+total)*100) : 0; }
}