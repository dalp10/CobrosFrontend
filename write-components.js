const fs = require('fs');
const path = require('path');

const files = {
'src/app/pages/prestamos/prestamos.component.ts': `
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PrestamosService } from '../../services/prestamos.service';

@Component({
  selector: 'app-prestamos',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: \`
  <div class="page">
    <h1 class="title">Prestamos</h1>
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (!loading) {
      <div class="twrap">
        <table>
          <thead><tr><th>Deudor</th><th>Tipo</th><th>Monto</th><th>Cobrado</th><th>Pendiente</th><th>Inicio</th><th>Estado</th></tr></thead>
          <tbody>
            @for (p of prestamos; track p.id) {
              <tr>
                <td><a [routerLink]="['/deudores', p.deudor_id]" class="dlink">{{ p.deudor_nombre }}</a></td>
                <td>{{ p.tipo }}</td>
                <td class="amt mo">S/ {{ fmt(p.monto_original) }}</td>
                <td class="mo g">S/ {{ fmt(p.total_pagado) }}</td>
                <td class="mo r">S/ {{ fmt(p.saldo_pendiente) }}</td>
                <td class="mo mu">{{ p.fecha_inicio | date:"dd/MM/yyyy" }}</td>
                <td>{{ p.estado }}</td>
              </tr>
            }
            @if (!prestamos.length) { <tr><td colspan="7" class="empty">Sin prestamos</td></tr> }
          </tbody>
        </table>
      </div>
    }
  </div>
  \`,
  styles: [\`.page{padding:24px;max-width:1300px}.title{font-size:1.35rem;font-weight:700;margin-bottom:18px}.empty{padding:30px;text-align:center;color:#7a839e}.twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.8rem}th{padding:9px 13px;text-align:left;font-size:.62rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}.amt{color:#4f8ef7;font-weight:700}.g{color:#22d3a0}.r{color:#f75f5f}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}.dlink{color:#4f8ef7;text-decoration:none;font-weight:600}\`]
})
export class PrestamosComponent implements OnInit {
  private svc = inject(PrestamosService);
  prestamos: any[] = [];
  loading = true;
  ngOnInit(): void {
    this.svc.getAll().subscribe({
      next: (p: any) => { this.prestamos = p; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}
`.trim(),

'src/app/pages/deudores/deudores.component.ts': `
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DeudoresService } from '../../services/deudores.service';

@Component({
  selector: 'app-deudores',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: \`
  <div class="page">
    <h1 class="title">Deudores</h1>
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (!loading && deudores.length === 0) { <div class="empty">Sin deudores.</div> }
    @if (!loading && deudores.length) {
      <div class="grid">
        @for (d of deudores; track d.id) {
          <a [routerLink]="['/deudores', d.id]" class="card">
            <div class="chead">
              <div class="avatar">{{ d.nombre[0] }}{{ d.apellidos[0] }}</div>
              <div>
                <div class="name">{{ d.nombre }} {{ d.apellidos }}</div>
                @if (d.dni) { <div class="sub">DNI {{ d.dni }}</div> }
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
              @if (d.ultimo_pago) { <span>Ultimo: {{ d.ultimo_pago | date:"dd/MM/yyyy" }}</span> }
              @else { <span class="mu">Sin pagos</span> }
              <span class="arrow">→</span>
            </div>
          </a>
        }
      </div>
    }
  </div>
  \`,
  styles: [\`.page{padding:24px;max-width:1200px}.title{font-size:1.35rem;font-weight:700;margin-bottom:20px}.empty{padding:40px;text-align:center;color:#7a839e}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.card{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:18px;text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:14px;transition:border-color .15s,transform .15s}.card:hover{border-color:#4f8ef7;transform:translateY(-2px)}.chead{display:flex;align-items:center;gap:12px}.avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#4f8ef7,#7c5cfc);display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;color:#fff;flex-shrink:0}.name{font-size:.92rem;font-weight:600}.sub{font-size:.68rem;color:#7a839e}.nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.nitem{display:flex;flex-direction:column;gap:2px}.nlbl{font-size:.6rem;color:#7a839e;text-transform:uppercase}.nval{font-size:.78rem;font-weight:700;font-family:monospace;color:#e8ecf4}.green{color:#22d3a0!important}.blue{color:#4f8ef7!important}.red{color:#f75f5f!important}.prog{display:flex;align-items:center;gap:8px}.pbar{flex:1;height:5px;background:#2e3450;border-radius:3px;overflow:hidden}.pfill{height:100%;background:#22d3a0;border-radius:3px}.foot{display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:#7a839e}.arrow{color:#4f8ef7}.mu{color:#7a839e}\`]
})
export class DeudoresComponent implements OnInit {
  private svc = inject(DeudoresService);
  deudores: any[] = [];
  loading = true;
  ngOnInit(): void {
    this.svc.getAll().subscribe({
      next: (d: any) => { this.deudores = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  pct(paid: any, total: any): number { return total ? Math.min(100,(+(paid||0)/+total)*100) : 0; }
}
`.trim(),

'src/app/pages/pagos/pagos.component.ts': `
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { PagosService } from '../../services/pagos.service';

@Component({
  selector: 'app-pagos',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  template: \`
  <div class="page">
    <h1 class="title">Pagos</h1>
    <form [formGroup]="filters" (ngSubmit)="buscar()" class="filtros">
      <input type="date" formControlName="desde">
      <input type="date" formControlName="hasta">
      <select formControlName="metodo">
        <option value="">Todos</option>
        <option value="efectivo">Efectivo</option>
        <option value="yape">Yape</option>
        <option value="plin">Plin</option>
        <option value="transferencia">Transferencia</option>
        <option value="pandero">Pandero</option>
      </select>
      <button type="submit" class="btn">Filtrar</button>
      <button type="button" class="btn-clr" (click)="limpiar()">Limpiar</button>
    </form>
    @if (pagos.length) {
      <div class="totbar"><span>{{ pagos.length }} pagos</span><span class="tot">Total: S/ {{ fmt(total) }}</span></div>
    }
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (!loading) {
      <div class="twrap">
        <table>
          <thead><tr><th>#</th><th>Fecha</th><th>Deudor</th><th>Concepto</th><th>Monto</th><th>Metodo</th></tr></thead>
          <tbody>
            @for (p of pagos; track p.id; let i = $index) {
              <tr>
                <td class="mu">{{ i+1 }}</td>
                <td class="mo">{{ p.fecha_pago | date:"dd/MM/yyyy" }}</td>
                <td><a [routerLink]="['/deudores', p.deudor_id]" class="dlink">{{ p.deudor_nombre || '-' }}</a></td>
                <td>{{ p.concepto || '-' }}</td>
                <td class="amt mo">S/ {{ fmt(p.monto) }}</td>
                <td><span [class]="'mb m-'+p.metodo_pago">{{ p.metodo_pago }}</span></td>
              </tr>
            }
            @if (!pagos.length) { <tr><td colspan="6" class="empty">Sin pagos</td></tr> }
          </tbody>
        </table>
      </div>
    }
  </div>
  \`,
  styles: [\`.page{padding:24px;max-width:1200px}.title{font-size:1.35rem;font-weight:700;margin-bottom:18px}.filtros{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:center}input,select{background:#1e2230;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:7px 11px;font-size:.8rem;outline:none;font-family:inherit}.btn{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:8px;padding:7px 16px;font-size:.8rem;cursor:pointer;font-family:inherit}.btn-clr{background:none;border:1px solid #2e3450;color:#7a839e;border-radius:8px;padding:7px 12px;font-size:.8rem;cursor:pointer;font-family:inherit}.totbar{display:flex;justify-content:space-between;font-size:.8rem;color:#7a839e;margin-bottom:10px;padding:8px 12px;background:#1e2230;border-radius:8px;border:1px solid #2e3450}.tot{color:#22d3a0;font-family:monospace;font-weight:700}.empty{padding:30px;text-align:center;color:#7a839e}.twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.81rem}th{padding:9px 13px;text-align:left;font-size:.63rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}.amt{color:#22d3a0;font-weight:700}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}.dlink{color:#4f8ef7;text-decoration:none;font-weight:600}.mb{font-size:.63rem;padding:2px 7px;border-radius:10px;text-transform:capitalize}.m-yape{background:rgba(100,50,200,.2);color:#b388ff}.m-efectivo{background:rgba(34,211,160,.15);color:#22d3a0}.m-transferencia{background:rgba(79,142,247,.15);color:#4f8ef7}.m-plin{background:rgba(247,135,79,.15);color:#f7874f}.m-pandero{background:rgba(247,201,72,.15);color:#f7c948}\`]
})
export class PagosComponent implements OnInit {
  private svc = inject(PagosService);
  private fb = inject(FormBuilder);
  pagos: any[] = [];
  loading = true;
  filters = this.fb.group({ desde: [''], hasta: [''], metodo: [''] });
  get total(): number { return this.pagos.reduce((s,p) => s + +(p.monto||0), 0); }
  ngOnInit(): void { this.buscar(); }
  buscar(): void {
    this.loading = true;
    const v = this.filters.value as any;
    this.svc.getAll({ desde: v.desde||undefined, hasta: v.hasta||undefined, metodo: v.metodo||undefined, limit: 200 }).subscribe({
      next: (r: any) => { this.pagos = r.data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
  limpiar(): void { this.filters.reset({ desde:'', hasta:'', metodo:'' }); this.buscar(); }
  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}
`.trim(),

'src/app/layout/layout.component.ts': `
import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: \`
  <div class="shell">
    <nav class="sidebar">
      <div class="logo">Cobros</div>
      <ul class="nav">
        <li><a routerLink="/dashboard" routerLinkActive="active">Dashboard</a></li>
        <li><a routerLink="/deudores" routerLinkActive="active">Deudores</a></li>
        <li><a routerLink="/prestamos" routerLinkActive="active">Prestamos</a></li>
        <li><a routerLink="/pagos" routerLinkActive="active">Pagos</a></li>
      </ul>
      <div class="footer">
        @if (auth.currentUser(); as u) {
          <span class="uname">{{ u.nombre }}</span>
          <span class="urole">{{ u.rol }}</span>
        }
        <button (click)="auth.logout()">Salir</button>
      </div>
    </nav>
    <main class="content"><router-outlet></router-outlet></main>
  </div>
  \`,
  styles: [\`.shell{display:flex;height:100vh;overflow:hidden}.sidebar{width:220px;min-width:220px;background:#161920;border-right:1px solid #2e3450;display:flex;flex-direction:column;padding:20px 0}.logo{font-size:1.1rem;font-weight:700;padding:0 20px 24px;color:#4f8ef7}.nav{list-style:none;flex:1;padding:0;margin:0}.nav a{display:block;padding:10px 20px;color:#7a839e;text-decoration:none;font-size:.85rem;font-weight:500;border-left:3px solid transparent;transition:all .15s}.nav a:hover{color:#e8ecf4;background:rgba(255,255,255,.04)}.nav a.active{color:#4f8ef7;border-left-color:#4f8ef7;background:rgba(79,142,247,.08)}.footer{padding:16px 20px;border-top:1px solid #2e3450}.uname{font-size:.82rem;font-weight:600;display:block;color:#e8ecf4}.urole{font-size:.65rem;color:#7a839e;text-transform:uppercase;display:block}button{margin-top:10px;background:none;border:1px solid #2e3450;color:#7a839e;border-radius:8px;padding:6px 12px;font-size:.75rem;cursor:pointer;width:100%;font-family:inherit}.content{flex:1;overflow-y:auto;background:#0d0f14}\`]
})
export class LayoutComponent {
  auth = inject(AuthService);
}
`.trim(),

'src/app/pages/login/login.component.ts': `
import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
  <div class="page">
    <div class="card">
      <div class="logo">Sistema de Cobros</div>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <div class="field">
          <label>Email</label>
          <input type="email" formControlName="email" placeholder="admin@cobros.com">
        </div>
        <div class="field">
          <label>Contrasena</label>
          <input type="password" formControlName="password" placeholder="admin123">
        </div>
        <button type="submit" [disabled]="loading">{{ loading ? 'Ingresando...' : 'Ingresar' }}</button>
        @if (error) { <p class="err">{{ error }}</p> }
      </form>
    </div>
  </div>
  \`,
  styles: [\`.page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0f14}.card{background:#1e2230;border:1px solid #2e3450;border-radius:16px;padding:32px;width:360px}.logo{font-size:1.2rem;font-weight:700;text-align:center;margin-bottom:24px;color:#e8ecf4}.field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}label{font-size:.72rem;color:#7a839e;text-transform:uppercase;letter-spacing:.4px}input{background:#0d0f14;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:10px 12px;font-size:.85rem;outline:none;font-family:inherit}input:focus{border-color:#4f8ef7}button{width:100%;background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:12px;font-weight:600;cursor:pointer;margin-top:8px;font-size:.9rem;font-family:inherit}button:disabled{opacity:.6;cursor:not-allowed}.err{color:#f75f5f;font-size:.78rem;text-align:center;margin-top:10px}\`]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  form = this.fb.group({ email: ['admin@cobros.com', [Validators.required, Validators.email]], password: ['admin123', Validators.required] });
  loading = false;
  error = '';
  submit(): void {
    if (this.form.invalid) return;
    this.loading = true; this.error = '';
    const { email, password } = this.form.value as { email: string; password: string };
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigate(['/']),
      error: () => { this.loading = false; this.error = 'Email o contrasena incorrectos'; }
    });
  }
}
`.trim(),

'src/app/components/registro-pago/registro-pago.component.ts': `
import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PagosService } from '../../services/pagos.service';
import { PrestamosService } from '../../services/prestamos.service';

@Component({
  selector: 'app-registro-pago',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
  <div class="wrap">
    <h3 class="ttl">Registrar pago</h3>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <div class="grid">
        <div class="f"><label>Prestamo</label>
          <select formControlName="prestamo_id">
            <option [ngValue]="null">Sin especificar</option>
            @for (p of prestamos; track p.id) { <option [ngValue]="p.id">{{ p.descripcion }}</option> }
          </select>
        </div>
        <div class="f"><label>Fecha</label><input type="date" formControlName="fecha_pago"></div>
        <div class="f"><label>Monto</label><input type="number" formControlName="monto" placeholder="0.00" step="0.01"></div>
        <div class="f"><label>Metodo</label>
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
      <div class="actions">
        <button type="submit" class="btn" [disabled]="form.invalid || loading">{{ loading ? 'Guardando...' : 'Registrar Pago' }}</button>
        @if (success) { <span class="ok">Pago registrado!</span> }
        @if (errMsg) { <span class="err">{{ errMsg }}</span> }
      </div>
    </form>
  </div>
  \`,
  styles: [\`.wrap{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:20px}.ttl{font-size:.9rem;font-weight:600;margin-bottom:16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:13px}.f{display:flex;flex-direction:column;gap:5px}.f.full{grid-column:1/-1}label{font-size:.68rem;color:#7a839e;text-transform:uppercase;letter-spacing:.4px}input,select{background:#0d0f14;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:8px 11px;font-size:.82rem;outline:none;font-family:inherit}input:focus,select:focus{border-color:#4f8ef7}select option{background:#1e2230}.actions{margin-top:16px;display:flex;align-items:center;gap:12px}.btn{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:10px 22px;font-weight:600;font-size:.82rem;cursor:pointer;font-family:inherit}.btn:disabled{opacity:.6;cursor:not-allowed}.ok{font-size:.78rem;color:#22d3a0}.err{font-size:.78rem;color:#f75f5f}\`]
})
export class RegistroPagoComponent implements OnInit {
  @Input() deudorId!: number;
  @Output() pagoRegistrado = new EventEmitter<void>();
  private fb = inject(FormBuilder);
  private pagosSvc = inject(PagosService);
  private prestamosSvc = inject(PrestamosService);
  prestamos: any[] = [];
  loading = false; success = false; errMsg = '';
  form = this.fb.group({
    prestamo_id: [null], fecha_pago: [new Date().toISOString().split('T')[0], Validators.required],
    monto: [null, [Validators.required, Validators.min(0.01)]], metodo_pago: ['efectivo', Validators.required],
    numero_operacion: [''], concepto: ['']
  });
  ngOnInit(): void { this.prestamosSvc.getAll(this.deudorId).subscribe({ next: (p: any) => this.prestamos = p, error: () => {} }); }
  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.loading = true; this.errMsg = ''; this.success = false;
    const v = this.form.value as any;
    const fd = new FormData();
    Object.entries({ ...v, deudor_id: this.deudorId }).forEach(([k,val]) => { if (val != null) fd.append(k, String(val)); });
    this.pagosSvc.create(fd as any).subscribe({
      next: () => { this.loading = false; this.success = true; this.form.reset({ fecha_pago: new Date().toISOString().split('T')[0], metodo_pago: 'efectivo' }); this.pagoRegistrado.emit(); setTimeout(() => this.success = false, 3000); },
      error: (e: any) => { this.loading = false; this.errMsg = e.error?.error || 'Error al registrar'; }
    });
  }
}
`.trim(),

'src/app/pages/deudor-detail/deudor-detail.component.ts': `
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DeudoresService } from '../../services/deudores.service';
import { RegistroPagoComponent } from '../../components/registro-pago/registro-pago.component';

@Component({
  selector: 'app-deudor-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, RegistroPagoComponent],
  template: \`
  <div class="page">
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (deudor && !loading) {
      <div class="header">
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
          <thead><tr><th>#</th><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Metodo</th></tr></thead>
          <tbody>
            @for (p of deudor.pagos; track p.id; let i = $index) {
              <tr>
                <td class="mu">{{ i+1 }}</td>
                <td class="mo">{{ p.fecha_pago | date:"dd/MM/yyyy" }}</td>
                <td>{{ p.concepto || '-' }}</td>
                <td class="amt mo">S/ {{ fmt(p.monto) }}</td>
                <td><span [class]="'mb m-'+p.metodo_pago">{{ p.metodo_pago }}</span></td>
              </tr>
            }
            @if (!deudor.pagos?.length) { <tr><td colspan="5" class="empty">Sin pagos</td></tr> }
          </tbody>
        </table>
      </div>
      <div class="sec">Registrar pago</div>
      <app-registro-pago [deudorId]="deudor.id" (pagoRegistrado)="reload()"></app-registro-pago>
    }
  </div>
  \`,
  styles: [\`.page{padding:24px;max-width:1100px}.empty{padding:30px;text-align:center;color:#7a839e}.header{margin-bottom:22px}h1{font-size:1.35rem;font-weight:700;margin-bottom:8px}.tags{display:flex;gap:8px;flex-wrap:wrap}.tag{font-size:.7rem;padding:3px 10px;border-radius:20px;background:#252a3a;border:1px solid #2e3450}.tag.g{color:#22d3a0;border-color:#22d3a0}.tag.r{color:#f75f5f;border-color:#f75f5f}.sec{font-size:.68rem;text-transform:uppercase;letter-spacing:1px;color:#7a839e;margin:20px 0 10px;font-weight:700;border-bottom:1px solid #2e3450;padding-bottom:6px}.lgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:18px}.lcard{background:#1e2230;border:1px solid #2e3450;border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:4px}.ltype{font-size:.62rem;color:#7a839e;text-transform:uppercase}.ldesc{font-size:.84rem;font-weight:600}.lamt{font-size:1.1rem;font-weight:700;color:#4f8ef7;font-family:monospace}.lmeta{display:flex;gap:6px;flex-wrap:wrap}.tsm{font-size:.62rem;padding:2px 6px;border-radius:8px;background:#252a3a;border:1px solid #2e3450}.e-activo{color:#4f8ef7;border-color:#4f8ef7!important}.e-pagado{color:#22d3a0;border-color:#22d3a0!important}.e-vencido{color:#f75f5f;border-color:#f75f5f!important}.twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto;margin-bottom:18px}table{width:100%;border-collapse:collapse;font-size:.81rem}th{padding:9px 13px;text-align:left;font-size:.65rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}.amt{color:#22d3a0;font-weight:600}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}.mb{font-size:.63rem;padding:2px 7px;border-radius:10px;text-transform:capitalize}.m-yape{background:rgba(100,50,200,.2);color:#b388ff}.m-efectivo{background:rgba(34,211,160,.15);color:#22d3a0}.m-transferencia{background:rgba(79,142,247,.15);color:#4f8ef7}.m-plin{background:rgba(247,135,79,.15);color:#f7874f}.m-pandero{background:rgba(247,201,72,.15);color:#f7c948}\`]
})
export class DeudorDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private svc = inject(DeudoresService);
  deudor: any;
  loading = true;
  ngOnInit(): void { this.reload(); }
  reload(): void {
    this.loading = true;
    const id = parseInt(this.route.snapshot.params['id'], 10);
    this.svc.getById(id).subscribe({
      next: (d: any) => { this.deudor = d; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }
  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}
`.trim(),
};

let ok = 0;
for (const [filePath, content] of Object.entries(files)) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('OK:', filePath);
  ok++;
}
console.log('\nTotal:', ok, 'archivos escritos');
