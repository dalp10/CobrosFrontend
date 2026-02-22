const fs = require('fs');

let c = fs.readFileSync('src/app/pages/deudor-detail/deudor-detail.component.ts', 'utf8');

c = c.replace(
  'const csv = rows.map(r => r.map(c => \'"\' + String(c).replace(/"',
  'const csv = rows.map((r: any[]) => r.map((c: any) => \'"\' + String(c).replace(/"'
);

fs.writeFileSync('src/app/pages/deudor-detail/deudor-detail.component.ts', c, 'utf8');
console.log('OK');
