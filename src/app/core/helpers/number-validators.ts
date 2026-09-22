import { AbstractControl, ValidationErrors } from '@angular/forms';

/**
 * Solo enteros. Un input numerico acepta "2,5" y el backend lo truncaria sin
 * avisar; asi el usuario ve el error antes de guardar. Vacio es valido: de
 * eso se encarga `Validators.required` cuando el campo es obligatorio.
 */
export function integerValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  if (value === null || value === undefined || value === '') {
    return null;
  }

  return Number.isInteger(Number(value)) ? null : { integer: true };
}
