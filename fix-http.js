const fs = require('fs');

// Simplest possible interceptor - no inject()
const interceptor = `import { HttpInterceptorFn } from '@angular/common/http';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('cobros_token');
  if (token) {
    req = req.clone({ setHeaders: { Authorization: 'Bearer ' + token } });
  }
  return next(req);
};`;

fs.writeFileSync('src/app/interceptors/jwt.interceptor.ts', interceptor, 'utf8');
console.log('Interceptor OK');

// Also add debug to deudores to see what happens
const deudores = `import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-deudores',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe],
  template: \`
  <div class="page">
    <h1 class="title">Deudores</h1>
    @if (loading) { <div class="empty">Cargando...</div> }
    @if (error) { <div class="empty" style="color:#f75f5f">Error: {{ error }}</div> }
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
  styles: [\`.page{padding:24px;max-width:1200px}.title{font-size:1.35rem;font-weight:700;margin-bottom:20px}.empty{padding:40px;text-align:center;color:#7a839e}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.card{background:#1e2230;border:1px solid #2e3450;border-radius:14px;padding:18px;text-decoration:none;color:inherit;display:flex;flex-direction:column;gap:14px;transition:border-color .15s}.card:hover{border-color:#4f8ef7}.chead{display:flex;align-items:center;gap:12px}.avatar{width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#4f8ef7,#7c5cfc);display:flex;align-items:center;justify-content:center;font-size:.85rem;font-weight:700;color:#fff;flex-shrink:0}.name{font-size:.92rem;font-weight:600}.sub{font-size:.68rem;color:#7a839e}.nums{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.nitem{display:flex;flex-direction:column;gap:2px}.nlbl{font-size:.6rem;color:#7a839e;text-transform:uppercase}.nval{font-size:.78rem;font-weight:700;font-family:monospace;color:#e8ecf4}.green{color:#22d3a0!important}.blue{color:#4f8ef7!important}.red{color:#f75f5f!important}.foot{display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:#7a839e}.arrow{color:#4f8ef7}.mu{color:#7a839e}\`]
})
export class DeudoresComponent implements OnInit {
  private http = inject(HttpClient);
  deudores: any[] = [];
  loading = true;
  error = '';

  ngOnInit(): void {
    console.log('DeudoresComponent ngOnInit called');
    this.http.get<any[]>(environment.apiUrl + '/deudores').subscribe({
      next: (d) => {
        console.log('Deudores received:', d.length);
        this.deudores = d;
        this.loading = false;
      },
      error: (e) => {
        console.error('Deudores error:', e);
        this.error = e.message;
        this.loading = false;
      }
    });
  }

  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}`;

fs.writeFileSync('src/app/pages/deudores/deudores.component.ts', deudores, 'utf8');
console.log('Deudores OK - with debug logs');
