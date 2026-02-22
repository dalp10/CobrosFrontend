const fs = require('fs');

// ─── 1. EXPORTAR EXCEL GLOBAL (en pagos.component.ts) ─────────────────
let pagos = fs.readFileSync('src/app/pages/pagos/pagos.component.ts', 'utf8');

// Agregar botón de exportar en el template
pagos = pagos.replace(
  `<button type="submit" class="btn">Filtrar</button>`,
  `<button type="submit" class="btn">Filtrar</button>
      <button type="button" class="btn-excel" (click)="exportExcel()">📊 Excel</button>`
);

// Agregar estilo del botón
pagos = pagos.replace(
  `.btn{background:linear-gradient(135deg,#4f8ef7,#7c5cfc)`,
  `.btn-excel{background:rgba(34,211,160,.15);color:#22d3a0;border:1px solid #22d3a0;border-radius:8px;padding:7px 13px;font-size:.8rem;cursor:pointer;font-family:inherit}
    .btn{background:linear-gradient(135deg,#4f8ef7,#7c5cfc)`
);

// Agregar método exportExcel antes del último método
pagos = pagos.replace(
  `  fmt(v: any): string {`,
  `  exportExcel(): void {
    const rows: any[][] = [
      ['#', 'Fecha', 'Deudor', 'Concepto', 'Monto', 'Metodo', 'N Operacion']
    ];
    this.pagos.forEach((p: any, i: number) => {
      rows.push([
        i + 1,
        p.fecha_pago ? p.fecha_pago.split('T')[0] : '',
        p.deudor_nombre || '',
        p.concepto || '',
        +p.monto,
        p.metodo_pago,
        p.numero_operacion || ''
      ]);
    });
    const total = this.pagos.reduce((s: number, p: any) => s + +(p.monto || 0), 0);
    rows.push(['', '', '', 'TOTAL', total, '', '']);
    const csv = rows.map((r: any[]) => r.map((c: any) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\\n');
    const blob = new Blob(['\\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pagos_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  fmt(v: any): string {`
);

fs.writeFileSync('src/app/pages/pagos/pagos.component.ts', pagos, 'utf8');
console.log('Pagos: exportar Excel OK');


// ─── 2. ALERTAS EN DEUDORES ────────────────────────────────────────────
let deudores = fs.readFileSync('src/app/pages/deudores/deudores.component.ts', 'utf8');

// Agregar sección de alertas en el template, justo antes del buscador
deudores = deudores.replace(
  `<input class="search"`,
  `<!-- ALERTAS -->
    @if (alertas.length) {
      <div class="alertas-box">
        <div class="alertas-head">
          <span>⚠️ Deudores sin pago reciente</span>
          <div class="dias-ctrl">
            <span>Mostrar sin pago hace más de</span>
            <select [(ngModel)]="diasAlerta" (change)="calcularAlertas()" [ngModelOptions]="{standalone:true}" class="dias-sel">
              <option [ngValue]="15">15 días</option>
              <option [ngValue]="30">30 días</option>
              <option [ngValue]="60">60 días</option>
              <option [ngValue]="90">90 días</option>
            </select>
          </div>
        </div>
        <div class="alertas-list">
          @for (a of alertas; track a.id) {
            <div class="alerta-item">
              <div class="alerta-avatar">{{ a.nombre[0] }}{{ a.apellidos[0] }}</div>
              <div class="alerta-info">
                <a [routerLink]="['/deudores', a.id]" class="alerta-name">{{ a.nombre }} {{ a.apellidos }}</a>
                <span class="alerta-meta">
                  @if (a.ultimo_pago) { Último pago: {{ a.ultimo_pago | date:"dd/MM/yyyy" }} (hace {{ diasDesde(a.ultimo_pago) }} días) }
                  @else { Sin pagos registrados }
                </span>
              </div>
              <span class="alerta-pendiente">S/ {{ fmt(a.saldo_pendiente) }}</span>
            </div>
          }
        </div>
      </div>
    }
    <div class="dias-config" style="margin-bottom:14px;display:flex;align-items:center;gap:10px">
      <span style="font-size:.72rem;color:#7a839e">Alertas sin pago hace más de</span>
      <select [(ngModel)]="diasAlerta" (change)="calcularAlertas()" [ngModelOptions]="{standalone:true}" class="dias-sel">
        <option [ngValue]="15">15 días</option>
        <option [ngValue]="30">30 días</option>
        <option [ngValue]="60">60 días</option>
        <option [ngValue]="90">90 días</option>
      </select>
    </div>

    <input class="search"`
);

