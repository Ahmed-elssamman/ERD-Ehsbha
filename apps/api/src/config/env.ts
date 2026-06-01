import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(10),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  CORS_ORIGINS: z.string().default('*'),

  // SMTP — leave empty in dev to log the code to the console instead of
  // actually sending an email.
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

  // Azure AI Vision (OCR). Required.
  AZURE_VISION_ENDPOINT: z.string().url(),
  AZURE_VISION_KEY: z.string().min(20),
  AZURE_VISION_REGION: z.string().default('eastus'),

  // Document Intelligence is OPTIONAL. A single-service "Computer Vision"
  // resource does NOT include Document Intelligence — calls would 401.
  // To enable: either (a) provision a separate "Document Intelligence" resource
  // and set the endpoint/key explicitly below, or (b) re-create the AI resource
  // as a multi-service "Azure AI services" SKU and reuse AZURE_VISION_*.
  AZURE_DOC_INTELLIGENCE_ENABLED: z
    .union([z.boolean(), z.string()])
    .default(false)
    .transform((v) => (typeof v === 'string' ? v.toLowerCase() === 'true' : v)),
  AZURE_DOC_INTELLIGENCE_ENDPOINT: z.string().url().optional(),
  AZURE_DOC_INTELLIGENCE_KEY: z.string().min(20).optional(),
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
