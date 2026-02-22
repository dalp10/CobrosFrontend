import { Component, Input, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-preview-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-preview-button.component.html',
  styleUrl: './image-preview-button.component.css'
})
export class ImagePreviewButtonComponent {
  /** La imagen a previsualizar: puede ser un Data URL (base64) o una URL normal */
  @Input() src: string | null = null;

  /** Texto opcional del botón */
  @Input() label = '🔍 Ver imagen';

  private cdr = inject(ChangeDetectorRef);

  modalVisible = false;

  abrir(): void {
    if (!this.src) return;
    this.modalVisible = true;
    this.cdr.detectChanges();
  }

  cerrar(): void {
    this.modalVisible = false;
    this.cdr.detectChanges();
  }
}
