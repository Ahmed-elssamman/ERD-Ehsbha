import { businessDateKey, businessHour } from '@ehsbha/shared-types';
import { z } from 'zod';

export enum ReminderKind { Water = 'water', Break = 'break', Move = 'move', Hours = 'hours', Awareness = 'awareness' }
export enum ChecklistAnswer { Unrecorded = 'unrecorded', Done = 'done', Skipped = 'skipped' }
export enum WellnessAction { Complete = 'complete', Snooze = 'snooze', Skip = 'skip', Disable = 'disable' }
export const REMINDERS = [
  { kind: ReminderKind.Water, minutes: 60 }, { kind: ReminderKind.Break, minutes: 120 },
  { kind: ReminderKind.Move, minutes: 60 }, { kind: ReminderKind.Hours, minutes: 480 },
  { kind: ReminderKind.Awareness, minutes: 120 },
];
export const FREQUENCIES = [30, 60, 90, 120, 180, 240, 360, 480, 600, 720];
export const ANSWERS = Object.values(ChecklistAnswer);
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
export const WELLNESS_POLL_MS = 30_000;
export const WELLNESS_SESSION_MS = 16 * 60 * 60_000;
export const WELLNESS_SOURCES = [
  { key: 'driving', href: 'https://www.gov.uk/guidance/the-highway-code/rules-for-drivers-and-motorcyclists-89-to-102' },
  { key: 'water', href: 'https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/' },
  { key: 'movement', href: 'https://www.nhs.uk/live-well/exercise/exercise-health-benefits/' },
];
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const reminderSchema = z.object({
  kind: z.nativeEnum(ReminderKind), enabled: z.boolean(), minutes: z.number().int().min(30).max(720),
  dueAt: z.number().nonnegative().nullable(), skippedDate: daySchema.nullable(),
}).strict();
export const wellnessSchema = z.object({
  accountId: z.string().min(1), generation: z.string().uuid(), revision: z.number().int().nonnegative(),
  startedAt: z.number().nonnegative().nullable(), lastShownAt: z.number().nonnegative().nullable(),
  quietEnabled: z.boolean(), quietStart: z.number().int().min(0).max(23), quietEnd: z.number().int().min(0).max(23),
  reminders: z.array(reminderSchema).length(5).refine((items) => new Set(items.map((item) => item.kind)).size === 5),
  days: z.array(z.object({ date: daySchema, answers: z.record(z.nativeEnum(ReminderKind), z.nativeEnum(ChecklistAnswer)) }).strict()).max(7),
}).strict();
export interface ReminderSetting {
  kind: ReminderKind; enabled: boolean; minutes: number; dueAt: number | null; skippedDate: string | null;
}
export interface WellnessState {
  accountId: string; generation: string; revision: number; startedAt: number | null; lastShownAt: number | null;
  quietEnabled: boolean; quietStart: number; quietEnd: number; reminders: ReminderSetting[]; days: WellnessDay[];
}
export interface WellnessDay { date: string; answers: Partial<Record<ReminderKind, ChecklistAnswer>> }

export function freshWellness(accountId: string): WellnessState {
  return { accountId, generation: crypto.randomUUID(), revision: 0, startedAt: null, lastShownAt: null,
    quietEnabled: true, quietStart: 23, quietEnd: 7,
    reminders: REMINDERS.map((item) => ({ ...item, enabled: false, dueAt: null, skippedDate: null })), days: [] };
}
export function wellnessWeek(now: number): string[] {
  const today = businessDateKey(new Date(now));
  const anchor = Date.parse(`${today}T12:00:00Z`);
  return Array.from({ length: 7 }, (_, index) => new Date(anchor - (6 - index) * 86_400_000).toISOString().slice(0, 10));
}
export function normalizeWellness(state: WellnessState, now: number): WellnessState {
  const week = wellnessWeek(now);
  const expired = state.startedAt !== null && (now < state.startedAt || now - state.startedAt >= WELLNESS_SESSION_MS);
  return { ...state, days: state.days.filter((day) => week.includes(day.date)),
    startedAt: expired ? null : state.startedAt,
    reminders: state.reminders.map((item) => ({ ...item, dueAt: expired ? null : item.dueAt })) };
}
export function startWellness(state: WellnessState, now: number): WellnessState {
  return { ...state, startedAt: now, lastShownAt: null,
    reminders: state.reminders.map((item) => ({ ...item, dueAt: item.enabled ? now + item.minutes * 60_000 : null })) };
}
export function dueReminder(state: WellnessState, now: number): ReminderSetting | null {
  if (state.startedAt === null || now < state.startedAt || now - state.startedAt >= WELLNESS_SESSION_MS) return null;
  const hour = businessHour(new Date(now));
  if (state.quietEnabled) {
    const quiet = state.quietStart === state.quietEnd || (state.quietStart < state.quietEnd
      ? hour >= state.quietStart && hour < state.quietEnd : hour >= state.quietStart || hour < state.quietEnd);
    if (quiet) return null;
  }
  if (state.lastShownAt !== null && now - state.lastShownAt < 5 * 60_000) return null;
  const today = businessDateKey(new Date(now));
  return state.reminders.filter((item) => item.enabled && item.skippedDate !== today && item.dueAt !== null && item.dueAt <= now)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))[0] ?? null;
}
export function answerChecklist(state: WellnessState, kind: ReminderKind, answer: ChecklistAnswer, now: number): WellnessState {
  const date = businessDateKey(new Date(now));
  const day = state.days.find((item) => item.date === date) ?? { date, answers: {} };
  return normalizeWellness({ ...state, days: [...state.days.filter((item) => item.date !== date), { ...day, answers: { ...day.answers, [kind]: answer } }] }, now);
}
export function actOnReminder(state: WellnessState, kind: ReminderKind, action: WellnessAction, now: number): WellnessState {
  const date = businessDateKey(new Date(now));
  return { ...state, reminders: state.reminders.map((item) => item.kind !== kind ? item : {
    ...item, enabled: action === WellnessAction.Disable ? false : item.enabled,
    skippedDate: action === WellnessAction.Skip ? date : item.skippedDate,
    dueAt: now + (action === WellnessAction.Snooze ? 15 : item.minutes) * 60_000,
  }) };
}
