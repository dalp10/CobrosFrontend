import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PrestamosService } from '../services/prestamos.service';
import { DeudoresService } from '../services/deudores.service';
import { Deudor } from '../models/index';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLinkActive, FormsModule],
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css']
})
export class LayoutComponent implements OnInit, OnDestroy {
  auth = inject(AuthService);
  private router = inject(Router);
  private prestamosService = inject(PrestamosService);
  private deudoresService = inject(DeudoresService);

  sidebarOpen = false;
  alertasVencidos = 0;
  /** Deudores con saldo pendiente y sin pago en los últimos 30 días */
  alertasDeudoresSinPago = 0;
  private subPrestamos: any = null;
  private subDeudores: any = null;

  get totalAlertas(): number {
    return this.alertasVencidos + this.alertasDeudoresSinPago;
  }

  ngOnInit(): void {
    this.subPrestamos = this.prestamosService.getAll().subscribe(prestamos => {
      this.alertasVencidos = prestamos.filter(p => p.estado === 'vencido').length;
    });
    this.subDeudores = this.deudoresService.getAll().subscribe(deudores => {
      const dias = 30;
      const hoy = new Date();
      this.alertasDeudoresSinPago = (deudores || []).filter((d: Deudor) => {
        if (+(d.saldo_pendiente ?? 0) <= 0) return false;
        if (!d.ultimo_pago) return true;
        const diff = Math.floor((hoy.getTime() - new Date(d.ultimo_pago).getTime()) / 86400000);
        return diff >= dias;
      }).length;
    });
  }

  ngOnDestroy(): void {
    this.subPrestamos?.unsubscribe();
    this.subDeudores?.unsubscribe();
  }

  nav(path: string): void {
    this.router.navigate([path]);
    this.sidebarOpen = false;
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }
}
