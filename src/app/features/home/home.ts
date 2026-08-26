import { Component, computed, inject } from '@angular/core';

import { TokenService } from '../../core/services/token-service';

const ROLE_LABELS: Record<string, string> = {
  ADMIN_PLATAFORMA: 'Administrador de plataforma',
  USUARIO: 'Usuario',
};

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  private readonly tokenService = inject(TokenService);

  readonly username = computed(() => this.tokenService.username() ?? 'Usuario');

  readonly roleLabel = computed(() => {
    const role = this.tokenService.role();
    return role ? (ROLE_LABELS[role] ?? role) : 'Sin rol global';
  });

  readonly userPublicId = this.tokenService.userPublicId;
}
