import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { DeudoresService } from '../../services/deudores.service';
import { NotificationService } from '../../services/notification.service';
import { ImagePreviewButtonComponent } from '../../shared/image-preview-button/image-preview-button.component';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { FormatPercentPipe } from '../../shared/pipes/format-percent.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Deudor } from '../../models/index';

@Component({
  selector: 'app-deudores',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, ReactiveFormsModule, FormsModule, FormatNumberPipe, FormatPercentPipe, SkeletonComponent],
  templateUrl: './deudores.component.html',
  styleUrl: './deudores.component.css'
})
export class DeudoresComponent implements OnInit {
  private deudoresService = inject(DeudoresService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private notify = inject(NotificationService);

  deudores: Deudor[] = [];
  filtered: Deudor[] = [];
  loading = true;
  showModal = false;
  editando: Deudor | null = null;
  saving = false;
  formErr = '';
  submitted = false;
  searchTerm = '';
  filtroEstado: 'todos' | 'al_dia' | 'en_mora' = 'todos';
  diasAlerta = 30;
  alertas: Deudor[] = [];

  readonly PAGE_SIZE = 20;
  deudoresVisible = this.PAGE_SIZE;

  get deudoresParaMostrar(): Deudor[] {
    return this.filtered.slice(0, this.deudoresVisible);
  }

  get hayMasDeudores(): boolean {
    return this.filtered.length > this.deudoresVisible;
  }

  get cantidadVerMas(): number {
    return Math.min(this.PAGE_SIZE, this.filtered.length - this.deudoresVisible);
  }

  verMasDeudores(): void {
    this.deudoresVisible += this.PAGE_SIZE;
  }

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
    this.deudoresVisible = this.PAGE_SIZE;
    this.deudoresService.getAll().subscribe({
      next: (d) => {
        this.deudores = d;
        this.filtrar();
        this.calcularAlertas();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.deudores = []; this.filtered = []; this.alertas = []; this.cdr.detectChanges(); }
    });
  }

  filtrar(): void {
    const list = Array.isArray(this.deudores) ? this.deudores : [];
    const term = this.searchTerm.toLowerCase().trim();
    this.deudoresVisible = this.PAGE_SIZE;
    let list2 = list;
    if (term) {
      list2 = list.filter(d =>
        (d && (d.nombre + ' ' + (d.apellidos || '')).toLowerCase().includes(term)) ||
        (d && (d.dni || '').includes(term)) ||
        (d && (d.telefono || '').includes(term))
      );
    }
    if (this.filtroEstado === 'al_dia') {
      list2 = list2.filter(d => +(d?.saldo_pendiente ?? 0) <= 0);
    } else if (this.filtroEstado === 'en_mora') {
      list2 = list2.filter(d => +(d?.saldo_pendiente ?? 0) > 0);
    }
    this.filtered = list2;
    this.cdr.detectChanges();
  }

  openModal(deudor?: Deudor): void {
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

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showModal) this.closeModal();
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
    const body = {
      nombre: v.nombre ?? '',
      apellidos: v.apellidos ?? '',
      dni: v.dni ?? undefined,
      telefono: v.telefono ?? undefined,
      email: v.email ?? undefined,
      direccion: v.direccion ?? undefined,
      notas: v.notas ?? undefined
    };
    const req = this.editando
      ? this.deudoresService.update(this.editando.id, body)
      : this.deudoresService.create(body);
    req.subscribe({
      next: () => { this.saving = false; this.closeModal(); this.load(); this.notify.success(this.editando ? 'Deudor actualizado' : 'Deudor creado'); },
      error: (e) => { this.saving = false; this.formErr = e.error?.error || 'Error al guardar'; this.cdr.detectChanges(); this.notify.error(this.formErr); }
    });
  }

  calcularAlertas(): void {
    const list = Array.isArray(this.deudores) ? this.deudores : [];
    const hoy = new Date();
    this.alertas = list.filter(d => {
      if (!d || typeof d !== 'object') return false;
      if (+(d.saldo_pendiente ?? 0) <= 0) return false;
      if (!d.ultimo_pago) return true;
      const diff = Math.floor((hoy.getTime() - new Date(d.ultimo_pago).getTime()) / 86400000);
      return diff >= this.diasAlerta;
    });
    this.cdr.detectChanges();
  }

  diasDesde(fecha: string): number {
    return Math.floor((new Date().getTime() - new Date(fecha).getTime()) / 86400000);
  }
}
