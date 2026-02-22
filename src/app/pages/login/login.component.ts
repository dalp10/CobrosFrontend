import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
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
  `,
  styles: [`.page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0d0f14}.card{background:#1e2230;border:1px solid #2e3450;border-radius:16px;padding:32px;width:360px}.logo{font-size:1.2rem;font-weight:700;text-align:center;margin-bottom:24px;color:#e8ecf4}.field{display:flex;flex-direction:column;gap:6px;margin-bottom:14px}label{font-size:.72rem;color:#7a839e;text-transform:uppercase;letter-spacing:.4px}input{background:#0d0f14;border:1px solid #2e3450;border-radius:8px;color:#e8ecf4;padding:10px 12px;font-size:.85rem;outline:none;font-family:inherit}input:focus{border-color:#4f8ef7}button{width:100%;background:linear-gradient(135deg,#4f8ef7,#7c5cfc);color:#fff;border:none;border-radius:10px;padding:12px;font-weight:600;cursor:pointer;margin-top:8px;font-size:.9rem;font-family:inherit}button:disabled{opacity:.6;cursor:not-allowed}.err{color:#f75f5f;font-size:.78rem;text-align:center;margin-top:10px}`]
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