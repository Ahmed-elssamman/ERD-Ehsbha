import { z } from 'zod';

const phoneRegex = /^\+?\d{8,15}$/;

export const RegisterSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(80),
  locale: z.enum(['ar', 'en']).default('ar'),
  timezone: z.string().default('Africa/Cairo'),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  phone: z.string().regex(phoneRegex),
  password: z.string().min(1).max(128),
  deviceId: z.string().max(128).optional(),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.string().min(20),
});
export type RefreshDto = z.infer<typeof RefreshSchema>;

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

// Reset password: phone identifies the user, plus the OTP code and new password.
export const ResetPasswordSchema = z.object({
  phone: z.string().regex(phoneRegex, 'Invalid phone number'),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
  newPassword: z.string().min(8).max(128),
});
export type ResetPasswordDto = z.infer<typeof ResetPasswordSchema>;
