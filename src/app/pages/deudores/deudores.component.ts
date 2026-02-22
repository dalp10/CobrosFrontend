import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { ImagePreviewButtonComponent } from '../../shared/image-preview-button/image-preview-button.component';


@Component({
  selector: 'app-deudores',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, ReactiveFormsModule, FormsModule],
  templateUrl: './deudores.component.html',
  styleUrl: './deudores.component.css'
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

  fmt(v: any): string { return (+(v ?? 0)).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  pct(paid: any, total: any): number { return total ? Math.min(100, (+(paid || 0) / +total) * 100) : 0; }
}
