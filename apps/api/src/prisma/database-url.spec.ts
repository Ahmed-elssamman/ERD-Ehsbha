import {
  describePrismaRuntimeMode,
  resolvePrismaCliUrl,
  resolvePrismaRuntimeUrl,
} from './database-url';

describe('database-url', () => {
  it('uses DATABASE_URL for runtime connections', () => {
    const env = {
      DATABASE_URL: 'postgresql://runtime-pooler.example/db',
      DIRECT_URL: 'postgresql://direct.example/db',
    };

    expect(resolvePrismaRuntimeUrl(env)).toBe(env.DATABASE_URL);
    expect(describePrismaRuntimeMode(env)).toBe('pooled');
  });

  it('uses DIRECT_URL for CLI-style connections when available', () => {
    const env = {
      DATABASE_URL: 'postgresql://runtime-pooler.example/db',
      DIRECT_URL: 'postgresql://direct.example/db',
    };

    expect(resolvePrismaCliUrl(env)).toBe(env.DIRECT_URL);
  });

  it('falls back to DIRECT_URL when DATABASE_URL is absent', () => {
    const env = {
      DIRECT_URL: 'postgresql://direct.example/db',
    };

    expect(resolvePrismaRuntimeUrl(env)).toBe(env.DIRECT_URL);
    expect(describePrismaRuntimeMode(env)).toBe('direct');
  });
});
