import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RepartoService, RepartoResumen, RepartoMiembro, RepartoGasto, RepartoReembolso, RepartoCategoria, RepartoGrupo, RepartoPendientes, RepartoPresupuesto, RepartoAdjunto, RepartoReembolsoAdjunto, SugerenciaReembolso, MEDIOS_PAGO } from '../../services/reparto.service';
import { NotificationService } from '../../services/notification.service';
import { FormatNumberPipe } from '../../shared/pipes/format-number.pipe';

@Component({
  selector: 'app-reparto',
  standalone: true,
  imports: [DatePipe, FormsModule, FormatNumberPipe],
  templateUrl: './reparto.component.html',
  styleUrl: './reparto.component.css',
})
export class RepartoComponent implements OnInit {
  private repartoService = inject(RepartoService);
  private notify = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  resumen: RepartoResumen | null = null;
  showGasto = false;
  showReembolso = false;
  savingGasto = false;
  savingReembolso = false;
  errGasto = '';
  errReembolso = '';
  editingCargoId: number | null = null;
  cargoEditValue: number = 0;
  savingCargoId: number | null = null;
  showNuevoMiembro = false;
  miembroAEliminar: RepartoMiembro | null = null;
  deletingMiembro = false;
  savingNuevoMiembro = false;
  errNuevoMiembro = '';
  nuevoMiembroForm = { nombre: '', cargo_adicional_mensual: 0 as number };

  gastoForm = {
    concepto: '',
    monto_total: null as number | null,
    fecha: new Date().toISOString().split('T')[0],
    pagado_por_id: null as number | null,
    notas: '',
    categoria_id: null as number | null,
    medio_pago: '' as string,
    participantes: [] as { miembro_id: number; nombre: string; participa: boolean; peso: number }[],
  };
  gastoEditando: RepartoGasto | null = null;
  gastoFormEdit = {
    concepto: '',
    monto_total: null as number | null,
    fecha: '',
    pagado_por_id: null as number | null,
    notas: '',
    categoria_id: null as number | null,
    medio_pago: '' as string,
    participantes: [] as { miembro_id: number; nombre: string; participa: boolean; peso: number }[],
  };
  savingGastoEdit = false;
  errGastoEdit = '';
  gastoAAnular: RepartoGasto | null = null;
  deletingGasto = false;
  reembolsoForm = {
    de_miembro_id: null as number | null,
    para_miembro_id: null as number | null,
    monto: null as number | null,
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    gasto_id: null as number | null,
    medio_pago: '' as string,
  };
  reembolsoEditando: RepartoReembolso | null = null;
  reembolsoFormEdit = {
    de_miembro_id: null as number | null,
    para_miembro_id: null as number | null,
    monto: null as number | null,
    fecha: '',
    concepto: '',
    gasto_id: null as number | null,
    medio_pago: '' as string,
  };
  adjuntosPorReembolso: Record<number, RepartoReembolsoAdjunto[]> = {};
  subiendoAdjuntoReembolsoId: number | null = null;

  readonly MEDIOS_PAGO = MEDIOS_PAGO;
  savingReembolsoEdit = false;
  errReembolsoEdit = '';
  reembolsoAAnular: RepartoReembolso | null = null;
  deletingReembolso = false;

  reporteDesde = '';
  reporteHasta = '';
  descargandoReporte = false;
  descargandoPdf = false;

  /** Período para la vista principal (resumen, gastos, reembolsos) */
  periodoDesde = '';
  periodoHasta = '';
  periodoDesdeInput = '';
  periodoHastaInput = '';
  gastoSearchText = '';
  gastoOrden: 'fecha' | 'monto' | 'concepto' = 'fecha';

  repartoId = 1;
  miembroIdFilter: number | null = null;
  grupos: RepartoGrupo[] = [];
  pendientes: RepartoPendientes | null = null;
  presupuestos: RepartoPresupuesto[] = [];
  showPresupuesto = false;
  presupuestoForm = { anno: new Date().getFullYear(), mes: new Date().getMonth() + 1, monto_techo: 0 as number };
  savingPresupuesto = false;
  descargandoExcel = false;
  categorias: RepartoCategoria[] = [];
  showNuevaCategoria = false;
  nuevaCategoriaNombre = '';
  savingCategoria = false;
  categoriaEditando: RepartoCategoria | null = null;
  categoriaFormEdit = { nombre: '', color: '' };
  savingCategoriaEdit = false;
  categoriaAEliminar: RepartoCategoria | null = null;
  deletingCategoria = false;
  adjuntosPorGasto: Record<number, RepartoAdjunto[]> = {};
  subiendoAdjuntoGastoId: number | null = null;
  repitiendoGastoId: number | null = null;

  ngOnInit(): void {
    this.loadGrupos();
    this.load();
  }

  loadGrupos(): void {
    this.repartoService.getGrupos().subscribe({
      next: (list) => {
        this.grupos = list;
        this.cdr.detectChanges();
      },
    });
  }

