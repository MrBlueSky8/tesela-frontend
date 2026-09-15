import { Injectable, computed, signal } from '@angular/core';

import { GlobalRole } from '../models/sidebar-item';

type StorageType = 'local' | 'session';

const GLOBAL_ROLES: readonly GlobalRole[] = ['ADMIN_PLATAFORMA', 'USUARIO'];

/**
 * Claims que emite TeselaBackend en el access token
 * (auth/security/JwtService#generateAccessToken).
 */
interface AccessTokenPayload {
  sub?: string;
  authorities?: string[];
  userPublicId?: string;
  tokenVersion?: number;
  /** true mientras la cuenta use una contrasena temporal emitida por la plataforma. */
  mustChangePassword?: boolean;
  exp?: number;
}

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private readonly STORAGE_MODE_KEY = 'auth_storage_mode';

  /** Contador interno para reevaluar los computed al cambiar la sesion. */
  private readonly sessionTick = signal(0);

  readonly username = computed(() => {
    this.sessionTick();
    return this.readUsernameFromToken();
  });

  readonly role = computed<GlobalRole | null>(() => {
    this.sessionTick();
    return this.readRoleFromToken();
  });

  readonly userPublicId = computed(() => {
    this.sessionTick();
    return this.getAccessTokenPayload()?.userPublicId ?? null;
  });

  readonly mustChangePassword = computed(() => {
    this.sessionTick();
    return this.getAccessTokenPayload()?.mustChangePassword === true;
  });

  setTokens(accessToken: string, refreshToken: string, rememberMe = true): void {
    if (!accessToken || !refreshToken) {
      throw new Error('Access token o refresh token invalidos.');
    }

    this.clearTokens();

    const mode: StorageType = rememberMe ? 'local' : 'session';
    const storage = this.getStorage(mode);

    localStorage.setItem(this.STORAGE_MODE_KEY, mode);
    storage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
    storage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);

    this.bumpSessionTick();
  }

  getAccessToken(): string | null {
    return this.getFallbackToken(this.ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return this.getFallbackToken(this.REFRESH_TOKEN_KEY);
  }

  /** true si la sesion se guardo con "recordarme". */
  isPersistentSession(): boolean {
    return localStorage.getItem(this.STORAGE_MODE_KEY) !== 'session';
  }

  clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(this.ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.STORAGE_MODE_KEY);

    this.bumpSessionTick();
  }

  hasSession(): boolean {
    return this.isUsableToken(this.getAccessToken());
  }

  hasRefreshSession(): boolean {
    return this.isUsableToken(this.getRefreshToken());
  }

  getAccessTokenPayload(): AccessTokenPayload | null {
    return this.decodeToken<AccessTokenPayload>(this.getAccessToken());
  }

  getUsername(): string | null {
    return this.readUsernameFromToken();
  }

  getRole(): GlobalRole | null {
    return this.readRoleFromToken();
  }

  isAccessTokenExpired(): boolean {
    return this.isTokenExpired(this.getAccessToken());
  }

  isRefreshTokenExpired(): boolean {
    return this.isTokenExpired(this.getRefreshToken());
  }

  private getStorage(mode?: StorageType): Storage {
    const resolvedMode =
      mode ?? (localStorage.getItem(this.STORAGE_MODE_KEY) as StorageType | null) ?? 'local';

    return resolvedMode === 'session' ? sessionStorage : localStorage;
  }

  private getFallbackToken(key: string): string | null {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  }

  private isUsableToken(token: string | null): boolean {
    return !!token && token !== 'undefined' && token !== 'null';
  }

  private readUsernameFromToken(): string | null {
    return this.getAccessTokenPayload()?.sub ?? null;
  }

  /**
   * TeselaBackend firma un unico rol global por usuario dentro del claim
   * `authorities`, asi que tomamos el primero reconocido.
   */
  private readRoleFromToken(): GlobalRole | null {
    const authorities = this.getAccessTokenPayload()?.authorities ?? [];

    return (
      authorities.find((authority): authority is GlobalRole =>
        GLOBAL_ROLES.includes(authority as GlobalRole),
      ) ?? null
    );
  }

  private bumpSessionTick(): void {
    this.sessionTick.update((value) => value + 1);
  }

  private isTokenExpired(token: string | null): boolean {
    if (!this.isUsableToken(token)) {
      return true;
    }

    const payload = this.decodeToken<{ exp?: number }>(token);

    if (!payload?.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    return now >= payload.exp;
  }

  private decodeToken<T>(token: string | null): T | null {
    if (!token) {
      return null;
    }

    try {
      const parts = token.split('.');

      if (parts.length !== 3) {
        return null;
      }

      const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        '=',
      );

      return JSON.parse(atob(padded)) as T;
    } catch {
      return null;
    }
  }
}
