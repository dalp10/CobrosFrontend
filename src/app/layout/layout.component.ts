import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterOutlet, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLinkActive, FormsModule],
  template: `
  <div class="shell">
    <nav class="sidebar">
      <div class="logo">Cobros</div>
      <ul class="nav">
        <li><a (click)="nav('dashboard')" routerLinkActive="active" [routerLinkActiveOptions]="{exact:false}">Dashboard</a></li>
        <li><a (click)="nav('deudores')" routerLinkActive="active">Deudores</a></li>
        <li><a (click)="nav('prestamos')" routerLinkActive="active">Prestamos</a></li>
        <li><a (click)="nav('pagos')" routerLinkActive="active">Pagos</a></li>
      </ul>
      <div class="footer">
        @if (auth.currentUser(); as u) {
          <span class="uname">{{ u.nombre }}</span>
          <span class="urole">{{ u.rol }}</span>
        }
        <button (click)="auth.logout()">Salir</button>
      </div>
    </nav>
    <main class="content"><router-outlet></router-outlet></main>
  </div>
  `,
  styles: [`.shell{display:flex;height:100vh;overflow:hidden}.sidebar{width:220px;min-width:220px;background:#161920;border-right:1px solid #2e3450;display:flex;flex-direction:column;padding:20px 0}.logo{font-size:1.1rem;font-weight:700;padding:0 20px 24px;color:#4f8ef7}.nav{list-style:none;flex:1;padding:0;margin:0}.nav a{display:block;padding:10px 20px;color:#7a839e;text-decoration:none;font-size:.85rem;font-weight:500;border-left:3px solid transparent;transition:all .15s;cursor:pointer;user-select:none}.nav a:hover{color:#e8ecf4;background:rgba(255,255,255,.04)}.nav a.active{color:#4f8ef7;border-left-color:#4f8ef7;background:rgba(79,142,247,.08)}.footer{padding:16px 20px;border-top:1px solid #2e3450}.uname{font-size:.82rem;font-weight:600;display:block;color:#e8ecf4}.urole{font-size:.65rem;color:#7a839e;text-transform:uppercase;display:block}button{margin-top:10px;background:none;border:1px solid #2e3450;color:#7a839e;border-radius:8px;padding:6px 12px;font-size:.75rem;cursor:pointer;width:100%;font-family:inherit}.content{flex:1;overflow-y:auto;background:#0d0f14}`]
})
export class LayoutComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  nav(path: string): void {
    this.router.navigate([path]);
  }
}