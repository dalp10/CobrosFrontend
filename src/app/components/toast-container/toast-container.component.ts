import { Component, inject } from '@angular/core';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="toast-container">
      @for (t of notify.toasts(); track t.id) {
        <div class="toast toast-{{ t.type }}" role="alert">
          <span class="toast-msg">{{ t.message }}</span>
          <button type="button" class="toast-close" (click)="notify.dismiss(t.id)" aria-label="Cerrar">&times;</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 360px;
    }
    .toast {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
      animation: toastIn 0.25s ease;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(100%); }
      to { opacity: 1; transform: translateX(0); }
    }
    .toast-success { background: #1a472a; color: #a7f3d0; border: 1px solid #2d5a3d; }
    .toast-error { background: #450a0a; color: #fecaca; border: 1px solid #7f1d1d; }
    .toast-info { background: #0c1929; color: #bae6fd; border: 1px solid #1e3a5f; }
    .toast-msg { flex: 1; font-size: 0.9rem; }
    .toast-close {
      background: none;
      border: none;
      color: inherit;
      opacity: 0.8;
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
      padding: 0 0.25rem;
    }
    .toast-close:hover { opacity: 1; }
  `]
})
export class ToastContainerComponent {
  notify = inject(NotificationService);
}
