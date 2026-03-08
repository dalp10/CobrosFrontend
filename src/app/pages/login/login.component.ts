import { Component, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

const REMEMBER_EMAIL_KEY = 'cobros_remember_email';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);
  private notify = inject(NotificationService);

  form = this.fb.group({
    email: [this.getStoredEmail(), [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  loading = false;
  error = '';
  submitted = false;
  showPassword = false;

  private getStoredEmail(): string {
    try {
      return localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
    } catch { return ''; }
  }

  private setStoredEmail(email: string): void {
    try {
      if (email?.trim()) localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
      else localStorage.removeItem(REMEMBER_EMAIL_KEY);
    } catch { /* ignore */ }
  }

  get emailErr(): string {
    const c = this.form.get('email');
    if (!c || !c.touched && !this.submitted) return '';
    if (c.hasError('required')) return 'El email es obligatorio';
    if (c.hasError('email')) return 'Email no válido';
    return '';
  }

  get passwordErr(): string {
    const c = this.form.get('password');
    if (!c || !c.touched && !this.submitted) return '';
    if (c.hasError('required')) return 'La contraseña es obligatoria';
    return '';
  }

  submit(): void {
    this.submitted = true;
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { email, password } = this.form.value as { email: string; password: string };
    this.auth.login(email, password).subscribe({
      next: () => {
        this.setStoredEmail(email);
        this.router.navigate(['/']);
      },
      error: () => {
        this.loading = false;
        this.error = 'Email o contraseña incorrectos';
        this.notify.error('Email o contraseña incorrectos');
      }
    });
  }
}
