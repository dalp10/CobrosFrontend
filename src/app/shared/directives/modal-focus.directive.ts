import { Directive, ElementRef, HostListener, OnDestroy, OnInit, Output, EventEmitter, inject } from '@angular/core';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accesibilidad para modales: marca el contenedor como diálogo, atrapa el foco con Tab,
 * cierra con Escape y restaura el foco al elemento que abrió el modal.
 */
@Directive({
  selector: '[appModalFocus]',
  standalone: true,
})
export class ModalFocusDirective implements OnInit, OnDestroy {
  @Output() appModalClose = new EventEmitter<void>();

  private el: ElementRef<HTMLElement> = inject(ElementRef);
  private previouslyFocused: HTMLElement | null = null;

  ngOnInit(): void {
    const host = this.el.nativeElement;
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    if (!host.hasAttribute('tabindex')) host.setAttribute('tabindex', '-1');

    this.previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = host.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable[0] ?? host).focus();
  }

  ngOnDestroy(): void {
    this.previouslyFocused?.focus?.();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.appModalClose.emit();
      return;
    }
    if (event.key !== 'Tab') return;

    const host = this.el.nativeElement;
    const focusable = Array.from(host.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      .filter(elem => elem.offsetParent !== null);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
