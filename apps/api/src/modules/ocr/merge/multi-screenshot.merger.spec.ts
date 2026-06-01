import { MultiScreenshotMerger } from './multi-screenshot.merger';
import { RawParsed } from '../parsers/base.parser';

describe('MultiScreenshotMerger', () => {
  const merger = new MultiScreenshotMerger();

  const make = (overrides: Partial<RawParsed>): RawParsed => ({
    fields: {},
    perField: {},
    warnings: [],
    ...overrides,
  });

  it('returns single parsed unchanged', () => {
    const r = merger.merge([make({ fields: { grossEgp: 27.04 }, perField: { grossEgp: 0.8 } })]);
    expect(r.parsed.grossEgp).toBe(27.04);
  });

  it('picks higher-confidence numeric value', () => {
    const r = merger.merge([
      make({ fields: { grossEgp: 27.04 }, perField: { grossEgp: 0.6 } }),
      make({ fields: { grossEgp: 27.50 }, perField: { grossEgp: 0.9 } }),
    ]);
    expect(r.parsed.grossEgp).toBe(27.5);
  });

  it('boosts confidence when values agree within 2%', () => {
    const r = merger.merge([
      make({ fields: { grossEgp: 27.0 }, perField: { grossEgp: 0.7 } }),
      make({ fields: { grossEgp: 27.1 }, perField: { grossEgp: 0.6 } }),
    ]);
    expect(r.perField.grossEgp).toBeGreaterThan(0.7);
  });

  it('emits conflict warning when values diverge >10%', () => {
    const r = merger.merge([
      make({ fields: { grossEgp: 27.0 }, perField: { grossEgp: 0.7 } }),
      make({ fields: { grossEgp: 50.0 }, perField: { grossEgp: 0.6 } }),
    ]);
    expect(r.warnings).toContain('OCR_VALUE_CONFLICT_grossEgp');
  });

  it('keeps earliest startedAt and latest endedAt', () => {
    const r = merger.merge([
      make({
        fields: { startedAt: '2026-05-18T22:46:00.000Z', endedAt: '2026-05-18T22:57:00.000Z' },
        perField: { startedAt: 0.7, endedAt: 0.7 },
      }),
      make({
        fields: { startedAt: '2026-05-18T22:40:00.000Z', endedAt: '2026-05-18T23:05:00.000Z' },
        perField: { startedAt: 0.7, endedAt: 0.7 },
      }),
    ]);
    expect(r.parsed.startedAt).toBe('2026-05-18T22:40:00.000Z');
    expect(r.parsed.endedAt).toBe('2026-05-18T23:05:00.000Z');
  });

  it('payment method majority vote', () => {
    const r = merger.merge([
      make({ fields: { paymentMethod: 'cash' } }),
      make({ fields: { paymentMethod: 'cash' } }),
      make({ fields: { paymentMethod: 'card' } }),
    ]);
    expect(r.parsed.paymentMethod).toBe('cash');
  });

  it('payment method tie → unknown', () => {
    const r = merger.merge([
      make({ fields: { paymentMethod: 'cash' } }),
      make({ fields: { paymentMethod: 'card' } }),
    ]);
    expect(r.parsed.paymentMethod).toBe('unknown');
  });

  it('concatenates distinct notes', () => {
    const r = merger.merge([
      make({ fields: { notes: 'A' } }),
      make({ fields: { notes: 'B' } }),
      make({ fields: { notes: 'A' } }),
    ]);
    expect(r.parsed.notes).toBe('A\nB');
  });

  it('prefers longest string with highest confidence', () => {
    const r = merger.merge([
      make({ fields: { pickup: 'Nasr City' }, perField: { pickup: 0.5 } }),
      make({ fields: { pickup: 'Nasr City 4455020 EG' }, perField: { pickup: 0.7 } }),
    ]);
    expect(r.parsed.pickup).toBe('Nasr City 4455020 EG');
  });
});
