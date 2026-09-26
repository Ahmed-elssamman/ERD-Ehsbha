import { randomInt, randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { z } from 'zod';
import { driverAuthResultSchema, driverVehicleSchema, maintenanceItemSchema, maintenancePageSchema, maintenanceRecordSchema, dailyAnalyticsSchema } from '@ehsbha/api-contracts';

const base = 'http://127.0.0.1:55443/api/v1';
test.use({ timezoneId: 'UTC', viewport: { width: 360, height: 800 } });
async function account(request: APIRequestContext) {
  const phone = `010${randomInt(10000000, 99999999)}`;
  const password = `maintenance-test-${randomUUID()}`;
  const response = await request.post(`${base}/auth/register`, { data: { phone: `+2${phone}`, email: `${phone}@example.test`, password,
    displayName: 'Maintenance journey', locale: 'en', timezone: 'Africa/Cairo' } });
  expect(response.status()).toBe(201);
  const auth = z.object({ data: driverAuthResultSchema }).parse(await response.json()).data;
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  const vehicleResponse = await request.post(`${base}/vehicles`, { headers, data: { type: 'CAR', fuelType: 'PETROL_92', odometerMeters: 1000000 } });
  const vehicle = z.object({ data: driverVehicleSchema }).parse(await vehicleResponse.json()).data;
  const itemsResponse = await request.get(`${base}/maintenance/items`, { headers });
  const item = z.object({ data: maintenanceItemSchema.array() }).parse(await itemsResponse.json()).data.find((row) => row.code === 'ENGINE_OIL');
  if (!item) throw new Error('Seeded engine oil item was not found');
  return { phone, password, headers, vehicle, item, path: `${base}/vehicles/${vehicle.id}/maintenance/records` };
}
async function login(page: Page, user: { phone: string; password: string }, locale: string) {
  await page.addInitScript((value) => localStorage.setItem('ehsbha.locale', value), locale);
  await page.goto('/login'); await page.locator('#phone').fill(user.phone); await page.locator('#password').fill(user.password);
  await page.locator('button[type=submit]').click(); await expect(page).not.toHaveURL(/\/login/); await page.goto('/maintenance');
}

test('service pages, explicit expense link, lost response retry and stale correction history', async ({ page, request }) => {
  test.setTimeout(90_000);
  const user = await account(request);
  for (let index = 0; index < 52; index++) {
    const response = await request.post(user.path, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() },
      data: { maintenanceItemId: user.item.id, performedAt: '2026-08-01T08:00:00Z', odometerMeters: 500000, costPiastres: 0 } });
    expect(response.status()).toBe(201);
  }
  const expense = await request.post(`${base}/expenses`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() },
    data: { category: 'OTHER', amountPiastres: 1234, dateTime: '2026-09-01T08:00:00Z', vehicleId: user.vehicle.id } });
  expect(expense.status()).toBe(201);
  await login(page, user, 'en');
  await expect(page.getByRole('button', { name: 'Edit service', exact: true })).toHaveCount(25);
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit service', exact: true })).toHaveCount(50);
  await page.getByRole('button', { name: 'Load more', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit service', exact: true })).toHaveCount(52);
  await page.getByRole('button', { name: 'Log maintenance', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('#odometerKm')).toHaveValue('1000');
  await dialog.locator('#maintenanceItemId').selectOption(user.item.id);
  await dialog.locator('#performedAt').fill('2026-08-31T23:30');
  await dialog.locator('#costEgp').fill('12.34');
  await dialog.getByRole('button', { name: 'Find matching expense', exact: true }).click();
  await dialog.getByRole('button', { name: /12\.34/ }).click();
  await expect(dialog.locator('#costEgp')).toHaveAttribute('readonly', '');
  let dropped = false;
  await page.route('**/maintenance/records', async (route) => {
    if (!dropped && route.request().method() === 'POST') {
      const response = await route.fetch(); expect(response.status()).toBe(201); dropped = true; await route.abort('failed');
    } else await route.continue();
  });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText('The save result is unconfirmed.', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const response = await request.get(user.path, { headers: user.headers });
  const record = z.object({ data: maintenancePageSchema }).parse(await response.json()).data.items[0];
  expect(record.linkedExpenseId).toBeTruthy(); expect(record.version).toBe(1);
  const day = await request.get(`${base}/analytics/daily?date=2026-08-31`, { headers: user.headers });
  expect(z.object({ data: dailyAnalyticsSchema }).parse(await day.json()).data).toMatchObject({ maintenancePiastres: 0, netProfitPiastres: 0 });
  await expect(page.getByRole('article', { name: 'Engine oil', exact: true }).first()).toContainText('12.34');
  await page.getByRole('button', { name: 'Edit service', exact: true }).first().click();
  await dialog.locator('#maintenance-notes').fill('My pending correction');
  const update = await request.patch(`${user.path}/${record.id}`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() }, data: { expectedVersion: record.version, notes: 'Newer private correction' } });
  expect(update.status()).toBe(200);
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('This service changed elsewhere');
  await expect(dialog.locator('#maintenance-notes')).toHaveValue('My pending correction');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Change history', exact: true }).first().click();
  await expect(dialog.getByText('Version 2', { exact: false })).toBeVisible();
  await expect(dialog.getByText('Newer private correction')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Arabic service records recover from load failure and support delete and restore at 320px', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const user = await account(request);
  const response = await request.post(user.path, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() },
    data: { maintenanceItemId: user.item.id, performedAt: '2026-09-01T08:00:00Z', odometerMeters: 1000000, costPiastres: 2500 } });
  expect(response.status()).toBe(201);
  let failList = true;
  await page.route('**/maintenance/records?**', async (route) => { if (failList) await route.abort('failed'); else await route.continue(); });
  await login(page, user, 'ar');
  await expect(page.getByText('تعذّر تحميل سجل الصيانة.', { exact: false })).toBeVisible({ timeout: 15000 });
  failList = false;
  await page.getByRole('button', { name: 'إعادة المحاولة', exact: true }).click();
  await page.getByRole('button', { name: 'حذف', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'حذف', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const deleted = await request.get(`${base}/analytics/daily?date=2026-09-01`, { headers: user.headers });
  expect(z.object({ data: dailyAnalyticsSchema }).parse(await deleted.json()).data.netProfitPiastres).toBe(0);
  await page.getByRole('button', { name: 'المحذوفة', exact: true }).click();
  await page.getByRole('button', { name: 'استعادة الصيانة', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'استعادة الصيانة', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'النشطة', exact: true }).click();
  await expect(page.getByRole('button', { name: 'تعديل الصيانة', exact: true })).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('service retry fingerprints bind the vehicle, record and deletion version', async ({ request }) => {
  const user = await account(request);
  const vehicleResponse = await request.post(`${base}/vehicles`, { headers: user.headers, data: { type: 'CAR', fuelType: 'PETROL_92' } });
  const second = z.object({ data: driverVehicleSchema }).parse(await vehicleResponse.json()).data;
  const headers = { ...user.headers, 'Idempotency-Key': randomUUID() };
  const data = { maintenanceItemId: user.item.id, performedAt: '2026-09-01T08:00:00Z', odometerMeters: 0, costPiastres: 0 };
  const created = await request.post(user.path, { headers, data });
  expect(created.status()).toBe(201);
  const record = z.object({ data: maintenanceRecordSchema }).parse(await created.json()).data;
  const replay = await request.post(user.path, { headers, data });
  expect(replay.headers()['idempotency-replayed']).toBe('true');
  expect((await request.post(`${base}/vehicles/${second.id}/maintenance/records`, { headers, data })).status()).toBe(409);
  const deleteHeaders = { ...user.headers, 'Idempotency-Key': randomUUID() };
  expect((await request.delete(`${user.path}/${record.id}?expectedVersion=1`, { headers: deleteHeaders })).status()).toBe(200);
  expect((await request.delete(`${user.path}/${record.id}?expectedVersion=1`, { headers: deleteHeaders })).headers()['idempotency-replayed']).toBe('true');
  expect((await request.delete(`${user.path}/${record.id}?expectedVersion=2`, { headers: deleteHeaders })).status()).toBe(409);
});