// Agregar estilos de alertas
deudores = deudores.replace(
  `.search{`,
  `.alertas-box{background:rgba(247,201,72,.06);border:1px solid rgba(247,201,72,.25);border-radius:12px;padding:14px 16px;margin-bottom:16px}
    .alertas-head{display:flex;justify-content:space-between;align-items:center;font-size:.78rem;font-weight:600;color:#f7c948;margin-bottom:10px}
    .alertas-list{display:flex;flex-direction:column;gap:8px}
    .alerta-item{display:flex;align-items:center;gap:10px;background:rgba(247,201,72,.05);border-radius:8px;padding:8px 10px}
    .alerta-avatar{width:32px;height:32px;border-radius:50%;background:rgba(247,201,72,.2);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:#f7c948;flex-shrink:0}
    .alerta-info{flex:1}
    .alerta-name{color:#f7c948;text-decoration:none;font-size:.82rem;font-weight:600;display:block}.alerta-name:hover{text-decoration:underline}
    .alerta-meta{font-size:.67rem;color:#7a839e}
    .alerta-pendiente{font-family:monospace;font-size:.78rem;color:#f75f5f;font-weight:700}
    .dias-sel{background:#1e2230;border:1px solid #2e3450;border-radius:6px;color:#e8ecf4;padding:3px 8px;font-size:.72rem;outline:none;font-family:inherit}
    .dias-ctrl{display:flex;align-items:center;gap:8px;font-size:.72rem;font-weight:400;color:#7a839e}
    .search{`
);

// Agregar variable diasAlerta y alertas, y método calcularAlertas
deudores = deudores.replace(
  `  searchTerm = '';`,
  `  searchTerm = '';
  diasAlerta = 30;
  alertas: any[] = [];`
);

// Llamar calcularAlertas después de cargar
deudores = deudores.replace(
  `this.deudores = d; this.filtrar(); this.loading = false; this.cdr.detectChanges();`,
  `this.deudores = d; this.filtrar(); this.calcularAlertas(); this.loading = false; this.cdr.detectChanges();`
);

// Agregar métodos calcularAlertas y diasDesde
deudores = deudores.replace(
  `  fmt(v: any): string {`,
  `  calcularAlertas(): void {
    const hoy = new Date();
    this.alertas = this.deudores.filter(d => {
      if (+d.saldo_pendiente <= 0) return false;
      if (!d.ultimo_pago) return true;
      const diff = Math.floor((hoy.getTime() - new Date(d.ultimo_pago).getTime()) / 86400000);
      return diff >= this.diasAlerta;
    });
    this.cdr.detectChanges();
  }

  diasDesde(fecha: string): number {
    return Math.floor((new Date().getTime() - new Date(fecha).getTime()) / 86400000);
  }

  fmt(v: any): string {`
);

fs.writeFileSync('src/app/pages/deudores/deudores.component.ts', deudores, 'utf8');
console.log('Deudores: alertas OK');


// ─── 3. MODO OSCURO/CLARO ─────────────────────────────────────────────
// Agregar toggle en el layout
let layout = fs.readFileSync('src/app/layout/layout.component.ts', 'utf8');

