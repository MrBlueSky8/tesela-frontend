export interface LoginRequest {
  /** El backend espera `email`, no `username`. */
  email: string;
  password: string;
}
