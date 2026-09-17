import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { z } from 'zod';
import { driverFuelEntrySchema, driverVehicleSchema, fuelPageSchema } from '@ehsbha/api-contracts';
import { DRAFT_JOURNEYS, draftAccount, draftApiBase, draftLogin } from './record-draft-fixtures';

test.use({ viewport: { width: 360, height: 800 }, timezoneId: 'UTC' });

for (const journey of DRAFT_JOURNEYS) {
  test(`${journey.name}: incomplete values survive close/reload and a lost save response reuses its request`, async ({ page, request }) => {
    const user = await draftAccount(request);
    await draftLogin(page, user); await page.goto(journey.path);
    await page.getByRole('button', { name: journey.add, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator(journey.amount).fill('-12.345');
    await dialog.locator(journey.notes).fill('Retain my unfinished entry');
    await expect(dialog.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.reload(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(dialog.locator(journey.amount)).toHaveValue('-12.345');
    await expect(dialog.locator(journey.notes)).toHaveValue('Retain my unfinished entry');
    await dialog.locator(journey.amount).fill('12.34');
    if (journey.name === 'maintenance') {
      await dialog.locator('#maintenanceItemId').selectOption(user.item.id);
      await dialog.locator('#odometerKm').fill('0');
    }
    const requests: Array<{ key: string; body: string }> = [];
    await page.route(`**${journey.api}`, async (route) => {
      if (route.request().method() !== 'POST') { await route.continue(); return; }
      const response = await route.fetch();
      if (response.status() === 401) { await route.fulfill({ response }); return; }
      expect(response.status()).toBe(201);
      requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() ?? '' });
      if (requests.length === 1) await route.abort('failed'); else await route.fulfill({ response });
    });
    await dialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(dialog.getByRole('button', { name: journey.retry, exact: true })).toBeEnabled();
    await expect(dialog.locator(journey.amount)).toBeDisabled();
    await page.reload();
    await expect(page.getByText('Save awaiting confirmation', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(dialog.locator(journey.notes)).toHaveValue('Retain my unfinished entry');
    await dialog.getByRole('button', { name: journey.retry, exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(requests).toHaveLength(2); expect(requests[0]).toEqual(requests[1]);
    await page.reload(); await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);
    await expect(page.getByText('Retain my unfinished entry', { exact: true })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('restored edit keeps its original version after another client changes the record', async ({ page, request }) => {
  const user = await draftAccount(request);
  const created = await request.post(`${draftApiBase}/fuel`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() },
    data: { vehicleId: user.vehicle.id, dateTime: new Date().toISOString(), totalPiastres: 1000 } });
  const record = z.object({ data: driverFuelEntrySchema }).parse(await created.json()).data;
  await draftLogin(page, user); await page.goto('/fuel');
  await page.getByRole('article').getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('#fuel-notes').fill('My older draft');
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  const newer = await request.patch(`${draftApiBase}/fuel/${record.id}`, { headers: { ...user.headers, 'Idempotency-Key': randomUUID() },
    data: { expectedVersion: 1, totalPiastres: 9999, notes: 'Newer account record' } });
  expect(newer.status()).toBe(200);
  await page.reload(); await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#fuel-totalEgp')).toHaveValue('10');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This fuel record changed');
  await expect(page.locator('#fuel-notes')).toHaveValue('My older draft');
  const list = await request.get(`${draftApiBase}/fuel`, { headers: user.headers });
  expect(z.object({ data: fuelPageSchema }).parse(await list.json()).data.items[0]).toMatchObject({ version: 2, totalPiastres: 9999, notes: 'Newer account record' });
});

test('two tabs cannot overwrite a draft or submit the losing copy', async ({ page, context, request }) => {
  const user = await draftAccount(request);
  await draftLogin(page, user); await page.goto('/fuel');
  await page.getByRole('button', { name: 'Add purchase', exact: true }).click();
  await page.locator('#fuel-totalEgp').fill('10');
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  const other = await context.newPage(); await other.goto('/fuel');
  await other.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.locator('#fuel-notes').fill('First tab keeps this');
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  await other.locator('#fuel-notes').fill('Second tab must not overwrite');
  await expect(other.getByRole('alert')).toContainText('This draft changed in another window');
  await other.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  const list = await request.get(`${draftApiBase}/fuel`, { headers: user.headers });
  expect(z.object({ data: fuelPageSchema }).parse(await list.json()).data.summary.recordCount).toBe(0);
  await other.getByRole('button', { name: 'Close this copy', exact: true }).click();
  await other.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(other.locator('#fuel-notes')).toHaveValue('First tab keeps this');
});

test('Arabic draft recovery and explicit discard fit a 320px screen', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  const user = await draftAccount(request);
  await draftLogin(page, user, 'ar'); await page.goto('/fuel');
  await page.getByRole('button', { name: 'إضافة عملية شراء', exact: true }).click();
  await page.locator('#fuel-notes').fill('مسودة قبل الحفظ');
  await expect(page.getByTestId('record-draft-notice')).toContainText('تم الحفظ على الجهاز.');
  await page.reload(); await page.getByRole('button', { name: 'استكمال', exact: true }).click();
  await expect(page.locator('#fuel-notes')).toHaveValue('مسودة قبل الحفظ');
  await expect(page.getByTestId('draft-vehicle')).toContainText('سيارة');
  await expect(page.getByRole('dialog')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'verification-output/operating-draft-ar-320.png' });
  await page.getByTestId('record-draft-notice').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'verification-output/operating-draft-notice-ar-320.png' });
  await page.getByRole('button', { name: 'حذف المسودة', exact: true }).click();
  await page.getByRole('button', { name: 'حذف نسخة الجهاز', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'استكمال', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('storage failure retains the inputs, blocks submission and recovers without duplicating the entry', async ({ page, request }) => {
  const user = await draftAccount(request);
  await draftLogin(page, user); await page.goto('/fuel');
  await page.getByRole('button', { name: 'Add purchase', exact: true }).click();
  await expect(page.locator('#fuel-totalEgp')).toBeVisible();
  await page.evaluate(() => {
    const original = indexedDB.open.bind(indexedDB);
    indexedDB.open = (name, version) => {
      if (name === 'ehsbha-record-drafts') throw new DOMException('Storage unavailable', 'QuotaExceededError');
      return original(name, version);
    };
    window.addEventListener('restore-draft-storage', () => { indexedDB.open = original; }, { once: true });
  });
  await page.locator('#fuel-totalEgp').fill('12.34');
  await expect(page.getByRole('alert')).toContainText('This browser could not keep the draft');
  await expect(page.locator('#fuel-totalEgp')).toHaveValue('12.34');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  const list = await request.get(`${draftApiBase}/fuel`, { headers: user.headers });
  expect(z.object({ data: fuelPageSchema }).parse(await list.json()).data.summary.recordCount).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('restore-draft-storage')));
  await page.getByRole('button', { name: 'Retry device storage', exact: true }).click();
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  await page.getByRole('dialog').getByRole('button', { name: 'Retry same save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('article')).toHaveCount(1);
});

test('logout removes drafts and an old tab cannot recreate them', async ({ page, context, request }) => {
  const user = await draftAccount(request);
  await draftLogin(page, user); await page.goto('/fuel');
  await page.getByRole('button', { name: 'Add purchase', exact: true }).click();
  await page.locator('#fuel-notes').fill('Private draft before logout');
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  const other = await context.newPage(); await other.goto('/settings');
  await other.getByRole('button', { name: 'Log out', exact: true }).last().click();
  await expect(other).toHaveURL(/\/login/);
  await page.locator('#fuel-notes').fill('Old tab cannot put this back');
  await expect(page.getByRole('alert')).toContainText('Your account session changed');
  const records = await other.evaluate(() => new Promise<number>((resolve, reject) => {
    const open = indexedDB.open('ehsbha-record-drafts', 1);
    open.onsuccess = () => {
      const transaction = open.result.transaction('drafts', 'readonly');
      const count = transaction.objectStore('drafts').count();
      transaction.oncomplete = () => { open.result.close(); resolve(count.result); };
      transaction.onabort = () => { open.result.close(); reject(new Error('draft-count')); };
    };
    open.onerror = () => reject(new Error('draft-open'));
  }));
  expect(records).toBe(0);
});

test('an unreadable draft can be discarded explicitly without deleting other drafts or account records', async ({ page, request }) => {
  const user = await draftAccount(request);
  await draftLogin(page, user); await page.goto('/fuel');
  await page.getByRole('button', { name: 'Add purchase', exact: true }).click();
  await page.locator('#fuel-notes').fill('Draft to corrupt');
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/expenses'); await page.getByRole('button', { name: 'Add expense', exact: true }).click();
  await page.locator('#notes').fill('Keep this separate draft');
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('ehsbha-record-drafts', 1);
    open.onsuccess = () => {
      const transaction = open.result.transaction('drafts', 'readwrite'), store = transaction.objectStore('drafts');
      const cursor = store.openCursor();
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        const key = row.primaryKey;
        if (Array.isArray(key) && key[1] === 'fuel') row.update({ accountId: key[0], kind: key[1], scope: key[2], schemaVersion: -1 });
        row.continue();
      };
      transaction.oncomplete = () => { open.result.close(); resolve(); };
      transaction.onabort = () => { open.result.close(); reject(new Error('draft-corruption-fixture')); };
    };
    open.onerror = () => reject(new Error('draft-open'));
  }));
  await page.goto('/fuel'); await expect(page.getByText('Unreadable device draft', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('This device draft cannot be read safely');
  await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
  await expect(page.getByText('This draft cannot be read and may contain a pending save.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Discard this device copy', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add purchase', exact: true }).click();
  await expect(page.locator('#fuel-notes')).toHaveValue('');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto('/expenses'); await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#notes')).toHaveValue('Keep this separate draft');
  const list = await request.get(`${draftApiBase}/fuel`, { headers: user.headers });
  expect(z.object({ data: fuelPageSchema }).parse(await list.json()).data.summary.recordCount).toBe(0);
});

test('a resumed purchase shows and retains its original vehicle when the page selects another vehicle', async ({ page, request }) => {
  const user = await draftAccount(request);
  await request.patch(`${draftApiBase}/vehicles/${user.vehicle.id}`, { headers: user.headers, data: { make: 'Original', model: 'Car' } });
  const created = await request.post(`${draftApiBase}/vehicles`, { headers: user.headers, data: { type: 'CAR', fuelType: 'PETROL_92', make: 'Other', model: 'Car' } });
  const other = z.object({ data: driverVehicleSchema }).parse(await created.json()).data;
  await draftLogin(page, user); await page.goto('/fuel');
  await page.locator('#fuel-vehicle').selectOption(user.vehicle.id);
  await page.getByRole('button', { name: 'Add purchase', exact: true }).click();
  await page.locator('#fuel-totalEgp').fill('7.50');
  await expect(page.getByTestId('record-draft-notice')).toContainText('Saved on this device.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('#fuel-vehicle').selectOption(other.id);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByTestId('draft-vehicle')).toContainText('Original Car');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const records = await request.get(`${draftApiBase}/fuel`, { headers: user.headers });
  expect(z.object({ data: fuelPageSchema }).parse(await records.json()).data.items[0]).toMatchObject({ vehicleId: user.vehicle.id, totalPiastres: 750 });
});
