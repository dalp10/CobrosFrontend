const fs = require('fs');

let dashboard = fs.readFileSync('src/app/pages/dashboard/dashboard.component.ts', 'utf8');

// Replace | number pipe with toFixed method call
dashboard = dashboard.replace(
  /pct\(d\.total_pagado, d\.total_prestado\) \| number:"1\.0-0"/g,
  "pct(d.total_pagado, d.total_prestado).toFixed(0)"
);

// Also ensure DecimalPipe is added just in case
if (!dashboard.includes('DecimalPipe')) {
  dashboard = dashboard.replace(
    "import { DatePipe } from '@angular/common';",
    "import { DatePipe, DecimalPipe } from '@angular/common';"
  );
  // Add to component imports array - find the imports array
  dashboard = dashboard.replace(
    /imports:\s*\[RouterLink,\s*DatePipe,/,
    'imports: [RouterLink, DatePipe, DecimalPipe,'
  );
}

fs.writeFileSync('src/app/pages/dashboard/dashboard.component.ts', dashboard, 'utf8');
console.log('Dashboard OK - pipe number reemplazado');
