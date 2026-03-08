import { ErrorHandler, Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from './services/notification.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private notify = inject(NotificationService);

  handleError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      // Errores HTTP ya manejados por interceptores o componentes (401/403 → auth, etc.)
      console.error('HTTP Error', error.status, error.url, error);
      return;
    }
    const message = error instanceof Error ? error.message : 'Ha ocurrido un error inesperado';
    this.notify.error(message);
    console.error(error);
  }
}
