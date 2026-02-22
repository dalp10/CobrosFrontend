const fs = require('fs');

// Fix 1: dashboard - replace slice pipe with substring
let dash = fs.readFileSync('src/app/pages/dashboard/dashboard.component.ts', 'utf8');
dash = dash.replace(
  '{{ m.mes | slice:5:7 }}/{{ m.mes | slice:2:4 }}',
  '{{ m.mes.substring(5,7) }}/{{ m.mes.substring(2,4) }}'
);
fs.writeFileSync('src/app/pages/dashboard/dashboard.component.ts', dash, 'utf8');
console.log('Dashboard slice fixed');

// Fix 2: app.config - remove animations
const config = `import { ApplicationConfig } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { jwtInterceptor } from './interceptors/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    provideHttpClient(withInterceptors([jwtInterceptor])),
  ],
};`;
fs.writeFileSync('src/app/app.config.ts', config, 'utf8');
console.log('app.config fixed');
