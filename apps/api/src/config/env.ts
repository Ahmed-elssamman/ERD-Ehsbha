import { z } from 'zod';

export const TokenDurationSchema = z.string().trim().regex(/^[1-9]\d*\s*[smhd]$/, 'Use a positive duration in s, m, h or d');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(10),
  DIRECT_URL: z.string().min(10).optional(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: TokenDurationSchema.default('15m'),
  JWT_REFRESH_TTL: TokenDurationSchema.default('30d'),

  // Admin platform JWT realm (completely separate from driver auth above).
  // Must be different secrets — token-confusion impossibility relies on this.
  ADMIN_JWT_ACCESS_SECRET: z.string().min(32),
  ADMIN_JWT_REFRESH_SECRET: z.string().min(32),
  ADMIN_JWT_ACCESS_TTL: TokenDurationSchema.default('15m'),
  ADMIN_JWT_REFRESH_TTL: TokenDurationSchema.default('8h'),

  CORS_ORIGINS: z.string().default('*'),

  // SMTP is required for password recovery outside isolated tests.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : v)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Ehsbha <noreply@ehsebha.modev.me>'),
  SMTP_REPLY_TO: z.string().optional(),

  APP_PUBLIC_NAME: z.string().default('Ehsbha'),
  APP_PUBLIC_URL: z.string().default('https://ehsebha.modev.me'),

  // Optional at startup; extraction fails with OCR_AUTH until configured.
  GEMINI_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL: z.string().trim().min(1).default('gemini-3.5-flash'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function loadEnv(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

// Test-only: reset the memoized env so tests can swap process.env between cases.
export function resetEnvForTests(): void {
  cached = null;
}
