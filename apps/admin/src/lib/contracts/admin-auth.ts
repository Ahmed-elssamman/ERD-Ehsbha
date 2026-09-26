import { z } from 'zod';
import {
  adminLoginSchema,
  adminLoginResponseSchema,
  adminMfaVerifySchema,
  adminRefreshSchema,
} from '@ehsbha/api-contracts';

// Shared admin login request schema (source of truth in @ehsbha/api-contracts)
export { adminLoginSchema as AdminLoginRequestSchema };
export type AdminLoginRequest = z.infer<typeof adminLoginSchema>;

export const AdminLoginResponseSchema = adminLoginResponseSchema;
export type AdminLoginResponse = z.infer<typeof AdminLoginResponseSchema>;

export const AdminMfaVerifyRequestSchema = adminMfaVerifySchema;
export type AdminMfaVerifyRequest = z.infer<typeof AdminMfaVerifyRequestSchema>;

export const AdminRefreshRequestSchema = adminRefreshSchema;
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
