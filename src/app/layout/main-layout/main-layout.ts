import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BottomNav } from '../components/bottom-nav/bottom-nav';
import { Sidebar } from '../components/sidebar/sidebar';
import { Topbar } from '../components/topbar/topbar';

/**
 * Shell autenticado. En escritorio replica el layout de las maquetas
 * (alto fijo, sidebar + topbar, scroll interno en `.content`).
 * Por debajo de 1024px el sidebar se oculta y navega el bottom nav.
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Sidebar, Topbar, BottomNav],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {}
