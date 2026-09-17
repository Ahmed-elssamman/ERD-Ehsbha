type DatabaseEnv = {
  DATABASE_URL?: string;
  DIRECT_URL?: string;
};

export function resolvePrismaRuntimeUrl(env: DatabaseEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (databaseUrl) {
    return databaseUrl;
  }

  const directUrl = env.DIRECT_URL?.trim();
  if (directUrl) {
    return directUrl;
  }

  throw new Error('DATABASE_URL is required');
}

export function resolvePrismaCliUrl(env: DatabaseEnv = process.env): string {
  const directUrl = env.DIRECT_URL?.trim();
  if (directUrl) {
    return directUrl;
  }

  return resolvePrismaRuntimeUrl(env);
}

export function describePrismaRuntimeMode(env: DatabaseEnv = process.env): 'direct' | 'pooled' {
  return resolvePrismaRuntimeUrl(env).includes('-pooler.') ? 'pooled' : 'direct';
}
