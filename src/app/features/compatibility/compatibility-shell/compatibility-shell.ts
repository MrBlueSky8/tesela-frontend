import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { CompanyContextService } from '../../../core/services/company-context-service';

/**
 * Modulo 1: cabecera con la empresa de trabajo y pestanias hacia postulantes
 * y puestos. El evaluador consulta el catalogo de puestos desde aqui, sin
 * entrar a la gestion de la empresa.
 */
@Component({
  selector: 'app-compatibility-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './compatibility-shell.html',
  styleUrl: './compatibility-shell.scss',
})
export class CompatibilityShell {
  private readonly companyContext = inject(CompanyContextService);

  readonly company = this.companyContext.company;
}
