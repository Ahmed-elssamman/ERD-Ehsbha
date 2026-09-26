import { describe, expect, it } from 'vitest';
import { LocalTimeOccurrence, WorkSessionMutation } from '@ehsbha/shared-types';
import { workSessionCommand, workSessionDefaults } from './work-sessions.control';

describe('reviewed work-session times', () => {
  it('does not invent an interval for missed work', () => {
    const context = { action: WorkSessionMutation.Create, record: null };
    const defaults = workSessionDefaults(context);
    expect(defaults.startedAt).toBe(''); expect(defaults.endedAt).toBe('');
    expect(workSessionCommand(context, defaults)).toBeNull();
  });
  it('uses Cairo time independent of the device timezone', () => {
    const context = { action: WorkSessionMutation.Create, record: null };
    const fields = { ...workSessionDefaults(context), startedAt: '2026-09-15T11:00', endedAt: '2026-09-15T13:00' };
    expect(workSessionCommand(context, fields)).toEqual({ action: WorkSessionMutation.Create, startedAt: '2026-09-15T08:00:00.000Z', endedAt: '2026-09-15T10:00:00.000Z' });
    expect(workSessionCommand(context, { ...fields, endedAt: fields.startedAt })).toBeNull();
  });
  it('requires an explicit occurrence when Cairo repeats a clock time', () => {
    const context = { action: WorkSessionMutation.Create, record: null };
    const fields = { ...workSessionDefaults(context), startedAt: '2025-10-30T23:15', endedAt: '2025-10-31T01:00' };
    expect(workSessionCommand(context, fields)).toBeNull();
    expect(workSessionCommand(context, { ...fields, startedOccurrence: LocalTimeOccurrence.Earlier })).not.toBeNull();
  });
});
