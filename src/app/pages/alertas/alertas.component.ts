import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { DeudoresService } from '../../services/deudores.service';
import { PrestamosService } from '../../services/prestamos.service';
import { AlertasService, MoraDeudor, ProximaDeudor } from '../../services/alertas.service';
import { NotificationService } from '../../services/notification.service';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Deudor, Prestamo } from '../../models/index';

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, FormatNumberPipe, SkeletonComponent],
  templateUrl: './alertas.component.html',
  styleUrl: './alertas.component.css'
})
export class AlertasComponent implements OnInit {
  private deudoresService = inject(DeudoresService);
  private prestamosService = inject(PrestamosService);
  private alertasService = inject(AlertasService);
  private notify = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  /** ID del deudor cuyo envío está en curso (para mostrar "Enviando...") */
  enviandoDeudorId: number | null = null;
  /** ID del deudor cuyo recordatorio de mora está en curso */
  enviandoMoraDeudorId: number | null = null;
  deudoresSinPago: Deudor[] = [];
  prestamosVencidos: Prestamo[] = [];
  moraPorDeudor: MoraDeudor[] = [];
  proximasPorDeudor: ProximaDeudor[] = [];
  diasProximas = 3;
  diasAlerta = 30;

  get totalAlertas(): number {
    return this.deudoresSinPago.length + this.prestamosVencidos.length + this.moraPorDeudor.length + this.proximasPorDeudor.length;
  }

