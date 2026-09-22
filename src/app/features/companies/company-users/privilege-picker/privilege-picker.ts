import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, model } from '@angular/core';

import {
  ADMIN_MANAGEMENT_PRIVILEGES,
  ADMINISTRATION_PRIVILEGES,
  MODULE_PRIVILEGES,
  PRIVILEGE_LABELS,
  isImpliedByAdminGeneral,
  isImpliedByAdminSede,
} from '../../../../core/helpers/privilege-labels';
import { CompanyPrivilege, CompanyPrivilegeResponse } from '../../../../core/models/company';

/**
 * Selector de privilegios de una membresia, compartido por agregar, crear y
 * editar. Refleja las reglas del backend para anticiparlas, no para aplicarlas:
 * el backend vuelve a validar todo.
 */
@Component({
  selector: 'app-privilege-picker',
  imports: [NgTemplateOutlet],
  templateUrl: './privilege-picker.html',
  styleUrl: './privilege-picker.scss',
})
export class PrivilegePicker {
  readonly catalog = input.required<CompanyPrivilegeResponse[]>();

  /** Lo marcado explicitamente. Lo implicito por Admin. general no se guarda aqui. */
  readonly selected = model.required<CompanyPrivilege[]>();

  /** Sin GESTIONAR_ADMINS no se puede dar ni quitar administracion general. */
  readonly canManageAdmins = input(false);
  readonly disabled = input(false);

  /** Aviso previo: el limite lo hace cumplir el backend. */
  readonly adminLimitReached = input(false);

  /** Prefijo de ids para que dos selectores no choquen en la misma pagina. */
  readonly idPrefix = input('privileges');

  labelOf(name: CompanyPrivilege): string {
    return PRIVILEGE_LABELS[name];
  }

  readonly modules = computed(() =>
    this.catalog().filter((privilege) => MODULE_PRIVILEGES.includes(privilege.name)),
  );

  readonly administration = computed(() =>
    this.catalog().filter((privilege) => ADMINISTRATION_PRIVILEGES.includes(privilege.name)),
  );

  readonly adminGeneral = computed(() => this.selected().includes('ADMIN_GENERAL'));

  /** Admin. general ya incluye Admin. de sede, asi que este tambien cuenta. */
  readonly adminSede = computed(
    () => this.adminGeneral() || this.selected().includes('ADMIN_SEDE'),
  );

  isImplied(name: CompanyPrivilege): boolean {
    return (
      (this.adminGeneral() && isImpliedByAdminGeneral(name)) ||
      (this.adminSede() && isImpliedByAdminSede(name))
    );
  }

  /** Quien lo incluye, para decirlo en la casilla bloqueada. */
  impliedBy(name: CompanyPrivilege): string | null {
    if (this.adminGeneral() && isImpliedByAdminGeneral(name)) {
      return 'Admin. general';
    }
    return this.adminSede() && isImpliedByAdminSede(name) ? 'Admin. de sede' : null;
  }

  isChecked(name: CompanyPrivilege): boolean {
    return this.selected().includes(name) || this.isImplied(name);
  }

  isLocked(name: CompanyPrivilege): boolean {
    return (
      this.disabled() ||
      this.isImplied(name) ||
      (ADMIN_MANAGEMENT_PRIVILEGES.includes(name) && !this.canManageAdmins())
    );
  }

  onToggle(name: CompanyPrivilege, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    // Al desmarcar Admin. general reaparece lo que estaba marcado antes: nunca se borro.
    this.selected.update((current) =>
      checked
        ? [...new Set([...current, name])]
        : current.filter((privilege) => privilege !== name),
    );
  }

  inputId(name: CompanyPrivilege): string {
    return `${this.idPrefix()}-${name}`;
  }
}
