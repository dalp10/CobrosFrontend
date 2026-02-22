import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-prestamos',
  standalone: true,
  imports: [RouterLink, DatePipe],
  template: `
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
                <td><span [class]="'est e-'+p.estado">{{ p.estado }}</span></td>
              </tr>
            }
            @if (!prestamos.length) { <tr><td colspan="7" class="empty">Sin prestamos</td></tr> }
          </tbody>
        </table>
      </div>
    }
  </div>
  `,
  styles: [`.page{padding:24px;max-width:1300px}.title{font-size:1.35rem;font-weight:700;margin-bottom:18px}.empty{padding:30px;text-align:center;color:#7a839e}.twrap{background:#1e2230;border:1px solid #2e3450;border-radius:12px;overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:.8rem}th{padding:9px 13px;text-align:left;font-size:.62rem;text-transform:uppercase;color:#7a839e;border-bottom:1px solid #2e3450;white-space:nowrap}td{padding:9px 13px;border-bottom:1px solid rgba(46,52,80,.35)}.amt{color:#4f8ef7;font-weight:700}.g{color:#22d3a0}.r{color:#f75f5f}.mo{font-family:monospace;font-size:.75rem}.mu{color:#7a839e}.dlink{color:#4f8ef7;text-decoration:none;font-weight:600}.est{font-size:.62rem;padding:2px 7px;border-radius:8px}.e-activo{background:rgba(79,142,247,.15);color:#4f8ef7}.e-pagado{background:rgba(34,211,160,.15);color:#22d3a0}.e-vencido{background:rgba(247,95,95,.15);color:#f75f5f}.e-cancelado{background:rgba(122,131,158,.15);color:#7a839e}`]
})
export class PrestamosComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  prestamos: any[] = [];
  loading = true;

  ngOnInit(): void {
    this.http.get<any[]>(environment.apiUrl + '/prestamos').subscribe({
      next: (p) => { this.prestamos = p; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }
  fmt(v: any): string { return (+(v??0)).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
}