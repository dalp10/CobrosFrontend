import { Component, OnInit, inject, ChangeDetectorRef, HostListener, afterNextRender } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UsuariosService } from '../../services/usuarios.service';
import { NotificationService } from '../../services/notification.service';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Usuario } from '../../models/index';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, SkeletonComponent],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css'
})
export class UsuariosComponent implements OnInit {
  private usuariosService = inject(UsuariosService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private notify = inject(NotificationService);

  usuarios: Usuario[] = [];
  loading = true;
  showModal = false;
  editando: Usuario | null = null;
  saving = false;
  formErr = '';
  submitted = false;
  showPass: Usuario | null = null;
  savingPass = false;
  passErr = '';
  passOk = false;
  passSubmitted = false;

  /** Valores fijos para el skeleton; evita cambios de binding en el mismo ciclo */
  readonly skeletonRows = 6;
  readonly skeletonCells = 6;

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

  constructor() {
    // Cargar datos después del primer render para evitar NG0100 (ExpressionChangedAfterItHasBeenCheckedError)
    afterNextRender(() => this.load());
  }

  ngOnInit(): void {}

  load(): void {
    this.loading = true;
    this.usuariosService.getAll().subscribe({
      next: (u) => {
        // NG0100: actualizar en el siguiente tick para no cambiar valores tras el check
        setTimeout(() => {
          this.usuarios = u;
          this.loading = false;
          this.cdr.detectChanges();
        }, 0);
      },
      error: () => {
        setTimeout(() => {
          this.loading = false;
          this.cdr.detectChanges();
        }, 0);
      }
    });
  }

  fi(f: string): boolean {
    const c = this.form.get(f);
    return !!(c && c.invalid && (c.touched || this.submitted));
  }

  pfi(f: string): boolean {
    const c = this.passForm.get(f);
    return !!(c && c.invalid && (c.touched || this.passSubmitted));
  }

  openModal(u?: Usuario): void {
    this.editando = u || null;
    this.submitted = false;
    this.formErr = '';

    if (u) {
      this.form.get('password')?.clearValidators();
      this.form.get('password')?.updateValueAndValidity();
      this.form.patchValue({ nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo, password: '' });
    } else {
      this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.form.get('password')?.updateValueAndValidity();
      this.form.reset({ rol: 'admin', activo: true });
    }

    this.showModal = true;
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.showModal = false;
    this.editando = null;
    this.cdr.detectChanges();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showModal) this.closeModal();
    else if (this.showPass) this.closePass();
  }

  guardar(): void {
    this.submitted = true;
    if (this.form.invalid) { this.form.markAllAsTouched(); this.cdr.detectChanges(); return; }

    this.saving = true;
    this.formErr = '';
    const v = this.form.value;
    const req = this.editando
      ? this.usuariosService.update(this.editando.id, { nombre: v!.nombre!, email: v!.email!, rol: v!.rol!, activo: v!.activo! })
      : this.usuariosService.create({ nombre: v!.nombre!, email: v!.email!, password: v!.password!, rol: v!.rol!, activo: v!.activo! });

    req.subscribe({
      next: ()        => { this.saving = false; this.closeModal(); this.load(); this.notify.success(this.editando ? 'Usuario actualizado' : 'Usuario creado'); },
      error: (e: any) => { this.saving = false; this.formErr = e.error?.error || 'Error al guardar'; this.cdr.detectChanges(); this.notify.error(this.formErr); }
    });
  }

  openPass(u: Usuario): void {
    this.showPass = u;
    this.passErr = '';
    this.passOk = false;
    this.passSubmitted = false;
    this.passForm.reset();
    this.cdr.detectChanges();
  }

  closePass(): void {
    this.showPass = null;
    this.cdr.detectChanges();
  }

  cambiarPass(): void {
    this.passSubmitted = true;
    if (this.passForm.invalid) { this.passForm.markAllAsTouched(); this.cdr.detectChanges(); return; }

    this.savingPass = true;
    this.passErr = '';
    if (!this.showPass) return;
    this.usuariosService.updatePassword(this.showPass.id, String(this.passForm.value.password_nuevo ?? '')).subscribe({
      next: ()        => { this.savingPass = false; this.passOk = true; this.passForm.reset(); this.notify.success('Contraseña actualizada'); this.cdr.detectChanges(); setTimeout(() => this.closePass(), 2000); },
      error: (e: any) => { this.savingPass = false; this.passErr = e.error?.error || 'Error'; this.cdr.detectChanges(); this.notify.error(this.passErr); }
    });
  }
}
