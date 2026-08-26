import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { BottomNav } from '../components/bottom-nav/bottom-nav';
import { Sidebar } from '../components/sidebar/sidebar';

/**
 * Shell autenticado: sidebar en escritorio, bottom nav en movil.
 * El topbar del proyecto modelo queda pendiente.
 */
@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Sidebar, BottomNav],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
})
export class MainLayout {}
