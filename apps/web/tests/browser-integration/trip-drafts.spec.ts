import { randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext } from '@playwright/test';
import { z } from 'zod';
import { driverAppBindingSchema, tripItemSchema, tripHistorySchema, tripsListResponseSchema } from '@ehsbha/api-contracts';
import { draftAccount, draftApiBase as base, draftLogin } from './record-draft-fixtures';

test.use({ viewport: { width: 360, height: 800 }, timezoneId: 'America/Los_Angeles' });
async function account(request: APIRequestContext) {
  const user = await draftAccount(request);
  const response = await request.post(`${base}/drivers/me/apps`, { headers: user.headers, data: { customName: 'Manual trips', commissionPct: 0 } });
  expect(response.status()).toBe(201);
  const app = z.object({ data: driverAppBindingSchema }).parse(await response.json()).data;
  return { ...user, app };
}

test('manual trip: partial draft and a lost save response survive reload without duplicate income', async ({ page, request }) => {
  const user = await account(request); await draftLogin(page, user); await page.goto('/trips/new');
  await expect(page.locator('#vehicleId')).toHaveValue(user.vehicle.id);
  await expect(page.locator('#driverAppId')).toHaveValue(user.app.id);
  await expect(page.getByTestId('record-draft-notice')).toContainText('Changes will be kept on this device.');
  await page.goto('/trips'); await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
  await page.goto('/trips/new');
  await page.locator('#incomeMode').selectOption('take_home');
  await page.locator('#earningsEgp').fill('-12.345'); await page.locator('#notes').fill('My unfinished trip');
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  await page.reload();
  await expect(page.locator('#earningsEgp')).toHaveValue('-12.345'); await expect(page.locator('#notes')).toHaveValue('My unfinished trip');
  await page.locator('#earningsEgp').fill('42949672.95');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Check the amounts and distances');
  await expect(page.locator('#earningsEgp')).toBeEnabled();
  await page.locator('#earningsEgp').fill('85');
  await page.locator('#startedAt').fill('2026-09-16T17:00'); await page.locator('#endedAt').fill('2026-09-16T17:30');
  await page.locator('#totalKm').fill('10'); await page.locator('#paidKm').fill('8');
  const attempts: Array<{ key: string; body: string }> = [];
  await page.route('**/api/v1/trips', async (route) => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    const response = await route.fetch();
    if (response.status() === 401) { await route.fulfill({ response }); return; }
    expect(response.status()).toBe(201);
    attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() ?? '' });
    if (attempts.length === 1) await route.abort('failed'); else await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Check saved trip', exact: true })).toBeEnabled();
  await expect(page.locator('#earningsEgp')).toBeDisabled();
  await page.reload(); await expect(page.locator('#earningsEgp')).toBeDisabled();
  await page.getByRole('button', { name: 'Check saved trip', exact: true }).click();
  await expect(page).toHaveURL(/\/trips\/(?!new)[^/]+$/);
  expect(attempts).toHaveLength(2); expect(attempts[1]).toEqual(attempts[0]);
  const list = await request.get(`${base}/trips`, { headers: user.headers });
  const trips = z.object({ data: tripsListResponseSchema }).parse(await list.json()).data.items;
  expect(trips).toHaveLength(1); expect(trips[0]).toMatchObject({ version: 1, source: 'MANUAL', earningsPiastres: 8500, startedAt: '2026-09-16T14:00:00.000Z' });
  await page.getByRole('button', { name: 'Correction history', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Version 1');
});

test('trip correction and deletion retain reviewed versions; restoration and history work in Arabic at 320px', async ({ page, request }) => {
  const user = await account(request);
  const creation = await request.post(`${base}/trips`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() }, data: {
    vehicleId: user.vehicle.id, driverAppId: user.app.id, startedAt: '2026-09-16T14:00:00Z', endedAt: '2026-09-16T14:30:00Z',
    earningsPiastres: 8500, totalKmMeters: 10000, paidKmMeters: 8000,
  } });
  const record = z.object({ data: tripItemSchema }).parse(await creation.json()).data;
  await draftLogin(page, user); await page.goto(`/trips/${record.id}`);
  await page.getByRole('button', { name: 'Edit', exact: true }).click(); await page.locator('#notes').fill('Older draft keeps my notes');
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  const key = randomUUID(), body = { expectedVersion: 1, earningsPiastres: 9900 };
  const newer = await request.patch(`${base}/trips/${record.id}`, { headers: { ...user.headers, 'Idempotency-Key': key }, data: body });
  expect(newer.status()).toBe(200);
  const replay = await request.patch(`${base}/trips/${record.id}`, { headers: { ...user.headers, 'Idempotency-Key': key }, data: body });
  expect(replay.status()).toBe(200); expect(replay.headers()['idempotency-replayed']).toBe('true');
  const anotherPath = await request.patch(`${base}/trips/another-trip`, { headers: { ...user.headers, 'Idempotency-Key': key }, data: body });
  expect(anotherPath.status()).toBe(409);
  await page.goto('/trips?range=all'); await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#notes')).toHaveValue('Older draft keeps my notes');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This trip changed since you opened it.');
  await page.goto(`/trips/${record.id}`);
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const latest = await request.patch(`${base}/trips/${record.id}`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() }, data: { expectedVersion: 2, notes: 'Latest note' } });
  expect(latest.status()).toBe(200);
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('This trip changed');
  await page.reload(); await page.getByRole('button', { name: 'Delete', exact: true }).click();
  const deletionResponse = page.waitForResponse((response) => response.status() !== 401 && response.request().method() === 'DELETE' && response.url().includes(`/trips/${record.id}`));
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  const deletion = await deletionResponse;
  expect(deletion.status()).toBe(200);
  const deleteKey = deletion.request().headers()['idempotency-key'];
  await expect(page.getByRole('button', { name: 'Restore trip', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore trip', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Restore trip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled();
  const deleteReplay = await request.delete(`${base}/trips/${record.id}?expectedVersion=3`, { headers: { ...user.headers, 'Idempotency-Key': deleteKey } });
  expect(deleteReplay.status()).toBe(200); expect(deleteReplay.headers()['idempotency-replayed']).toBe('true');
  const changedDelete = await request.delete(`${base}/trips/${record.id}?expectedVersion=5`, { headers: { ...user.headers, 'Idempotency-Key': deleteKey } });
  expect(changedDelete.status()).toBe(409);
  const historyResponse = await request.get(`${base}/trips/${record.id}/history`, { headers: user.headers });
  const history = z.object({ data: tripHistorySchema }).parse(await historyResponse.json()).data;
  expect(history.items.map((item) => item.action)).toEqual(['RESTORED', 'DELETED', 'UPDATED', 'UPDATED', 'CREATED']);
  expect(JSON.stringify(history)).not.toContain('Latest note');
  await page.evaluate(() => localStorage.setItem('ehsbha.locale', 'ar')); await page.setViewportSize({ width: 320, height: 800 });
  await page.reload(); await page.getByRole('button', { name: 'سجل التعديلات', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('تعديل السائق');
  await expect(page.getByRole('dialog')).not.toContainText('expenses.');
  await expect(page.getByRole('dialog')).toContainText('قبل');
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'verification-output/trip-history-ar-320.png' });
});

test('unavailable manual-draft storage leaves screenshot capture accessible', async ({ page, request }) => {
  const user = await account(request);
  await page.addInitScript(() => {
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name, version) => {
      if (name === 'ehsbha-record-drafts') throw new DOMException('Storage unavailable', 'QuotaExceededError');
      return open(name, version);
    };
  });
  await draftLogin(page, user); await page.goto('/trips/new');
  await expect(page.getByRole('alert')).toContainText('This browser could not keep the draft');
  await expect(page.locator('#earningsEgp')).toHaveCount(0);
  await page.getByRole('button', { name: 'Extract from screenshot', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(1);
});

test('trip save keeps its receipt while local completion retries without a second HTTP write', async ({ page, request }) => {
  const user = await account(request); await draftLogin(page, user); await page.goto('/trips/new');
  await page.locator('#incomeMode').selectOption('take_home'); await page.locator('#earningsEgp').fill('75');
  await page.locator('#startedAt').fill('2026-09-16T17:00'); await page.locator('#endedAt').fill('2026-09-16T17:30');
  let writes = 0;
  await page.route('**/api/v1/trips', async (route) => {
    if (route.request().method() !== 'POST') { await route.continue(); return; }
    const response = await route.fetch();
    if (response.status() === 401) { await route.fulfill({ response }); return; }
    expect(response.status()).toBe(201); writes++;
    await page.evaluate(() => {
      const open = indexedDB.open.bind(indexedDB);
      indexedDB.open = (name, version) => {
        if (name === 'ehsbha-record-drafts') throw new DOMException('Storage unavailable', 'QuotaExceededError');
        return open(name, version);
      };
      window.addEventListener('restore-trip-storage', () => { indexedDB.open = open; }, { once: true });
    });
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This browser could not keep the draft');
  await expect(page).toHaveURL(/\/trips\/new$/);
  await page.evaluate(() => window.dispatchEvent(new Event('restore-trip-storage')));
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL(/\/trips\/(?!new)[^/]+$/); expect(writes).toBe(1);
  const list = await request.get(`${base}/trips`, { headers: user.headers });
  expect(z.object({ data: tripsListResponseSchema }).parse(await list.json()).data.items).toHaveLength(1);
});
