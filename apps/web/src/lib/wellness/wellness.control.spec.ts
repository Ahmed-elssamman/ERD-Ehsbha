import { describe, expect, it } from 'vitest';
import { actOnReminder, answerChecklist, ChecklistAnswer, dueReminder, freshWellness, normalizeWellness, ReminderKind, startWellness, WellnessAction, wellnessWeek } from './wellness.control';

const noon = Date.parse('2026-09-17T09:00:00Z');
function enabled() {
  const state = freshWellness('driver');
  state.quietEnabled = false;
  state.reminders[0].enabled = true;
  return startWellness(state, noon);
}
describe('wellness scheduling and checklist', () => {
  it('starts disabled and does not create checklist answers from a timer or dismissal', () => {
    expect(dueReminder(startWellness(freshWellness('driver'), noon), noon + 4 * 3600000)).toBeNull();
    expect(actOnReminder(enabled(), ReminderKind.Water, WellnessAction.Complete, noon).days).toEqual([]);
  });
  it('uses a due instant, resumes without replaying missed occurrences, and spaces alerts', () => {
    const state = enabled();
    expect(dueReminder(state, noon + 3599999)).toBeNull();
    expect(dueReminder(state, noon + 3 * 3600000)?.kind).toBe(ReminderKind.Water);
    expect(dueReminder({ ...state, lastShownAt: noon + 3 * 3600000 }, noon + 3 * 3600000 + 299999)).toBeNull();
  });
  it('snoozes for fifteen minutes, skips Cairo today and allows tomorrow', () => {
    const state = actOnReminder(enabled(), ReminderKind.Water, WellnessAction.Snooze, noon);
    expect(dueReminder(state, noon + 899999)).toBeNull();
    expect(dueReminder(state, noon + 900000)?.kind).toBe(ReminderKind.Water);
    const skipped = actOnReminder(state, ReminderKind.Water, WellnessAction.Skip, noon);
    expect(dueReminder(skipped, Date.parse('2026-09-17T20:59:59Z'))).toBeNull();
    expect(dueReminder(skipped, Date.parse('2026-09-17T21:00:00Z'))?.kind).toBe(ReminderKind.Water);
  });
  it('handles cross-midnight quiet hours, all-day quiet, disabled and expired timers', () => {
    const state = { ...enabled(), quietEnabled: true };
    expect(dueReminder(state, Date.parse('2026-09-17T20:00:00Z'))).toBeNull();
    expect(dueReminder({ ...state, quietStart: 12, quietEnd: 12 }, noon + 3600000)).toBeNull();
    expect(dueReminder(actOnReminder(state, ReminderKind.Water, WellnessAction.Disable, noon), noon + 3600000)).toBeNull();
    expect(normalizeWellness(state, noon + 16 * 3600000).startedAt).toBeNull();
    expect(dueReminder(state, noon - 1)).toBeNull();
  });
  it('counts calendar days across DST and retains seven days without inventing answers', () => {
    expect(wellnessWeek(Date.parse('2026-10-30T23:00:00Z'))).toEqual(['2026-10-25','2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31']);
    let state = answerChecklist(freshWellness('driver'), ReminderKind.Break, ChecklistAnswer.Done, noon);
    state = answerChecklist(state, ReminderKind.Move, ChecklistAnswer.Skipped, noon);
    expect(state.days[0].answers).toEqual({ break: 'done', move: 'skipped' });
    expect(normalizeWellness(state, noon + 7 * 86400000).days).toEqual([]);
  });
});
