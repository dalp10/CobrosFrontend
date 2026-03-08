import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 0;
  private readonly defaultDuration = 4000;
  toasts = signal<Toast[]>([]);

  private add(type: ToastType, message: string, duration = this.defaultDuration): void {
    const id = this.nextId++;
    const toast: Toast = { id, type, message };
    this.toasts.update(list => [...list, toast]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  success(message: string, duration?: number): void {
    this.add('success', message, duration ?? this.defaultDuration);
  }

  error(message: string, duration?: number): void {
    this.add('error', message, duration ?? this.defaultDuration);
  }

  info(message: string, duration?: number): void {
    this.add('info', message, duration ?? this.defaultDuration);
  }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
