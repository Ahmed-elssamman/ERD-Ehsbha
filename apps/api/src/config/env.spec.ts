import { TokenDurationSchema } from './env';

describe('Token duration configuration', () => {
  it.each(['15m', '30d', '8h', '60s'])('accepts the supported duration %s', (duration) => {
    expect(TokenDurationSchema.safeParse(duration).success).toBe(true);
  });

  it.each(['', '0m', '-1h', '15 minutes', '900', 'invalid'])('rejects %s instead of defaulting access to a long lifetime', (duration) => {
    expect(TokenDurationSchema.safeParse(duration).success).toBe(false);
  });
});
