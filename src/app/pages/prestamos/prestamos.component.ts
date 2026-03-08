import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { PrestamosService } from '../../services/prestamos.service';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { Prestamo } from '../../models/index';

@Component({
  selector: 'app-prestamos',
  standalone: true,
  imports: [RouterLink, DatePipe, FormatNumberPipe, SkeletonComponent],
  templateUrl: './prestamos.component.html',
  styleUrl: './prestamos.component.css'
})
export class PrestamosComponent implements OnInit {
  private prestamosService = inject(PrestamosService);
  private cdr = inject(ChangeDetectorRef);

  prestamos: Prestamo[] = [];
  loading = true;

  get totalMontoOriginal(): number {
    return this.prestamos.reduce((s, p) => s + +(p.monto_original ?? 0), 0);
  }

  get totalPendiente(): number {
    return this.prestamos.reduce((s, p) => s + +(p.saldo_pendiente ?? 0), 0);
  }

  ngOnInit(): void {
    this.prestamosService.getAll().subscribe({
      next: (p) => { this.prestamos = p; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }
}
