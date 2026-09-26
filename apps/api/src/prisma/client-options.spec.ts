import { createPrismaClientOptions } from './client-options';

describe('PostgreSQL client transport', () => {
  it('uses the native PostgreSQL client for a local disposable database', () => {
    const url = 'postgresql://postgres@127.0.0.1:55439/ehsbha_test_transport';
    expect(createPrismaClientOptions(url)).toEqual({ datasources: { db: { url } } });
  });

  it('preserves the Neon adapter for managed pooled endpoints', () => {
    const options = createPrismaClientOptions('postgresql://test:test@ep-test-pooler.c-1.aws.neon.tech/test');
    expect(options.adapter?.adapterName).toBe('@prisma/adapter-neon');
  });

  it('uses the Neon adapter for direct endpoints too', () => {
    const options = createPrismaClientOptions('postgresql://test:test@ep-test.c-1.aws.neon.tech/test');
    expect(options.adapter?.adapterName).toBe('@prisma/adapter-neon');
  });

  it('does not identify another host by a Neon-like substring', () => {
    const url = 'postgresql://test:test@neon.tech.example.org/test';
    expect(createPrismaClientOptions(url)).toEqual({ datasources: { db: { url } } });
  });
});
