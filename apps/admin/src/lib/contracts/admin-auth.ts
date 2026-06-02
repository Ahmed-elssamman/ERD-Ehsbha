import { z } from 'zod';

export const AdminLoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;

export const AdminLoginResponseSchema = z.union([
  z.object({
    mfaRequired: z.literal(false),
    accessToken: z.string(),
    refreshToken: z.string(),
    admin: z.object({
      id: z.string(),
      email: z.string(),
      displayName: z.string(),
      roles: z.array(z.string()),
      permissions: z.array(z.string()),
    }),
  }),
  z.object({
    mfaRequired: z.literal(true),
    challengeId: z.string(),
  }),
]);
export type AdminLoginResponse = z.infer<typeof AdminLoginResponseSchema>;

export const AdminMfaVerifyRequestSchema = z.object({
  challengeId: z.string(),
  code: z.string().regex(/^\d{6}$/),
});
export type AdminMfaVerifyRequest = z.infer<typeof AdminMfaVerifyRequestSchema>;

export const AdminRefreshRequestSchema = z.object({
  refreshToken: z.string(),
});
export type AdminRefreshRequest = z.infer<typeof AdminRefreshRequestSchema>;

export const AdminAuthErrorCodes = [
  'ADMIN_UNAUTHENTICATED',
  'ADMIN_FORBIDDEN',
  'ADMIN_MFA_REQUIRED',
  'ADMIN_PERMISSIONS_STALE',
  'ADMIN_INVALID_CREDENTIALS',
  'ADMIN_ACCOUNT_DISABLED',
  'ADMIN_RATE_LIMITED',
  'ADMIN_INVALID_MFA_CODE',
] as const;
export type AdminAuthErrorCode = (typeof AdminAuthErrorCodes)[number];