  get totalMoraGeneral(): number {
    return this.moraPorDeudor.reduce((s, m) => s + m.total_mora, 0);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.deudoresService.getAll(true).subscribe({
      next: (deudores) => {
        this.calcularDeudoresSinPago(deudores);
        // Cargar teléfono de cada deudor (el listado a veces no lo trae)
        if (this.deudoresSinPago.length > 0) {
          forkJoin(this.deudoresSinPago.map(d => this.deudoresService.getById(d.id))).subscribe({
            next: (fullList) => {
              fullList.forEach((full, i) => {
                if (i < this.deudoresSinPago.length) this.deudoresSinPago[i].telefono = full.telefono;
              });
              this.cdr.detectChanges();
            },
            error: () => this.cdr.detectChanges()
          });
        }
        this.prestamosService.getAll().subscribe({
          next: (prestamos) => {
            this.prestamosVencidos = prestamos.filter(p => p.estado === 'vencido');
            this.loading = false;
            this.cdr.detectChanges();
          },
          error: () => { this.loading = false; this.cdr.detectChanges(); }
        });
        this.alertasService.getMora().subscribe({
          next: (mora) => { this.moraPorDeudor = mora; this.cdr.detectChanges(); },
          error: () => this.cdr.detectChanges()
        });
        this.cargarProximas();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  calcularDeudoresSinPago(list: Deudor[]): void {
    const hoy = new Date();
    this.deudoresSinPago = (list || []).filter(d => {
      if (+(d.saldo_pendiente ?? 0) <= 0) return false;
      if (!d.ultimo_pago) return true;
      const diff = Math.floor((hoy.getTime() - new Date(d.ultimo_pago).getTime()) / 86400000);
      return diff >= this.diasAlerta;
    });
  }

  onDiasChange(): void {
    this.deudoresService.getAll().subscribe(d => {
      this.calcularDeudoresSinPago(d);
      if (this.deudoresSinPago.length > 0) {
        forkJoin(this.deudoresSinPago.map(x => this.deudoresService.getById(x.id))).subscribe({
          next: (fullList) => {
            fullList.forEach((full, i) => {
              if (i < this.deudoresSinPago.length) this.deudoresSinPago[i].telefono = full.telefono;
            });
            this.cdr.detectChanges();
          },
          error: () => this.cdr.detectChanges()
        });
      }
      this.cdr.detectChanges();
    });
  }

  diasDesde(fecha: string): number {
    return Math.floor((new Date().getTime() - new Date(fecha).getTime()) / 86400000);
  }

  cargarProximas(): void {
    this.alertasService.getProximas(this.diasProximas).subscribe({
      next: (proximas) => { this.proximasPorDeudor = proximas; this.cdr.detectChanges(); },
      error: () => this.cdr.detectChanges()
    });
  }

  onDiasProximasChange(): void {
    this.cargarProximas();
  }

  /** Formatea teléfono para wa.me: solo dígitos; Perú 51 + 9 dígitos. Acepta varios formatos. */
  formatoTelefonoWhatsApp(telefono: string | undefined): string | null {
    const raw = (telefono && typeof telefono === 'string') ? telefono.trim() : '';
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8) return null;
    // 10 dígitos empezando en 0 (ej. 0987654321) -> 51 + 9 dígitos
    if (digits.length === 10 && digits[0] === '0') return '51' + digits.slice(1);
    // 9 dígitos empezando en 9 (móvil Perú)
    if (digits.length === 9 && digits[0] === '9') return '51' + digits;
    // 11 dígitos ya con 51
    if (digits.length === 11 && digits.startsWith('51')) return digits;
    // Cualquier otro con 9+ dígitos: usar tal cual (puede ser otro país)
    if (digits.length >= 9) return digits;
    // 8 dígitos: asumir Perú y anteponer 51 9
    if (digits.length === 8) return '519' + digits;
    return null;
  }

  /** Mensaje de recordatorio contando desde la última fecha de pago */
  mensajeWhatsApp(d: Deudor): string {
    const titulo = '📋 *Recordatorio de cobro*\n\n';
    const nombre = (d.nombre || '').trim() || 'estimado/a';
    const dias = d.ultimo_pago ? this.diasDesde(d.ultimo_pago) : 0;
    const saldo = +(d.saldo_pendiente ?? 0);
    const textoSaldo = saldo > 0 ? ` Saldo pendiente: S/ ${saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })}.` : '';
    if (dias > 0) {
      return titulo + `Hola ${nombre}, te recordamos que han pasado *${dias} día${dias !== 1 ? 's' : ''}* desde tu último pago.${textoSaldo} ¿Podrías regularizar? Gracias.`;
    }
    return titulo + `Hola ${nombre}, te recordamos que tienes un saldo pendiente.${textoSaldo} ¿Podrías regularizar? Gracias.`;
  }

  /** Abre WhatsApp con el número y mensaje prellenado (no envía automáticamente) */
  abrirWhatsApp(d: Deudor): void {
    const url = this.getWhatsAppUrl(d);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  /** Envía el recordatorio por WhatsApp vía el backend (Twilio) */
  enviarRecordatorio(d: Deudor): void {
    if (!d.telefono) {
      this.notify.error('Este deudor no tiene teléfono registrado.');
      return;
    }
    this.enviandoDeudorId = d.id;
    this.cdr.detectChanges();
    this.notify.showProgress('Enviando mensaje por WhatsApp...');
    const mensaje = this.mensajeWhatsApp(d);
    this.alertasService.enviarWhatsApp({ deudor_id: d.id, mensaje }).subscribe({
      next: () => {
        this.enviandoDeudorId = null;
        this.cdr.detectChanges();
        this.notify.success('Mensaje enviado por WhatsApp a ' + d.nombre + ' ' + d.apellidos);
      },
      error: (err) => {
        this.enviandoDeudorId = null;
        this.cdr.detectChanges();
        const msg = err.error?.error || err.message || 'No se pudo enviar el mensaje';
        this.notify.error(msg);
      }
    });
  }

  /** Devuelve la URL de wa.me con mensaje prellenado, o null si no hay teléfono */
  getWhatsAppUrl(d: Deudor): string | null {
    const num = this.formatoTelefonoWhatsApp(d.telefono);
    if (!num) return null;
    return `https://wa.me/${num}?text=${encodeURIComponent(this.mensajeWhatsApp(d))}`;
  }

  /** Mensaje de recordatorio de mora detallando las cuotas vencidas de un deudor */
  mensajeMora(m: MoraDeudor): string {
    const titulo = '📋 *Recordatorio de cobro*\n\n';
    const nombre = (m.nombre || '').trim() || 'estimado/a';
    const detalle = m.cuotas
      .map(c => `• Cuota ${c.numero_cuota}: S/ ${c.saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })} (vencida hace ${c.dias_vencido} día${c.dias_vencido !== 1 ? 's' : ''})`)
      .join('\n');
    const total = m.total_mora.toLocaleString('es-PE', { minimumFractionDigits: 2 });
    return titulo + `Hola ${nombre}, tienes cuotas vencidas:\n${detalle}\n\nTotal en mora: S/ ${total}. ¿Podrías regularizar? Gracias.`;
  }

  /** URL de wa.me con el recordatorio de mora prellenado, o null si no hay teléfono */
  getWhatsAppUrlMora(m: MoraDeudor): string | null {
    const num = this.formatoTelefonoWhatsApp(m.telefono);
    if (!num) return null;
    return `https://wa.me/${num}?text=${encodeURIComponent(this.mensajeMora(m))}`;
  }

  /** Mensaje de recordatorio preventivo (cuotas próximas a vencer) de un deudor */
  mensajeProxima(p: ProximaDeudor): string {
    const titulo = '📋 *Recordatorio de cobro*\n\n';
    const nombre = (p.nombre || '').trim() || 'estimado/a';
    const detalle = p.cuotas
      .map(c => {
        const cuando = c.dias_para_vencer === 0 ? 'hoy' : `en ${c.dias_para_vencer} día${c.dias_para_vencer !== 1 ? 's' : ''}`;
        return `• Cuota ${c.numero_cuota}: S/ ${c.saldo.toLocaleString('es-PE', { minimumFractionDigits: 2 })} (vence ${cuando})`;
      })
      .join('\n');
    return titulo + `Hola ${nombre}, te recordamos que tienes próximas cuotas por vencer:\n${detalle}\n\n¡Gracias por tu puntualidad!`;
  }

  /** URL de wa.me con el recordatorio preventivo prellenado, o null si no hay teléfono */
  getWhatsAppUrlProxima(p: ProximaDeudor): string | null {
    const num = this.formatoTelefonoWhatsApp(p.telefono);
    if (!num) return null;
    return `https://wa.me/${num}?text=${encodeURIComponent(this.mensajeProxima(p))}`;
  }

  /** Envía el recordatorio de mora por WhatsApp vía el backend (Twilio) */
  enviarRecordatorioMora(m: MoraDeudor): void {
    if (!m.telefono) {
      this.notify.error('Este deudor no tiene teléfono registrado.');
      return;
    }
    this.enviandoMoraDeudorId = m.deudor_id;
    this.cdr.detectChanges();
    this.notify.showProgress('Enviando mensaje por WhatsApp...');
    const mensaje = this.mensajeMora(m);
    this.alertasService.enviarWhatsApp({ deudor_id: m.deudor_id, mensaje }).subscribe({
      next: () => {
        this.enviandoMoraDeudorId = null;
        this.cdr.detectChanges();
        this.notify.success('Mensaje enviado por WhatsApp a ' + m.nombre + ' ' + m.apellidos);
      },
      error: (err) => {
        this.enviandoMoraDeudorId = null;
        this.cdr.detectChanges();
        const msg = err.error?.error || err.message || 'No se pudo enviar el mensaje';
        this.notify.error(msg);
      }
    });
  }
}
