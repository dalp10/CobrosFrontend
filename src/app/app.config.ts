import { ApplicationConfig, ErrorHandler, isDevMode } from '@angular/core';
import { provideRouter, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TitleStrategy } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { jwtInterceptor } from './interceptors/jwt.interceptor';
import { authErrorInterceptor } from './interceptors/auth-error.interceptor';
import { retryInterceptor } from './interceptors/retry.interceptor';
import { CobrosTitleStrategy } from './title-strategy';
import { GlobalErrorHandler } from './global-error-handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withRouterConfig({ onSameUrlNavigation: 'reload' })),
    provideHttpClient(withInterceptors([jwtInterceptor, retryInterceptor, authErrorInterceptor])),
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() }),
    { provide: TitleStrategy, useClass: CobrosTitleStrategy },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};