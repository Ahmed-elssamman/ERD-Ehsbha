import { isPrismaConnectivityError, summarizePrismaConnectivityError } from './prisma-errors';

describe('prisma connectivity helpers', () => {
  it('detects unreachable database messages', () => {
    const error = new Error(
      "Can't reach database server at `ep-noisy-butterfly-apzsufbp-pooler.c-7.us-east-1.aws.neon.tech:5432`",
    );

    expect(isPrismaConnectivityError(error)).toBe(true);
  });

  it('detects closed connection messages', () => {
    expect(isPrismaConnectivityError(new Error('Server has closed the connection.'))).toBe(true);
  });

  it('redacts connection targets from summaries', () => {
    const summary = summarizePrismaConnectivityError(
      new Error(
        "Can't reach database server at `ep-noisy-butterfly-apzsufbp-pooler.c-7.us-east-1.aws.neon.tech:5432`",
      ),
    );

    expect(summary).toContain("Can't reach database server");
    expect(summary).toContain('`<redacted>`');
    expect(summary).not.toContain('ep-noisy-butterfly');
  });
});
