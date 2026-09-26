import { z } from 'zod';
import {
  driverLoginSchema,
  driverRefreshSchema,
  passwordResetSchema,
} from '@ehsbha/api-contracts';

const phoneRegex = /^\+?\d{8,15}$/;

// --- Shared contract re-exports (source of truth lives in @ehsbha/api-contracts) ---

/** Driver login: phone + password (from shared contract) + local device tracking. */
export const LoginSchema = driverLoginSchema.extend({
  deviceId: z.string().max(128).optional(),
});
export type LoginDto = z.infer<typeof LoginSchema>;

/** Token refresh. */
export const RefreshSchema = driverRefreshSchema;
export type RefreshDto = z.infer<typeof RefreshSchema>;

/** Password reset: phone + OTP code + new password. */
export const ResetPasswordSchema = passwordResetSchema;
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;

// --- Local schemas (not yet in shared contracts) ---

export const RegisterSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(80),
  locale: z.enum(['ar', 'en']).default('ar'),
  timezone: z.string().default('Africa/Cairo'),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LogoutSchema = z.object({
  refreshToken: z.string().min(20),
});
export type LogoutDto = z.infer<typeof LogoutSchema>;

// Forgot password: phone identifies the user; the OTP is delivered to the
// email already on file. The client never picks the destination email.
export const ForgotPasswordSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
});
export type ForgotPasswordDto = z.infer<typeof ForgotPasswordSchema>;

// Lookup the email registered to a phone, returned masked so the UI can show
// a "we'll send the code to m***@gmail.com" preview before sending the OTP.
export const LookupEmailSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
});
export type LookupEmailDto = z.infer<typeof LookupEmailSchema>;
