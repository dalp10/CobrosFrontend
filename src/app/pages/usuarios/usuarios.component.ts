import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css'
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
      error: ()       => { this.loading = false; this.cdr.detectChanges(); }
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

  openModal(u?: any): void {
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

  guardar(): void {
    this.submitted = true;
    if (this.form.invalid) { this.form.markAllAsTouched(); this.cdr.detectChanges(); return; }

    this.saving = true;
    this.formErr = '';
    const v = this.form.value;
    const req = this.editando
      ? this.http.put(environment.apiUrl + '/usuarios/' + this.editando.id, { nombre: v.nombre, email: v.email, rol: v.rol, activo: v.activo })
      : this.http.post(environment.apiUrl + '/usuarios', v);

    req.subscribe({
      next: ()        => { this.saving = false; this.closeModal(); this.load(); },
      error: (e: any) => { this.saving = false; this.formErr = e.error?.error || 'Error al guardar'; this.cdr.detectChanges(); }
    });
  }

  openPass(u: any): void {
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
    this.http.put(environment.apiUrl + '/usuarios/' + this.showPass.id + '/password', this.passForm.value).subscribe({
      next: ()        => { this.savingPass = false; this.passOk = true; this.passForm.reset(); this.cdr.detectChanges(); setTimeout(() => this.closePass(), 2000); },
      error: (e: any) => { this.savingPass = false; this.passErr = e.error?.error || 'Error'; this.cdr.detectChanges(); }
    });
  }
}
