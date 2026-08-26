export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'DELETED';

export type DocumentType = 'DNI' | 'CE' | 'PASSPORT';

export type Gender = 'FEMALE' | 'MALE' | 'OTHER' | 'NOT_SPECIFIED';

export interface UserProfileResponse {
  publicId: string;
  email: string;
  role: string;
  status: UserStatus;
  photoUrl: string | null;
  personPublicId: string;
  documentType: DocumentType;
  documentNumber: string;
  firstNames: string;
  lastNames: string;
  /** LocalDate del backend: se serializa como 'YYYY-MM-DD'. */
  birthDate: string | null;
  gender: Gender | null;
  address: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}