if (!layout.includes('toggleTheme')) {
  // Agregar botón en el template - buscar el área del footer del sidebar
  layout = layout.replace(
    `<button class="logout-btn" (click)="logout()">Salir</button>`,
    `<button class="theme-btn" (click)="toggleTheme()">{{ darkMode ? '☀️ Claro' : '🌙 Oscuro' }}</button>
      <button class="logout-btn" (click)="logout()">Salir</button>`
  );

  // Agregar variable y método
  layout = layout.replace(
    `logout(): void {`,
    `darkMode = true;

  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
    localStorage.setItem('cobros_theme', this.darkMode ? 'dark' : 'light');
  }

  logout(): void {`
  );

  // Inicializar tema al arrancar - agregar en ngOnInit o constructor
  layout = layout.replace(
    `private router = inject(Router);`,
    `private router = inject(Router);`
  );

  // Agregar ngOnInit si no existe o agregar al existente
  if (!layout.includes('ngOnInit')) {
    layout = layout.replace(
      `logout(): void {`,
      `ngOnInit(): void {
    const saved = localStorage.getItem('cobros_theme');
    this.darkMode = saved !== 'light';
    document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
  }

  logout(): void {`
    );
    // Agregar OnInit al implements si existe
    layout = layout.replace('implements OnDestroy', 'implements OnInit, OnDestroy');
    layout = layout.replace("import { Component, inject", "import { Component, OnInit, inject");
  }

  // Agregar estilo del botón
  layout = layout.replace(
    `.logout-btn{`,
    `.theme-btn{background:none;border:1px solid #2e3450;color:#7a839e;border-radius:8px;padding:6px 12px;font-size:.72rem;cursor:pointer;font-family:inherit;width:100%;margin-bottom:6px}
    .theme-btn:hover{border-color:#4f8ef7;color:#4f8ef7}
    .logout-btn{`
  );

  fs.writeFileSync('src/app/layout/layout.component.ts', layout, 'utf8');
  console.log('Layout: modo oscuro/claro OK');
}

// ─── 4. CSS VARIABLES PARA MODO CLARO en styles.css ──────────────────
let styles = '';
try { styles = fs.readFileSync('src/styles.css', 'utf8'); } catch(e) { styles = ''; }

if (!styles.includes('data-theme')) {
  const themeCSS = `
/* ── Modo claro ── */
:root { color-scheme: dark; }

[data-theme="light"] {
  --bg: #f0f2f8;
  --sidebar-bg: #ffffff;
  --card-bg: #ffffff;
  --border: #e2e6f0;
  --text: #1a1d2e;
  --text-muted: #6b7280;
}

[data-theme="light"] body {
  background: var(--bg) !important;
  color: var(--text) !important;
}

[data-theme="light"] .layout-sidebar {
  background: var(--sidebar-bg) !important;
  border-right-color: var(--border) !important;
}

[data-theme="light"] .card,
[data-theme="light"] .pform,
[data-theme="light"] .twrap,
[data-theme="light"] .scard,
[data-theme="light"] .lcard,
[data-theme="light"] .modal,
[data-theme="light"] .modal-sm {
  background: var(--card-bg) !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

[data-theme="light"] th,
[data-theme="light"] td {
  border-color: var(--border) !important;
  color: var(--text) !important;
}

[data-theme="light"] th {
  background: #f8f9fc !important;
}

[data-theme="light"] input,
[data-theme="light"] select,
[data-theme="light"] textarea {
  background: #f8f9fc !important;
  border-color: var(--border) !important;
  color: var(--text) !important;
}

[data-theme="light"] .nav-link {
  color: var(--text-muted) !important;
}

[data-theme="light"] .nav-link.active,
[data-theme="light"] .nav-link:hover {
  background: #f0f4ff !important;
  color: #4f8ef7 !important;
}

[data-theme="light"] .overlay {
  background: rgba(0,0,0,.4) !important;
}
`;
  fs.writeFileSync('src/styles.css', styles + themeCSS, 'utf8');
  console.log('styles.css: modo claro OK');
}

console.log('\n✅ Todo listo — ng serve para ver los cambios');
