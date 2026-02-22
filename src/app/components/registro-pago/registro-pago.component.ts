import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { PagosService } from '../../services/pagos.service';
import { PrestamosService } from '../../services/prestamos.service';

@Component({
  selector: 'app-registro-pago',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
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
  `,
  styles: [`.wrap{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:20px}.ttl{font-size:.9rem;font-weight:600;margin-bottom:16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(195px,1fr));gap:13px}.f{display:flex;flex-direction:column;gap:5px}.f.full{grid-column:1/-1}label{font-size:.68rem;color:#7a839e;text-transform:uppercase;letter-spacing:.4px}input,select{background:#0d0f14;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:8px 11px;font-size:.82rem;outline:none;font-family:inherit}input:focus,select:focus{border-color:#4f8ef7}select option{background:#1e2230}.actions{margin-top:16px;display:flex;align-items:center;gap:12px}.btn{background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:10px 22px;font-weight:600;font-size:.82rem;cursor:pointer;font-family:inherit}.btn:disabled{opacity:.6;cursor:not-allowed}.ok{font-size:.78rem;color:#22d3a0}.err{font-size:.78rem;color:#f75f5f}`]
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