  load(desde?: string, hasta?: string): void {
    this.loading = true;
    const d = desde ?? (this.periodoDesde || undefined);
    const h = hasta ?? (this.periodoHasta || undefined);
    this.repartoService.getResumen(d, h, this.repartoId, this.miembroIdFilter ?? undefined).subscribe({
      next: (r) => {
        this.resumen = r;
        this.categorias = r.categorias ?? [];
        this.loading = false;
        if (r.miembros.length && this.gastoForm.pagado_por_id == null)
          this.gastoForm.pagado_por_id = r.miembros[0].id;
        this.loadPendientes();
        this.loadPresupuestos();
        // Cargar adjuntos (recibos) de cada gasto para que se vean al actualizar la página
        if (r.gastos?.length) {
          r.gastos.forEach((g) => this.loadAdjuntos(g.id));
        }
        // Cargar adjuntos (evidencia) de cada reembolso
        if (r.reembolsos?.length) {
          r.reembolsos.forEach((re) => this.loadAdjuntosReembolso(re.id));
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.notify.error('No se pudo cargar el reparto');
        this.cdr.detectChanges();
      },
    });
  }

  loadPendientes(): void {
    this.repartoService.getPendientes(this.repartoId).subscribe({
      next: (p) => {
        this.pendientes = p;
        this.cdr.detectChanges();
      },
    });
  }

  loadPresupuestos(): void {
    this.repartoService.getPresupuestos(this.repartoId).subscribe({
      next: (list) => {
        this.presupuestos = list;
        this.cdr.detectChanges();
      },
    });
  }

  cambiarGrupo(): void {
    this.load();
    this.loadPresupuestos();
    this.loadPendientes();
  }

  cambiarFiltroMiembro(): void {
    this.load();
  }

  /** Aplica un período rápido y recarga */
  aplicarPeriodo(preset: 'todo' | 'mes' | 'bimestre'): void {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    if (preset === 'todo') {
      this.periodoDesde = '';
      this.periodoHasta = '';
    } else if (preset === 'mes') {
      this.periodoDesde = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      this.periodoHasta = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else {
      const bimestreStart = m % 2 === 0 ? m : m - 1;
      this.periodoDesde = `${y}-${String(bimestreStart + 1).padStart(2, '0')}-01`;
      const bimestreEnd = bimestreStart + 2;
      const lastDay = new Date(y, bimestreEnd, 0).getDate();
      this.periodoHasta = `${y}-${String(bimestreStart + 2).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }
    this.periodoDesdeInput = this.periodoDesde;
    this.periodoHastaInput = this.periodoHasta;
    this.load(this.periodoDesde || undefined, this.periodoHasta || undefined);
  }

  aplicarRangoFechas(): void {
    if (this.periodoDesdeInput && this.periodoHastaInput) {
      this.periodoDesde = this.periodoDesdeInput;
      this.periodoHasta = this.periodoHastaInput;
      this.load(this.periodoDesde, this.periodoHasta);
    }
  }

  get gastosFiltradosOrdenados(): RepartoGasto[] {
    if (!this.resumen?.gastos?.length) return [];
    let list = [...this.resumen.gastos];
    const q = (this.gastoSearchText || '').toLowerCase().trim();
    if (q) list = list.filter(g =>
      (g.concepto || '').toLowerCase().includes(q) || (g.notas || '').toLowerCase().includes(q));
    if (this.gastoOrden === 'fecha') list.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    else if (this.gastoOrden === 'monto') list.sort((a, b) => (b.monto_total ?? 0) - (a.monto_total ?? 0));
    else if (this.gastoOrden === 'concepto') list.sort((a, b) => (a.concepto || '').localeCompare(b.concepto || ''));
    return list;
  }

  get presupuestoVsReal(): { techo: number; gastado: number; porcentaje: number; mesLabel: string } | null {
    if (!this.resumen) return null;
    const today = new Date();
    let anno = today.getFullYear();
    let mes = today.getMonth() + 1;
    if (this.periodoDesde && this.periodoHasta) {
      const [y, m] = this.periodoDesde.split('-').map(Number);
      if (y && m) { anno = y; mes = m; }
    }
    const pres = this.presupuestos.find(p => p.anno === anno && p.mes === mes);
    const techo = pres?.monto_techo ?? 0;
    const itemMes = this.resumen.resumen_por_mes?.find(it => {
      const [iy, im] = (it.mes || '').split('-').map(Number);
      return iy === anno && im === mes;
    });
    const gastado = itemMes?.total ?? 0;
    const mesLabel = `${anno}-${String(mes).padStart(2, '0')}`;
    return { techo, gastado, porcentaje: techo > 0 ? Math.round((gastado / techo) * 100) : 0, mesLabel };
  }

  get presupuestoBarWidth(): number {
    const p = this.presupuestoVsReal;
    return p ? Math.min(p.porcentaje, 100) : 0;
  }

  repetirUltimoGasto(): void {
    const gastos = this.resumen?.gastos;
    if (!gastos?.length) { this.notify.info('No hay gastos para repetir'); return; }
    const u = gastos[gastos.length - 1];
    const miembros = this.resumen?.miembros ?? [];
    const partMap = (u.participantes?.length ?? 0) > 0 ? new Map((u.participantes ?? []).map(p => [p.miembro_id, p.peso])) : null;
    this.gastoForm = {
      concepto: u.concepto || '',
      monto_total: u.monto_total ?? null,
      fecha: new Date().toISOString().split('T')[0],
      pagado_por_id: u.pagado_por_id ?? null,
      notas: u.notas || '',
      categoria_id: u.categoria_id ?? null,
      medio_pago: (u as RepartoGasto & { medio_pago?: string }).medio_pago ?? '',
      participantes: miembros.map(m => ({
        miembro_id: m.id,
        nombre: m.nombre,
        participa: partMap ? partMap.has(m.id) : true,
        peso: partMap ? (partMap.get(m.id) ?? 1) : 1,
      })),
    };
    this.showGasto = true;
    this.cdr.detectChanges();
  }

  toggleGasto(): void {
    this.showGasto = !this.showGasto;
    this.errGasto = '';
    if (!this.showGasto) this.resetGastoForm();
    else if (this.gastoForm.participantes.length === 0 && this.resumen?.miembros?.length)
      this.gastoForm.participantes = this.resumen.miembros.map(m => ({ miembro_id: m.id, nombre: m.nombre, participa: true, peso: 1 }));
    this.cdr.detectChanges();
  }

  resetGastoForm(): void {
    const miembros = this.resumen?.miembros ?? [];
    this.gastoForm = {
      concepto: '',
      monto_total: null,
      fecha: new Date().toISOString().split('T')[0],
      pagado_por_id: this.resumen?.miembros?.[0]?.id ?? null,
      notas: '',
      categoria_id: null,
      medio_pago: '',
      participantes: miembros.map(m => ({ miembro_id: m.id, nombre: m.nombre, participa: true, peso: 1 })),
    };
  }

  submitGasto(): void {
    if (!this.gastoForm.concepto?.trim() || this.gastoForm.monto_total == null || this.gastoForm.monto_total <= 0 || this.gastoForm.pagado_por_id == null) {
      this.errGasto = 'Completa concepto, monto y quién pagó';
      this.cdr.detectChanges();
      return;
    }
    this.savingGasto = true;
    this.errGasto = '';
    const participantesPayload = this.gastoForm.participantes
      .filter(p => p.participa && p.peso != null && p.peso > 0)
      .map(p => ({ miembro_id: p.miembro_id, peso: p.peso }));
    this.repartoService.createGasto({
      concepto: this.gastoForm.concepto.trim(),
      monto_total: this.gastoForm.monto_total,
      fecha: this.gastoForm.fecha,
      pagado_por_id: this.gastoForm.pagado_por_id,
      notas: this.gastoForm.notas?.trim() || undefined,
      categoria_id: this.gastoForm.categoria_id ?? undefined,
      reparto_id: this.repartoId,
      participantes: participantesPayload.length > 0 ? participantesPayload : undefined,
      medio_pago: this.gastoForm.medio_pago || undefined,
    }).subscribe({
      next: () => {
        this.savingGasto = false;
        this.showGasto = false;
        this.resetGastoForm();
        this.load();
        this.notify.success('Gasto registrado');
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.savingGasto = false;
        this.errGasto = e.error?.error || 'Error al guardar';
        this.cdr.detectChanges();
      },
    });
  }

  abrirEditarGasto(g: RepartoGasto): void {
    const miembros = this.resumen?.miembros ?? [];
    const partMap = (g.participantes?.length ?? 0) > 0
      ? new Map((g.participantes ?? []).map(p => [p.miembro_id, p.peso]))
      : null;
    this.gastoEditando = g;
    this.gastoFormEdit = {
      concepto: g.concepto,
      monto_total: g.monto_total,
      fecha: g.fecha,
      pagado_por_id: g.pagado_por_id,
      notas: g.notas ?? '',
      categoria_id: g.categoria_id ?? null,
      medio_pago: (g as RepartoGasto & { medio_pago?: string }).medio_pago ?? '',
      participantes: miembros.map(m => ({
        miembro_id: m.id,
        nombre: m.nombre,
        participa: partMap ? partMap.has(m.id) : true,
        peso: partMap ? (partMap.get(m.id) ?? 1) : 1,
      })),
    };
    this.errGastoEdit = '';
    this.cdr.detectChanges();
  }

  cancelarEditarGasto(): void {
    this.gastoEditando = null;
    this.errGastoEdit = '';
    this.cdr.detectChanges();
  }

  submitEditarGasto(): void {
    if (!this.gastoEditando) return;
    if (!this.gastoFormEdit.concepto?.trim() || this.gastoFormEdit.monto_total == null || this.gastoFormEdit.monto_total <= 0 || this.gastoFormEdit.pagado_por_id == null) {
      this.errGastoEdit = 'Completa concepto, monto y quién pagó';
      this.cdr.detectChanges();
      return;
    }
    this.savingGastoEdit = true;
    this.errGastoEdit = '';
    const participantesPayload = this.gastoFormEdit.participantes
      .filter(p => p.participa && p.peso != null && p.peso > 0)
      .map(p => ({ miembro_id: p.miembro_id, peso: p.peso }));
    this.repartoService.updateGasto(this.gastoEditando.id, {
      concepto: this.gastoFormEdit.concepto.trim(),
      monto_total: this.gastoFormEdit.monto_total,
      fecha: this.gastoFormEdit.fecha,
      pagado_por_id: this.gastoFormEdit.pagado_por_id,
      notas: this.gastoFormEdit.notas?.trim() || undefined,
      categoria_id: this.gastoFormEdit.categoria_id ?? undefined,
      participantes: participantesPayload,
      medio_pago: this.gastoFormEdit.medio_pago || undefined,
    }).subscribe({
      next: () => {
        this.savingGastoEdit = false;
        this.gastoEditando = null;
        this.load();
        this.notify.success('Gasto actualizado');
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.savingGastoEdit = false;
        this.errGastoEdit = e.error?.error || 'Error al guardar';
        this.cdr.detectChanges();
      },
    });
  }

  confirmarAnularGasto(g: RepartoGasto): void {
    this.gastoAAnular = g;
    this.cdr.detectChanges();
  }

  cerrarModalAnularGasto(): void {
    this.gastoAAnular = null;
    this.cdr.detectChanges();
  }

  anularGasto(): void {
    if (!this.gastoAAnular) return;
    const concepto = this.gastoAAnular.concepto;
    this.deletingGasto = true;
    this.repartoService.deleteGasto(this.gastoAAnular.id).subscribe({
      next: () => {
        this.deletingGasto = false;
        this.gastoAAnular = null;
        this.load();
        this.notify.success('Gasto anulado: ' + concepto);
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.deletingGasto = false;
        this.notify.error(e.error?.error || 'Error al anular');
        this.cdr.detectChanges();
      },
    });
  }

  /** Cantidad de reembolsos activos que impedirían anular este gasto (asociados por gasto_id o recibidos por quien pagó el gasto) */
  reembolsosAsociadosCount(gasto: RepartoGasto): number {
    if (!this.resumen?.reembolsos) return 0;
    return this.resumen.reembolsos.filter(
      (r) => r.gasto_id === gasto.id || r.para_miembro_id === gasto.pagado_por_id
    ).length;
  }

  /** Concepto del gasto por id para mostrar en lista de reembolsos */
  getGastoConcepto(gastoId: number | null | undefined): string | null {
    if (gastoId == null || !this.resumen?.gastos) return null;
    const g = this.resumen.gastos.find((x) => x.id === gastoId);
    return g ? g.concepto : null;
  }

  descargarReporte(): void {
    this.descargandoReporte = true;
    const desde = this.reporteDesde?.trim() || undefined;
    const hasta = this.reporteHasta?.trim() || undefined;
    this.repartoService.exportarReporte(desde, hasta, 'csv', this.repartoId).subscribe({
      next: (blob) => {
        this.descargandoReporte = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reparto-reporte-${desde || 'todo'}-${hasta || 'todo'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.notify.success('Reporte descargado');
        this.cdr.detectChanges();
      },
      error: () => {
        this.descargandoReporte = false;
        this.notify.error('Error al descargar el reporte');
        this.cdr.detectChanges();
      },
    });
  }

  descargarExcel(): void {
    this.descargandoExcel = true;
    const desde = this.reporteDesde?.trim() || undefined;
    const hasta = this.reporteHasta?.trim() || undefined;
    this.repartoService.exportarReporte(desde, hasta, 'xlsx', this.repartoId).subscribe({
      next: (blob) => {
        this.descargandoExcel = false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reparto-${desde || 'todo'}-${hasta || 'todo'}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.notify.success('Excel descargado');
        this.cdr.detectChanges();
      },
      error: () => {
        this.descargandoExcel = false;
        this.notify.error('Error al descargar Excel');
        this.cdr.detectChanges();
      },
    });
  }

  private formatNum(n: number): string {
    return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private formatFecha(s: string): string {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  descargarPdf(): void {
    this.descargandoPdf = true;
    const desde = this.reporteDesde?.trim() || undefined;
    const hasta = this.reporteHasta?.trim() || undefined;
    this.repartoService.getResumen(desde, hasta, this.repartoId).subscribe({
      next: (r) => {
        try {
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          const margin = 16;
          const pageW = doc.internal.pageSize.getWidth();
          const pageH = doc.internal.pageSize.getHeight();
          const contentW = pageW - margin * 2;
          let y = margin;
          const headerH = 22;
          const primaryColor: [number, number, number] = [41, 128, 185];
          const darkColor: [number, number, number] = [44, 62, 80];
          const lightGray: [number, number, number] = [245, 245, 245];
          const greenColor: [number, number, number] = [39, 174, 96];
          const redColor: [number, number, number] = [231, 76, 60];

          const drawHeader = () => {
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, pageW, headerH, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('REPARTO DE GASTOS', margin, 12);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const periodo = (desde && hasta) ? `Período: ${this.formatFecha(desde)} — ${this.formatFecha(hasta)}` : 'Período: todo';
            doc.text(periodo, margin, 18);
            doc.setTextColor(0, 0, 0);
            y = headerH + 14;
          };

          const addSectionTitle = (title: string) => {
            if (y > pageH - 30) { doc.addPage(); drawHeader(); }
            doc.setFillColor(...lightGray);
            doc.rect(margin, y - 4, contentW, 10, 'F');
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.2);
            doc.line(margin, y + 6, margin + contentW, y + 6);
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...darkColor);
            doc.text(title, margin + 2, y + 3);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            y += 12;
          };

          doc.setProperties({ title: 'Reparto de gastos', subject: 'Detalle de reparto' });
          drawHeader();

          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('Resumen', margin, y);
          y += 6;
          doc.setFillColor(248, 249, 250);
          doc.roundedRect(margin, y - 4, 60, 18, 2, 2, 'F');
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text(`Total gastos:     S/ ${this.formatNum(r.total_gastos)}`, margin + 4, y + 3);
          doc.text(`Cuota por persona: S/ ${this.formatNum(r.cuota_por_persona)}`, margin + 4, y + 10);
          y += 22;

          if (r.miembros.length) {
            addSectionTitle('Participantes y saldos');
            const bodyMiembros = r.miembros.map(m => [
              m.nombre,
              `S/ ${this.formatNum(m.total_pagado_servicios)}`,
              `S/ ${this.formatNum(m.cuota_que_le_toca)}`,
              `S/ ${this.formatNum(m.reembolsos_recibidos)}`,
              `S/ ${this.formatNum(m.reembolsos_dados)}`,
              `S/ ${this.formatNum(m.saldo)}`,
            ]);
            autoTable(doc, {
              startY: y,
              head: [['Nombre', 'Pagó servicios', 'Cuota', 'Reemb. recibidos', 'Reemb. dados', 'Saldo']],
              body: bodyMiembros,
              margin: { left: margin, right: margin },
              theme: 'striped',
              headStyles: {
                fillColor: darkColor,
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold',
                cellPadding: 4,
              },
              styles: { fontSize: 9, cellPadding: 3 },
              columnStyles: {
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' },
              },
              didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 5) {
                  const val = r.miembros[data.row.index]?.saldo ?? 0;
                  if (val > 0) data.cell.styles.textColor = greenColor;
                  else if (val < 0) data.cell.styles.textColor = redColor;
                }
              },
            });
            doc.setTextColor(0, 0, 0);
            y = ((doc as any).lastAutoTable?.finalY ?? y) + 12;
          }

          if (r.gastos.length) {
            addSectionTitle('Gastos');
            if (y > pageH - 50) { doc.addPage(); drawHeader(); addSectionTitle('Gastos'); }
            autoTable(doc, {
              startY: y,
              head: [['Concepto', 'Fecha', 'Monto', 'Pagado por']],
              body: r.gastos.map(g => [
                (g.concepto || '') + (g.categoria_nombre ? ' · ' + g.categoria_nombre : ''),
                this.formatFecha(g.fecha),
                `S/ ${this.formatNum(g.monto_total)}`,
                g.pagado_por_nombre || String(g.pagado_por_id),
              ]),
              margin: { left: margin, right: margin },
              theme: 'striped',
              headStyles: {
                fillColor: darkColor,
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold',
                cellPadding: 4,
              },
              styles: { fontSize: 9, cellPadding: 3 },
              columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
            });
            y = ((doc as any).lastAutoTable?.finalY ?? y) + 12;
          }

          if (r.reembolsos.length) {
            addSectionTitle('Reembolsos');
            if (y > pageH - 50) { doc.addPage(); drawHeader(); addSectionTitle('Reembolsos'); }
            autoTable(doc, {
              startY: y,
              head: [['De', 'Para', 'Monto', 'Fecha']],
              body: r.reembolsos.map(re => [
                re.de_nombre || String(re.de_miembro_id),
                re.para_nombre || String(re.para_miembro_id),
                `S/ ${this.formatNum(re.monto)}`,
                this.formatFecha(re.fecha),
              ]),
              margin: { left: margin, right: margin },
              theme: 'striped',
              headStyles: {
                fillColor: darkColor,
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold',
                cellPadding: 4,
              },
              styles: { fontSize: 9, cellPadding: 3 },
              columnStyles: { 2: { halign: 'right' }, 3: { halign: 'center' } },
            });
            y = ((doc as any).lastAutoTable?.finalY ?? y) + 12;
          }

          if (r.sugerencias_reembolso?.length) {
            addSectionTitle('Sugerencias de reembolso');
            if (y > pageH - 40) { doc.addPage(); drawHeader(); addSectionTitle('Sugerencias de reembolso'); }
            doc.setFontSize(10);
            for (const s of r.sugerencias_reembolso) {
              if (y > pageH - 15) { doc.addPage(); drawHeader(); y = headerH + 14; }
              doc.text(`${s.de_nombre}  →  ${s.para_nombre}:  S/ ${this.formatNum(s.monto)}`, margin, y);
              y += 7;
            }
            y += 6;
          }

          if (r.resumen_por_mes?.length) {
            addSectionTitle('Resumen por mes');
            doc.setFontSize(9);
            for (const item of r.resumen_por_mes) {
              if (y > pageH - 15) { doc.addPage(); drawHeader(); y = headerH + 14; }
              doc.text(`${item.mes} — Total: S/ ${this.formatNum(item.total)}  |  Cuota/persona: S/ ${this.formatNum(item.cuota_por_persona)}`, margin, y);
              y += 6;
            }
            y += 4;
          }

          const totalP = (doc as any).internal.getNumberOfPages();
          for (let i = 1; i <= totalP; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(128, 128, 128);
            doc.text(
              `Generado el ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}  —  Página ${i} de ${totalP}`,
              margin,
              pageH - 8
            );
            doc.setTextColor(0, 0, 0);
          }

          const nombreArchivo = `reparto-detalle-${desde || 'todo'}-${hasta || 'todo'}.pdf`;
          doc.save(nombreArchivo);
          this.notify.success('PDF descargado');
        } catch (err) {
          this.notify.error('Error al generar el PDF');
        }
        this.descargandoPdf = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.descargandoPdf = false;
        this.notify.error('Error al cargar datos para el PDF');
        this.cdr.detectChanges();
      },
    });
  }

  toggleReembolso(): void {
    this.showReembolso = !this.showReembolso;
    this.errReembolso = '';
    if (!this.showReembolso) this.resetReembolsoForm();
    this.cdr.detectChanges();
  }

  togglePresupuesto(): void {
    this.showPresupuesto = !this.showPresupuesto;
    if (this.showPresupuesto) this.loadPresupuestos();
    this.cdr.detectChanges();
  }

  submitPresupuesto(): void {
    const { anno, mes, monto_techo } = this.presupuestoForm;
    if (monto_techo < 0) {
      this.notify.error('El monto debe ser ≥ 0');
      return;
    }
    this.savingPresupuesto = true;
    this.repartoService.createPresupuesto({ anno, mes, monto_techo, reparto_id: this.repartoId }).subscribe({
      next: () => {
        this.savingPresupuesto = false;
        this.loadPresupuestos();
        this.notify.success('Presupuesto guardado');
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingPresupuesto = false;
        this.notify.error('Error al guardar presupuesto');
        this.cdr.detectChanges();
      },
    });
  }

  submitNuevaCategoria(): void {
    if (!this.nuevaCategoriaNombre?.trim()) return;
    this.savingCategoria = true;
    this.repartoService.createCategoria({ nombre: this.nuevaCategoriaNombre.trim(), reparto_id: this.repartoId }).subscribe({
      next: () => {
        this.savingCategoria = false;
        this.showNuevaCategoria = false;
        this.nuevaCategoriaNombre = '';
        this.load();
        this.notify.success('Categoría creada');
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingCategoria = false;
        this.notify.error('Error al crear categoría');
        this.cdr.detectChanges();
      },
    });
  }

  abrirEditarCategoria(c: RepartoCategoria): void {
    this.categoriaEditando = c;
    this.categoriaFormEdit = { nombre: c.nombre, color: c.color || '' };
    this.cdr.detectChanges();
  }

  cancelarEditarCategoria(): void {
    this.categoriaEditando = null;
    this.cdr.detectChanges();
  }

  submitEditarCategoria(): void {
    if (!this.categoriaEditando || !this.categoriaFormEdit.nombre?.trim()) return;
    this.savingCategoriaEdit = true;
    this.repartoService.updateCategoria(this.categoriaEditando.id, {
      nombre: this.categoriaFormEdit.nombre.trim(),
      color: this.categoriaFormEdit.color?.trim() || undefined,
    }).subscribe({
      next: () => {
        this.savingCategoriaEdit = false;
        this.categoriaEditando = null;
        this.load();
        this.notify.success('Categoría actualizada');
        this.cdr.detectChanges();
      },
      error: () => {
        this.savingCategoriaEdit = false;
        this.notify.error('Error al actualizar');
        this.cdr.detectChanges();
      },
    });
  }

  confirmarEliminarCategoria(c: RepartoCategoria): void {
    this.categoriaAEliminar = c;
    this.cdr.detectChanges();
  }

  cerrarModalEliminarCategoria(): void {
    this.categoriaAEliminar = null;
    this.cdr.detectChanges();
  }

  eliminarCategoria(): void {
    if (!this.categoriaAEliminar) return;
    this.deletingCategoria = true;
    const nombre = this.categoriaAEliminar.nombre;
    this.repartoService.deleteCategoria(this.categoriaAEliminar.id).subscribe({
      next: () => {
        this.deletingCategoria = false;
        this.categoriaAEliminar = null;
        this.load();
        this.notify.success('Categoría eliminada: ' + nombre);
        this.cdr.detectChanges();
      },
      error: () => {
        this.deletingCategoria = false;
        this.notify.error('Error al eliminar');
        this.cdr.detectChanges();
      },
    });
  }

  repetirGastoMes(g: RepartoGasto): void {
    this.repitiendoGastoId = g.id;
    this.repartoService.repetirGastoMes(g.id).subscribe({
      next: () => {
        this.repitiendoGastoId = null;
        this.load();
        this.notify.success('Gasto repetido al mes siguiente');
        this.cdr.detectChanges();
      },
      error: () => {
        this.repitiendoGastoId = null;
        this.notify.error('Error al repetir gasto');
        this.cdr.detectChanges();
      },
    });
  }

  loadAdjuntos(gastoId: number): void {
    this.repartoService.getAdjuntos(gastoId).subscribe({
      next: (list) => {
        this.adjuntosPorGasto = { ...this.adjuntosPorGasto, [gastoId]: list };
        this.cdr.detectChanges();
      },
    });
  }

  getAdjuntos(gastoId: number): RepartoAdjunto[] {
    return this.adjuntosPorGasto[gastoId] ?? [];
  }

  onFileAdjunto(gastoId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.subiendoAdjuntoGastoId = gastoId;
    this.repartoService.uploadAdjunto(gastoId, file).subscribe({
      next: () => {
        this.subiendoAdjuntoGastoId = null;
        this.loadAdjuntos(gastoId);
        this.notify.success('Archivo subido');
        input.value = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.subiendoAdjuntoGastoId = null;
        this.notify.error('Error al subir archivo');
        this.cdr.detectChanges();
      },
    });
  }

  eliminarAdjunto(adj: RepartoAdjunto): void {
    this.repartoService.deleteAdjunto(adj.id).subscribe({
      next: () => {
        this.loadAdjuntos(adj.gasto_id);
        this.notify.success('Adjunto eliminado');
        this.cdr.detectChanges();
      },
      error: () => this.notify.error('Error al eliminar'),
    });
  }

  descargarAdjunto(adj: RepartoAdjunto): void {
    this.repartoService.getAdjuntoDescarga(adj.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = adj.nombre_archivo || 'adjunto';
        a.click();
        URL.revokeObjectURL(url);
        this.notify.success('Descarga iniciada');
      },
      error: () => this.notify.error('Error al descargar'),
    });
  }

  getMedioPagoLabel(value: string | null | undefined): string {
    if (!value) return '';
    const item = MEDIOS_PAGO.find(m => m.value === value);
    return item ? item.label : value;
  }

  loadAdjuntosReembolso(reembolsoId: number): void {
    this.repartoService.getAdjuntosReembolso(reembolsoId).subscribe({
      next: (list) => {
        this.adjuntosPorReembolso = { ...this.adjuntosPorReembolso, [reembolsoId]: list };
        this.cdr.detectChanges();
      },
    });
  }

  getAdjuntosReembolso(reembolsoId: number): RepartoReembolsoAdjunto[] {
    return this.adjuntosPorReembolso[reembolsoId] ?? [];
  }

  onFileAdjuntoReembolso(reembolsoId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.subiendoAdjuntoReembolsoId = reembolsoId;
    this.repartoService.uploadAdjuntoReembolso(reembolsoId, file).subscribe({
      next: () => {
        this.subiendoAdjuntoReembolsoId = null;
        this.loadAdjuntosReembolso(reembolsoId);
        this.notify.success('Archivo subido');
        input.value = '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.subiendoAdjuntoReembolsoId = null;
        this.notify.error('Error al subir archivo');
        this.cdr.detectChanges();
      },
    });
  }

  eliminarAdjuntoReembolso(adj: RepartoReembolsoAdjunto): void {
    this.repartoService.deleteAdjuntoReembolso(adj.id).subscribe({
      next: () => {
        this.loadAdjuntosReembolso(adj.reembolso_id);
        this.notify.success('Adjunto eliminado');
        this.cdr.detectChanges();
      },
      error: () => this.notify.error('Error al eliminar'),
    });
  }

  descargarAdjuntoReembolso(adj: RepartoReembolsoAdjunto): void {
    this.repartoService.getAdjuntoReembolsoDescarga(adj.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = adj.nombre_archivo || 'adjunto';
        a.click();
        URL.revokeObjectURL(url);
        this.notify.success('Descarga iniciada');
      },
      error: () => this.notify.error('Error al descargar'),
    });
  }

  resetReembolsoForm(): void {
    this.reembolsoForm = {
      de_miembro_id: null,
      para_miembro_id: null,
      monto: null,
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      gasto_id: null,
      medio_pago: '',
    };
  }

  submitReembolso(): void {
    if (
      this.reembolsoForm.de_miembro_id == null ||
      this.reembolsoForm.para_miembro_id == null ||
      this.reembolsoForm.de_miembro_id === this.reembolsoForm.para_miembro_id ||
      this.reembolsoForm.monto == null ||
      this.reembolsoForm.monto <= 0
    ) {
      this.errReembolso = 'Elige quién paga, a quién y el monto (personas distintas)';
      this.cdr.detectChanges();
      return;
    }
    this.savingReembolso = true;
    this.errReembolso = '';
    this.repartoService.createReembolso({
      de_miembro_id: this.reembolsoForm.de_miembro_id,
      para_miembro_id: this.reembolsoForm.para_miembro_id,
      monto: this.reembolsoForm.monto,
      fecha: this.reembolsoForm.fecha,
      concepto: this.reembolsoForm.concepto?.trim() || undefined,
      gasto_id: this.reembolsoForm.gasto_id ?? undefined,
      reparto_id: this.repartoId,
      medio_pago: this.reembolsoForm.medio_pago || undefined,
    }).subscribe({
      next: () => {
        this.savingReembolso = false;
        this.showReembolso = false;
        this.resetReembolsoForm();
        this.load();
        this.notify.success('Reembolso registrado');
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.savingReembolso = false;
        this.errReembolso = e.error?.error || 'Error al guardar';
        this.cdr.detectChanges();
      },
    });
  }

  abrirEditarReembolso(r: RepartoReembolso): void {
    this.reembolsoEditando = r;
    this.reembolsoFormEdit = {
      de_miembro_id: r.de_miembro_id,
      para_miembro_id: r.para_miembro_id,
      monto: r.monto,
      fecha: r.fecha,
      concepto: r.concepto ?? '',
      gasto_id: r.gasto_id ?? null,
      medio_pago: r.medio_pago ?? '',
    };
    this.errReembolsoEdit = '';
    this.cdr.detectChanges();
  }

  cancelarEditarReembolso(): void {
    this.reembolsoEditando = null;
    this.errReembolsoEdit = '';
    this.cdr.detectChanges();
  }

  submitEditarReembolso(): void {
    if (!this.reembolsoEditando) return;
    if (
      this.reembolsoFormEdit.de_miembro_id == null ||
      this.reembolsoFormEdit.para_miembro_id == null ||
      this.reembolsoFormEdit.de_miembro_id === this.reembolsoFormEdit.para_miembro_id ||
      this.reembolsoFormEdit.monto == null ||
      this.reembolsoFormEdit.monto <= 0
    ) {
      this.errReembolsoEdit = 'Elige quién paga, a quién y el monto (personas distintas)';
      this.cdr.detectChanges();
      return;
    }
    this.savingReembolsoEdit = true;
    this.errReembolsoEdit = '';
    this.repartoService.updateReembolso(this.reembolsoEditando.id, {
      de_miembro_id: this.reembolsoFormEdit.de_miembro_id,
      para_miembro_id: this.reembolsoFormEdit.para_miembro_id,
      monto: this.reembolsoFormEdit.monto,
      fecha: this.reembolsoFormEdit.fecha,
      concepto: this.reembolsoFormEdit.concepto?.trim() || undefined,
      gasto_id: this.reembolsoFormEdit.gasto_id ?? null,
      medio_pago: this.reembolsoFormEdit.medio_pago || undefined,
    }).subscribe({
      next: () => {
        this.savingReembolsoEdit = false;
        this.reembolsoEditando = null;
        this.load();
        this.notify.success('Reembolso actualizado');
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.savingReembolsoEdit = false;
        this.errReembolsoEdit = e.error?.error || 'Error al guardar';
        this.cdr.detectChanges();
      },
    });
  }

  confirmarAnularReembolso(r: RepartoReembolso): void {
    this.reembolsoAAnular = r;
    this.cdr.detectChanges();
  }

  cerrarModalAnularReembolso(): void {
    this.reembolsoAAnular = null;
    this.cdr.detectChanges();
  }

  anularReembolso(): void {
    if (!this.reembolsoAAnular) return;
    const label = this.reembolsoAAnular.de_nombre + ' → ' + this.reembolsoAAnular.para_nombre;
    this.deletingReembolso = true;
    this.repartoService.deleteReembolso(this.reembolsoAAnular.id).subscribe({
      next: () => {
        this.deletingReembolso = false;
        this.reembolsoAAnular = null;
        this.load();
        this.notify.success('Reembolso anulado: ' + label);
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.deletingReembolso = false;
        this.notify.error(e.error?.error || 'Error al anular');
        this.cdr.detectChanges();
      },
    });
  }

  editarCargo(m: { id: number; cargo_adicional_mensual?: number }): void {
    this.editingCargoId = m.id;
    this.cargoEditValue = m.cargo_adicional_mensual ?? 0;
    this.cdr.detectChanges();
  }

  cancelarEditarCargo(): void {
    this.editingCargoId = null;
    this.cdr.detectChanges();
  }

  guardarCargo(): void {
    if (this.editingCargoId == null) return;
    const val = Number(this.cargoEditValue);
    if (isNaN(val) || val < 0) {
      this.notify.error('El cargo debe ser un número ≥ 0');
      return;
    }
    this.savingCargoId = this.editingCargoId;
    this.repartoService.updateMiembro(this.editingCargoId, val).subscribe({
      next: () => {
        this.savingCargoId = null;
        this.editingCargoId = null;
        this.load();
        this.notify.success('Cargo actualizado');
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.savingCargoId = null;
        this.notify.error(e.error?.error || 'Error al guardar');
        this.cdr.detectChanges();
      },
    });
  }

  toggleNuevoMiembro(): void {
    this.showNuevoMiembro = !this.showNuevoMiembro;
    this.errNuevoMiembro = '';
    if (!this.showNuevoMiembro) this.nuevoMiembroForm = { nombre: '', cargo_adicional_mensual: 0 };
    this.cdr.detectChanges();
  }

  submitNuevoMiembro(): void {
    if (!this.nuevoMiembroForm.nombre?.trim()) {
      this.errNuevoMiembro = 'Escribe el nombre de la persona';
      this.cdr.detectChanges();
      return;
    }
    const cargo = Number(this.nuevoMiembroForm.cargo_adicional_mensual);
    if (isNaN(cargo) || cargo < 0) {
      this.errNuevoMiembro = 'Cargo adicional debe ser un número ≥ 0';
      this.cdr.detectChanges();
      return;
    }
    this.savingNuevoMiembro = true;
    this.errNuevoMiembro = '';
    this.repartoService.createMiembro({
      nombre: this.nuevoMiembroForm.nombre.trim(),
      cargo_adicional_mensual: cargo || undefined,
      reparto_id: this.repartoId,
    }).subscribe({
      next: () => {
        this.savingNuevoMiembro = false;
        this.showNuevoMiembro = false;
        this.nuevoMiembroForm = { nombre: '', cargo_adicional_mensual: 0 };
        this.load();
        this.notify.success('Persona agregada al reparto');
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.savingNuevoMiembro = false;
        this.errNuevoMiembro = e.error?.error || 'Error al agregar';
        this.cdr.detectChanges();
      },
    });
  }

  confirmarEliminar(m: RepartoMiembro): void {
    this.miembroAEliminar = m;
    this.cdr.detectChanges();
  }

  cerrarModalEliminar(): void {
    this.miembroAEliminar = null;
    this.cdr.detectChanges();
  }

  eliminarMiembro(): void {
    if (!this.miembroAEliminar) return;
    const nombre = this.miembroAEliminar.nombre;
    this.deletingMiembro = true;
    this.repartoService.deleteMiembro(this.miembroAEliminar.id).subscribe({
      next: () => {
        this.deletingMiembro = false;
        this.miembroAEliminar = null;
        this.load();
        this.notify.success(nombre + ' eliminado/a del reparto');
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.deletingMiembro = false;
        this.notify.error(e.error?.error || 'Error al eliminar');
        this.cdr.detectChanges();
      },
    });
  }
}
