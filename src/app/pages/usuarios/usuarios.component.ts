import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  template: `
  <div class="page">
    <div class="topbar">
      <h1 class="title">Usuarios</h1>
      <button class="btn-new" (click)="openModal()">+ Nuevo usuario</button>
    </div>
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (!loading) {
      <div class="twrap">
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead>
          <tbody>
            @for (u of usuarios; track u.id) {
              <tr>
                <td class="bold">{{ u.nombre }}</td>
                <td class="mu">{{ u.email }}</td>
                <td><span [class]="'rol r-'+u.rol">{{ u.rol }}</span></td>
                <td><span [class]="u.activo ? 'est activo' : 'est inactivo'">{{ u.activo ? 'Activo' : 'Inactivo' }}</span></td>
                <td class="mo mu">{{ u.created_at | date:"dd/MM/yyyy" }}</td>
                <td>
                  <div class="row-actions">
                    <button class="act-btn edit" (click)="openModal(u)" title="Editar">✏️</button>
                    <button class="act-btn key" (click)="openPass(u)" title="Cambiar contraseña">🔑</button>
                  </div>
                </td>
              </tr>
            }
            @if (!usuarios.length) { <tr><td colspan="6" class="empty">Sin usuarios</td></tr> }
          </tbody>
        </table>
      </div>
    }
  </div>

  @if (showModal) {
    <div class="overlay" (click)="closeModal()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <h2>{{ editando ? 'Editar usuario' : 'Nuevo usuario' }}</h2>
          <button class="close-btn" (click)="closeModal()">✕</button>
        </div>
        <form [formGroup]="form" (ngSubmit)="guardar()">
          <div class="fgrid">
            <div class="f" [class.has-error]="fi('nombre')">
              <label>Nombre <span class="req">*</span></label>
              <input type="text" formControlName="nombre" placeholder="Juan Perez">
              @if (fi('nombre')) { <span class="ferr">Obligatorio</span> }
            </div>
            <div class="f" [class.has-error]="fi('email')">
              <label>Email <span class="req">*</span></label>
              <input type="email" formControlName="email" placeholder="correo@ejemplo.com">
              @if (fi('email') && form.get('email')?.errors?.['required']) { <span class="ferr">Obligatorio</span> }
              @if (fi('email') && form.get('email')?.errors?.['email']) { <span class="ferr">Email inválido</span> }
            </div>
            @if (!editando) {
              <div class="f full" [class.has-error]="fi('password')">
                <label>Contraseña <span class="req">*</span></label>
                <input type="password" formControlName="password" placeholder="Mínimo 6 caracteres">
                @if (fi('password') && form.get('password')?.errors?.['minlength']) { <span class="ferr">Mínimo 6 caracteres</span> }
                @if (fi('password') && form.get('password')?.errors?.['required']) { <span class="ferr">Obligatorio</span> }
              </div>
            }
            <div class="f">
              <label>Rol</label>
              <select formControlName="rol">
                <option value="admin">Admin</option>
                <option value="viewer">Solo lectura</option>
              </select>
            </div>
            @if (editando) {
              <div class="f">
                <label>Estado</label>
                <select formControlName="activo">
                  <option [ngValue]="true">Activo</option>
                  <option [ngValue]="false">Inactivo</option>
                </select>
              </div>
            }
          </div>
          @if (formErr) { <div class="form-alert">❌ {{ formErr }}</div> }
          <div class="mfooter">
            <button type="button" class="btn-cancel" (click)="closeModal()">Cancelar</button>
            <button type="submit" class="btn-save" [disabled]="saving">{{ saving ? 'Guardando...' : (editando ? 'Guardar' : 'Crear usuario') }}</button>
          </div>
        </form>
      </div>
    </div>
  }

  @if (showPass) {
    <div class="overlay" (click)="closePass()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-head">
          <h2>Cambiar contraseña — {{ showPass.nombre }}</h2>
          <button class="close-btn" (click)="closePass()">✕</button>
        </div>
        <form [formGroup]="passForm" (ngSubmit)="cambiarPass()">
          <div class="fgrid">
            <div class="f full" [class.has-error]="pfi('password_nuevo')">
              <label>Nueva contraseña <span class="req">*</span></label>
              <input type="password" formControlName="password_nuevo" placeholder="Mínimo 6 caracteres">
              @if (pfi('password_nuevo') && passForm.get('password_nuevo')?.errors?.['minlength']) { <span class="ferr">Mínimo 6 caracteres</span> }
              @if (pfi('password_nuevo') && passForm.get('password_nuevo')?.errors?.['required']) { <span class="ferr">Obligatorio</span> }
            </div>
          </div>
          @if (passErr) { <div class="form-alert">❌ {{ passErr }}</div> }
          @if (passOk) { <div class="form-ok">✅ Contraseña actualizada</div> }
          <div class="mfooter">
            <button type="button" class="btn-cancel" (click)="closePass()">Cancelar</button>
            <button type="submit" class="btn-save" [disabled]="savingPass">{{ savingPass ? 'Guardando...' : 'Cambiar contraseña' }}</button>
          </div>
        </form>
      </div>
    </div>
  }
  `,
  styles: [`
    .page{padding:24px;max-width:1000px}
    .topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
    .title{font-size:1.35rem;font-weight:700}
    .btn-new{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:9px 18px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit}
    .empty{padding:30px;text-align:center;color:#7a839e}
    .twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto}
    table{width:100%;border-collapse:collapse;font-size:.82rem}
    th{padding:10px 14px;text-align:left;font-size:.63rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}
    td{padding:10px 14px;border-bottom:1px solid rgba(46,52,80,.35)}
    .bold{font-weight:600}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}
    .rol{font-size:.65rem;padding:2px 8px;border-radius:8px;text-transform:capitalize}
    .r-admin{background:rgba(79,142,247,.15);color:#4f8ef7}
    .r-viewer{background:rgba(122,131,158,.15);color:#7a839e}
    .est{font-size:.65rem;padding:2px 8px;border-radius:8px}
    .activo{background:rgba(34,211,160,.15);color:#22d3a0}
    .inactivo{background:rgba(247,95,95,.15);color:#f75f5f}
    .row-actions{display:flex;gap:4px}
    .act-btn{background:none;border:1px solid #2e3450;border-radius:6px;padding:3px 7px;cursor:pointer;font-size:.8rem}
    .act-btn.edit:hover{border-color:#4f8ef7}.act-btn.key:hover{border-color:#f7c948}
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(2px)}
    .modal{background:#1e2230;border:1px solid #2e3450;border-radius:16px;padding:24px;width:100%;max-width:500px}
    .modal-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
    .modal-head h2{font-size:.95rem;font-weight:700}
    .close-btn{background:none;border:none;color:#7a839e;font-size:1.1rem;cursor:pointer}.close-btn:hover{color:#f75f5f}
    .fgrid{display:grid;grid-template-columns:1fr 1fr;gap:13px}
    .f{display:flex;flex-direction:column;gap:5px}.f.full{grid-column:1/-1}
    .f.has-error label{color:#f75f5f}
    label{font-size:.68rem;color:#7a839e;text-transform:uppercase;letter-spacing:.4px}
    .req{color:#f75f5f}
    input,select{background:#0d0f14;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:8px 11px;font-size:.82rem;outline:none;font-family:inherit;width:100%;box-sizing:border-box;transition:border-color .15s}
    input:focus,select:focus{border-color:#4f8ef7}
    select option{background:#1e2230}
    .ferr{font-size:.68rem;color:#f75f5f}
    .form-alert{background:rgba(247,95,95,.1);border:1px solid rgba(247,95,95,.3);border-radius:8px;padding:10px 14px;font-size:.78rem;color:#f75f5f;margin-top:12px}
    .form-ok{background:rgba(34,211,160,.1);border:1px solid rgba(34,211,160,.3);border-radius:8px;padding:10px 14px;font-size:.78rem;color:#22d3a0;margin-top:12px}
    .mfooter{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
    .btn-cancel{background:none;border:1px solid #2e3450;color:#7a839e;border-radius:10px;padding:9px 18px;font-size:.82rem;cursor:pointer;font-family:inherit}
    .btn-save{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:9px 20px;font-size:.82rem;font-weight:600;cursor:pointer;font-family:inherit}
    .btn-save:disabled{opacity:.6;cursor:not-allowed}
  `]
})
export class UsuariosComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);

  usuarios: any[] = [];
  loading = true;
  showModal = false;
  editando: any = null;
  saving = false;
  formErr = '';
  submitted = false;
  showPass: any = null;
  savingPass = false;
  passErr = '';
  passOk = false;
  passSubmitted = false;

  form = this.fb.group({
    nombre:   ['', Validators.required],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rol:      ['admin'],
    activo:   [true]
  });

  passForm = this.fb.group({
    password_nuevo: ['', [Validators.required, Validators.minLength(6)]]
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.http.get(environment.apiUrl + '/usuarios').subscribe({
      next: (u: any) => { this.usuarios = u; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  fi(f: string): boolean { const c = this.form.get(f); return !!(c && c.invalid && (c.touched || this.submitted)); }
  pfi(f: string): boolean { const c = this.passForm.get(f); return !!(c && c.invalid && (c.touched || this.passSubmitted)); }

  openModal(u?: any): void {
    this.editando = u || null; this.submitted = false; this.formErr = '';
    if (u) {
      this.form.get('password')?.clearValidators();
      this.form.get('password')?.updateValueAndValidity();
      this.form.patchValue({ nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo, password: '' });
    } else {
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.form.get('password')?.updateValueAndValidity();
      this.form.reset({ rol: 'admin', activo: true });
    }
    this.showModal = true; this.cdr.detectChanges();
  }

  closeModal(): void { this.showModal = false; this.editando = null; this.cdr.detectChanges(); }

  guardar(): void {
    this.submitted = true;
    if (this.form.invalid) { this.form.markAllAsTouched(); this.cdr.detectChanges(); return; }
    this.saving = true; this.formErr = '';
    const v = this.form.value;
    const req = this.editando
      ? this.http.put(environment.apiUrl + '/usuarios/' + this.editando.id, { nombre: v.nombre, email: v.email, rol: v.rol, activo: v.activo })
      : this.http.post(environment.apiUrl + '/usuarios', v);
    req.subscribe({
      next: () => { this.saving = false; this.closeModal(); this.load(); },
      error: (e: any) => { this.saving = false; this.formErr = e.error?.error || 'Error al guardar'; this.cdr.detectChanges(); }
    });
  }

  openPass(u: any): void { this.showPass = u; this.passErr = ''; this.passOk = false; this.passSubmitted = false; this.passForm.reset(); this.cdr.detectChanges(); }
  closePass(): void { this.showPass = null; this.cdr.detectChanges(); }

  cambiarPass(): void {
    this.passSubmitted = true;
    if (this.passForm.invalid) { this.passForm.markAllAsTouched(); this.cdr.detectChanges(); return; }
    this.savingPass = true; this.passErr = '';
    this.http.put(environment.apiUrl + '/usuarios/' + this.showPass.id + '/password', this.passForm.value).subscribe({
      next: () => { this.savingPass = false; this.passOk = true; this.passForm.reset(); this.cdr.detectChanges(); setTimeout(() => this.closePass(), 2000); },
      error: (e: any) => { this.savingPass = false; this.passErr = e.error?.error || 'Error'; this.cdr.detectChanges(); }
    });
  }
}