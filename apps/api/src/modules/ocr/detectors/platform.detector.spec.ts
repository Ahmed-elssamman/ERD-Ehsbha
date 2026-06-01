import { PlatformDetector } from './platform.detector';
import { SemanticNormalizer } from '../semantic/normalizer';
import { FIXTURE as UBER_AR } from '../__fixtures__/uber-ar.txt';
import { FIXTURE as UBER_EN } from '../__fixtures__/uber-en.txt';
import { FIXTURE as INDRIVE_AR } from '../__fixtures__/indrive-ar.txt';
import { FIXTURE as INDRIVE_EN } from '../__fixtures__/indrive-en.txt';
import { FIXTURE as DIDI_AR } from '../__fixtures__/didi-ar.txt';
import { FIXTURE as CAREEM_AR } from '../__fixtures__/careem-ar.txt';
import { FIXTURE as CAREEM_EN } from '../__fixtures__/careem-en.txt';

describe('PlatformDetector', () => {
  const detector = new PlatformDetector(new SemanticNormalizer());

  it('detects Uber from Arabic fixture', () => {
    const r = detector.detect([UBER_AR]);
    expect(r.platform).toBe('UBER');
    expect(r.confidence).toBeGreaterThan(0);
  });

  it('detects Uber from English fixture', () => {
    const r = detector.detect([UBER_EN]);
    expect(r.platform).toBe('UBER');
  });

  it('detects inDrive (ar)', () => {
    expect(detector.detect([INDRIVE_AR]).platform).toBe('INDRIVE');
  });

  it('detects inDrive (en)', () => {
    expect(detector.detect([INDRIVE_EN]).platform).toBe('INDRIVE');
  });

  it('detects DiDi', () => {
    expect(detector.detect([DIDI_AR]).platform).toBe('DIDI');
  });

  it('detects Careem (ar)', () => {
    expect(detector.detect([CAREEM_AR]).platform).toBe('CAREEM');
  });

  it('detects Careem (en)', () => {
    expect(detector.detect([CAREEM_EN]).platform).toBe('CAREEM');
  });

  it('returns null for garbage text', () => {
    const r = detector.detect(['random unrelated text with no brand markers']);
    expect(r.platform).toBeNull();
    expect(r.confidence).toBe(0);
  });
});
