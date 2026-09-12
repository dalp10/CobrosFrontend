import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

/** Incluye 'progress' para modal de operación en curso. */
export type ModalMessageType = ToastType | 'progress';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export interface ModalMessage {
  type: ModalMessageType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private nextId = 0;
  private readonly defaultDuration = 4000;
  toasts = signal<Toast[]>([]);

  /** Mensaje actual mostrado en modal (centrado). Si tiene valor, se muestra el modal. */
  modalMessage = signal<ModalMessage | null>(null);

  private add(type: ToastType, message: string, duration = this.defaultDuration): void {
    const id = this.nextId++;
    const toast: Toast = { id, type, message };
    this.toasts.update(list => [...list, toast]);
    if (duration > 0) {
      setTimeout(() => this.dismiss(id), duration);
    }
  }

  /** Cierra el modal de mensaje. */
  closeModal(): void {
    this.modalMessage.set(null);
  }

  /**
   * Muestra un modal "En proceso..." con spinner.
   * Cierra con closeModal() o cuando llames a success() / error() (reemplaza por el resultado).
   */
  showProgress(message: string = 'En proceso...'): void {
    this.modalMessage.set({ type: 'progress', message });
  }

  /**
   * Muestra el mensaje en un modal centrado (en lugar de toast).
   * El usuario debe pulsar "Aceptar" para cerrar.
   */
  showModal(type: ToastType, message: string): void {
    this.modalMessage.set({ type, message });
  }

  success(message: string, duration?: number): void {
    this.showModal('success', message);
  }

  error(message: string, duration?: number): void {
    this.showModal('error', message);
  }

  info(message: string, duration?: number): void {
    this.showModal('info', message);
  }

  /** Para seguir mostrando toasts en esquina (opcional). */
  toastSuccess(message: string, duration?: number): void {
    this.add('success', message, duration ?? this.defaultDuration);
  }

  toastError(message: string, duration?: number): void {
    this.add('error', message, duration ?? this.defaultDuration);
  }

  toastInfo(message: string, duration?: number): void {
    this.add('info', message, duration ?? this.defaultDuration);
  }

  dismiss(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
