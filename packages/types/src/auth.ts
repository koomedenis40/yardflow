import type { UserTenantRole } from './enums';

/** JWT access-token claims (PERMISSION_MATRIX Sec 8). */
export interface JwtPayload {
  sub: string;
  tenantId?: string;
  tenantSlug?: string;
  role?: UserTenantRole;
  permissions: string[];
  isPlatformAdmin: boolean;
}

/** Authenticated request user attached by JwtStrategy. */
export interface AuthUser {
  userId: string;
  tenantId?: string;
  tenantSlug?: string;
  role?: UserTenantRole;
  permissions: string[];
  isPlatformAdmin: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface AuthMeResponse {
  userId: string;
  fullName: string;
  email: string | null;
  tenantId?: string;
  tenantSlug?: string;
  role?: UserTenantRole;
  permissions: string[];
  isPlatformAdmin: boolean;
}
