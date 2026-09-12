import { Component, inject } from '@angular/core';
import { NotificationService, ToastType, ModalMessageType, ModalMessage } from '../../services/notification.service';

@Component({
  selector: 'app-message-modal',
  standalone: true,
  template: `
    @if (notify.modalMessage(); as msg) {
      <div class="message-modal-overlay" [class.message-modal-overlay-progress]="msg.type === 'progress'" (click)="onOverlayClick(msg)" role="dialog" aria-modal="true" [attr.aria-labelledby]="'msg-modal-title-' + msg.type" [attr.aria-busy]="msg.type === 'progress'">
        <div class="message-modal-box" (click)="$event.stopPropagation()">
          @if (msg.type === 'progress') {
            <div class="message-modal-spinner"></div>
            <h2 [id]="'msg-modal-title-' + msg.type" class="message-modal-title">En proceso</h2>
            <p class="message-modal-text">{{ msg.message }}</p>
          } @else {
            <div class="message-modal-icon" [class]="'message-modal-icon-' + msg.type">
              @switch (msg.type) {
                @case ('success') { ✓ }
                @case ('error') { ✕ }
                @case ('info') { ℹ }
              }
            </div>
            <h2 [id]="'msg-modal-title-' + msg.type" class="message-modal-title">{{ title(msg.type) }}</h2>
            <p class="message-modal-text">{{ msg.message }}</p>
            <div class="message-modal-actions">
              <button type="button" class="message-modal-btn" (click)="notify.closeModal()">Aceptar</button>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .message-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 1rem;
      animation: msgModalFadeIn 0.2s ease;
    }
    @keyframes msgModalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .message-modal-box {
      background: linear-gradient(180deg, #1e2433 0%, #181b26 100%);
      border: 1px solid rgba(46, 52, 80, 0.9);
      border-radius: 16px;
      padding: 24px 28px;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
      animation: msgModalSlideIn 0.25s ease;
    }
    @keyframes msgModalSlideIn {
      from { opacity: 0; transform: scale(0.96) translateY(-10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .message-modal-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      font-weight: 700;
      margin: 0 auto 16px;
    }
    .message-modal-icon-success {
      background: rgba(34, 211, 160, 0.2);
      color: #22d3a0;
    }
    .message-modal-icon-error {
      background: rgba(248, 113, 113, 0.2);
      color: #f87171;
    }
    .message-modal-icon-info {
      background: rgba(91, 154, 255, 0.2);
      color: #5b9aff;
    }
    .message-modal-title {
      font-size: 1.125rem;
      font-weight: 700;
      margin: 0 0 10px;
      color: #f0f2f7;
      text-align: center;
    }
    .message-modal-text {
      font-size: 0.9375rem;
      color: #b4b9c8;
      line-height: 1.5;
      margin: 0 0 20px;
      text-align: center;
    }
    .message-modal-actions {
      display: flex;
      justify-content: center;
    }
    .message-modal-btn {
      background: linear-gradient(135deg, #5b9aff 0%, #7c5cfc 100%);
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 10px 24px;
      font-size: 0.9375rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: box-shadow 0.2s;
    }
    .message-modal-btn:hover {
      box-shadow: 0 4px 14px rgba(91, 154, 255, 0.4);
    }

    .message-modal-overlay-progress {
      cursor: wait;
    }
    .message-modal-spinner {
      width: 48px;
      height: 48px;
      margin: 0 auto 16px;
      border: 3px solid rgba(91, 154, 255, 0.25);
      border-top-color: #5b9aff;
      border-radius: 50%;
      animation: messageModalSpin 0.8s linear infinite;
    }
    @keyframes messageModalSpin {
      to { transform: rotate(360deg); }
    }
  `],
})
export class MessageModalComponent {
  notify = inject(NotificationService);

  onOverlayClick(msg: ModalMessage): void {
    if (msg.type !== 'progress') this.notify.closeModal();
  }

  title(type: ModalMessageType): string {
    switch (type) {
      case 'success': return 'Éxito';
      case 'error': return 'Error';
      case 'info': return 'Información';
      case 'progress': return 'En proceso';
      default: return 'Mensaje';
    }
  }
}
