const fs = require('fs');

let c = fs.readFileSync('src/app/pages/deudores/deudores.component.ts', 'utf8');

// Add FormsModule to import statement
c = c.replace(
  `import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';`,
  `import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';`
);

// Add FormsModule to component imports array
c = c.replace(
  `imports: [RouterLink, DatePipe, DecimalPipe, ReactiveFormsModule],`,
  `imports: [RouterLink, DatePipe, DecimalPipe, ReactiveFormsModule, FormsModule],`
);

fs.writeFileSync('src/app/pages/deudores/deudores.component.ts', c, 'utf8');
console.log('OK - FormsModule agregado');
