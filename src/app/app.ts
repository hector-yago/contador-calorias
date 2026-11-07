import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <router-outlet />
    <nav class="nav">
      <a routerLink="/diario" routerLinkActive="on">📖<span>Diario</span></a>
      <a routerLink="/resumen" routerLinkActive="on">📊<span>Resumen</span></a>
      <a routerLink="/perfil" routerLinkActive="on">👤<span>Perfil</span></a>
    </nav>
  `,
  styles: `
    .nav {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10;
      display: flex;
      background: var(--card);
      border-top: 1px solid var(--line);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .nav a {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px 0;
      font-size: 1.25rem;
      text-decoration: none;
      color: var(--muted);
    }
    .nav a span {
      font-size: 0.72rem;
    }
    .nav a.on {
      color: var(--accent);
      font-weight: 600;
    }
  `,
})
export class App {}
