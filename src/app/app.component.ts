import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './components/toast-container/toast-container.component';
import { MessageModalComponent } from './components/message-modal/message-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent, MessageModalComponent],
  template: `
    <router-outlet></router-outlet>
    <app-message-modal />
    <app-toast-container />
  `,
})
export class AppComponent {}
