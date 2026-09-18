import { Gender } from '../models/user-profile-response';

/** Espejo de user/entity/Gender, en el orden del enum. */
export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'MALE', label: 'Masculino' },
  { value: 'OTHER', label: 'Otro' },
  { value: 'NOT_SPECIFIED', label: 'Prefiero no decirlo' },
];
