import { randomInt } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { driverAuthResultSchema, tripsListResponseSchema, dailyAnalyticsSchema, driverExpenseSchema } from '@ehsbha/api-contracts';

test.use({ timezoneId: 'UTC', viewport: { width: 360, height: 800 } });

test('Cairo midnight, expense entry and repeated-hour edits remain correct on a UTC device', async ({ page, request }) => {
  const base = 'http://127.0.0.1:55443/api/v1';
  const phone = `010${randomInt(10000000, 99999999)}`;
  const password = `calendar-test-${randomInt(10000000, 99999999)}`;
  const registration = await request.post(`${base}/auth/register`, { data: {
    phone: `+2${phone}`, email: `${phone}@example.test`, password, displayName: 'Calendar journey', locale: 'en', timezone: 'Africa/Cairo',
  } });
  expect(registration.status()).toBe(201);
  const auth = z.object({ data: driverAuthResultSchema }).parse(await registration.json()).data;
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  expect((await request.post(`${base}/vehicles`, { headers, data: { type: 'CAR', fuelType: 'PETROL_92' } })).status()).toBe(201);
  expect((await request.post(`${base}/drivers/me/apps`, { headers, data: { customName: 'Calendar app', commissionPct: 0 } })).status()).toBe(201);
  await page.addInitScript(() => localStorage.setItem('ehsbha.locale', 'en'));
  await page.goto('/login');
  await page.locator('#phone').fill(phone);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto('/trips/new');
  await page.locator('#incomeMode').selectOption('take_home');
  await page.locator('#earningsEgp').fill('80');
  await page.locator('#totalKm').fill('10');
  await page.locator('#paidKm').fill('8');
  await page.locator('#startedAt').fill('2026-04-24T00:30');
  await page.locator('#endedAt').fill('2026-04-24T01:30');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Enter a valid Cairo time.', { exact: false }).first()).toBeVisible();
  await page.locator('#startedAt').fill('2026-09-30T23:50');
  await page.locator('#endedAt').fill('2026-10-01T00:20');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/trips\/(?!new)[^/]+$/);
  let response = await request.get(`${base}/trips`, { headers });
  let items = z.object({ data: tripsListResponseSchema }).parse(await response.json()).data.items;
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ startedAt: '2026-09-30T20:50:00.000Z', endedAt: '2026-09-30T21:20:00.000Z' });
  const beforeMidnight = await request.get(`${base}/analytics/daily?date=2026-09-30`, { headers });
  expect(z.object({ data: dailyAnalyticsSchema }).parse(await beforeMidnight.json()).data).toMatchObject({ tripCount: 1, netProfitPiastres: 8000, onlineMinutes: 10 });
  const afterMidnight = await request.get(`${base}/analytics/daily?date=2026-10-01`, { headers });
  expect(z.object({ data: dailyAnalyticsSchema }).parse(await afterMidnight.json()).data).toMatchObject({ tripCount: 0, netProfitPiastres: 0, onlineMinutes: 20 });

  await page.goto('/expenses');
  await page.getByRole('button', { name: 'Add expense', exact: true }).first().click();
  const expenseDialog = page.getByRole('dialog');
  await expenseDialog.locator('#category').selectOption('PHONE');
  await expenseDialog.locator('#amountEgp').fill('20');
  await expenseDialog.locator('#dateTime').fill('2026-10-01T00:10');
  const expenseSaved = page.waitForResponse((res) => res.url().endsWith('/api/v1/expenses') && res.request().method() === 'POST');
  await expenseDialog.getByRole('button', { name: 'Save', exact: true }).click();
  const expense = await expenseSaved;
  expect(expense.status()).toBe(201);
  expect(z.object({ data: driverExpenseSchema }).parse(await expense.json()).data.dateTime).toBe('2026-09-30T21:10:00.000Z');
  const withExpense = await request.get(`${base}/analytics/daily?date=2026-10-01`, { headers });
  expect(z.object({ data: dailyAnalyticsSchema }).parse(await withExpense.json()).data.netProfitPiastres).toBe(-2000);

  await page.goto('/trips/new');
  await page.locator('#incomeMode').selectOption('take_home');
  await page.locator('#earningsEgp').fill('80');
  await page.locator('#totalKm').fill('10');
  await page.locator('#paidKm').fill('8');
  await page.locator('#startedAt').fill('2026-10-29T23:50');
  await page.locator('#endedAt').fill('2026-10-29T23:10');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/trips\/new$/);
  await page.getByRole('combobox', { name: /Start.*Clock change/i }).selectOption('earlier');
  await page.getByRole('combobox', { name: /End.*Clock change/i }).selectOption('later');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#notes').fill('Preserve recorded occurrence');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  response = await request.get(`${base}/trips`, { headers });
  items = z.object({ data: tripsListResponseSchema }).parse(await response.json()).data.items;
  expect(items.find((item) => item.notes === 'Preserve recorded occurrence')).toMatchObject({
    startedAt: '2026-10-29T20:50:00.000Z', endedAt: '2026-10-29T21:10:00.000Z',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
