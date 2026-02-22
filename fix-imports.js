const fs = require('fs');

// Fix 1: Layout - agregar import de FormsModule
let layout = fs.readFileSync('src/app/layout/layout.component.ts', 'utf8');

if (!layout.includes("import { FormsModule }")) {
  layout = layout.replace(
    `import { RouterOutlet, RouterLinkActive`,
    `import { FormsModule } from '@angular/forms';\nimport { RouterOutlet, RouterLinkActive`
  );
  console.log('Layout: FormsModule import agregado');
}

// Asegurarse que FormsModule está en el array de imports del componente
if (!layout.includes('FormsModule')) {
  layout = layout.replace(
    'imports: [RouterOutlet, RouterLinkActive',
    'imports: [RouterOutlet, RouterLinkActive, FormsModule'
  );
}

fs.writeFileSync('src/app/layout/layout.component.ts', layout, 'utf8');
console.log('Layout OK');

// Fix 2: Dashboard - agregar DecimalPipe y reemplazar | number por método
let dashboard = fs.readFileSync('src/app/pages/dashboard/dashboard.component.ts', 'utf8');

// Agregar DecimalPipe al import de @angular/common
if (!dashboard.includes('DecimalPipe')) {
  dashboard = dashboard.replace(
    `import { DatePipe } from '@angular/common';`,
    `import { DatePipe, DecimalPipe } from '@angular/common';`
  );
  dashboard = dashboard.replace(
    `imports: [RouterLink, DatePipe,`,
    `imports: [RouterLink, DatePipe, DecimalPipe,`
  );
  console.log('Dashboard: DecimalPipe agregado');
}

fs.writeFileSync('src/app/pages/dashboard/dashboard.component.ts', dashboard, 'utf8');
console.log('Dashboard OK');
