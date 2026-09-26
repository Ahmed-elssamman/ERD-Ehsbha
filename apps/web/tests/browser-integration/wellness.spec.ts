import { expect, test, type Page } from '@playwright/test';
import { draftAccount, draftLogin } from './record-draft-fixtures';

test.use({ viewport: { width: 360, height: 800 }, timezoneId: 'America/Los_Angeles' });

async function makeDue(page: Page) {
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('ehsbha-wellness', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('accounts', 'readwrite');
      const request = transaction.objectStore('accounts').openCursor();
      request.onsuccess = () => { const cursor = request.result; if (!cursor) return;
        const state = cursor.value as { reminders: Array<{ dueAt: number | null; enabled: boolean }> };
        state.reminders.forEach((item) => { if (item.enabled) item.dueAt = Date.now() - 1; }); cursor.update(state); cursor.continue(); };
      transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onabort = () => reject(transaction.error);
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test('wellness saves offline choices, retains them on reload, and requires explicit checklist answers', async ({ page, request }) => {
  await draftLogin(page, await draftAccount(request)); await page.goto('/wellness');
  const hydration = page.getByRole('checkbox', { name: 'Hydration', exact: true });
  await expect(hydration).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Start reminders', exact: true })).toBeDisabled();
  await page.route('**/api/v1/**', (route) => route.abort('internetdisconnected'));
  await hydration.click(); await expect(page.getByText('Saved on this device.', { exact: true })).toBeVisible();
  await page.locator('#frequency-water').selectOption('90');
  await page.getByRole('checkbox', { name: 'Pause reminders during quiet hours' }).click();
  await page.getByLabel('Considered hydration', { exact: true }).selectOption('done');
  await page.getByLabel('Took a break', { exact: true }).selectOption('skipped');
  await page.getByRole('button', { name: 'Start reminders', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause reminders', exact: true })).toBeVisible();
  await page.reload(); await expect(hydration).toBeChecked();
  await expect(page.locator('#frequency-water')).toHaveValue('90');
  await expect(page.getByLabel('Considered hydration', { exact: true })).toHaveValue('done');
  await expect(page.getByText('1 done · 1 skipped · 3 unrecorded', { exact: true })).toBeVisible();
  await makeDue(page);
  const alert = page.getByRole('region', { name: 'Wellness reminder', exact: true });
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: 'Snooze 15 minutes' }).click(); await expect(alert).toHaveCount(0);
  await expect(page.getByLabel('Moved while safely stopped', { exact: true })).toHaveValue('unrecorded');
  await page.reload(); await expect(alert).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear wellness data', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear wellness data', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(hydration).not.toBeChecked();
  await expect(page.getByLabel('Considered hydration', { exact: true })).toHaveValue('unrecorded');
});

test('one tab claims a due reminder and settings remain isolated after sign-out', async ({ page, context, request }) => {
  const user = await draftAccount(request);
  await draftLogin(page, user); await page.goto('/wellness');
  await page.getByRole('checkbox', { name: 'Hydration', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Pause reminders during quiet hours' }).click();
  await page.getByRole('button', { name: 'Start reminders', exact: true }).click();
  const other = await context.newPage(); await other.goto('/wellness');
  await expect(other.getByRole('checkbox', { name: 'Hydration', exact: true })).toBeChecked();
  await makeDue(page); await other.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect.poll(async () => await page.getByRole('region', { name: 'Wellness reminder', exact: true }).count() + await other.getByRole('region', { name: 'Wellness reminder', exact: true }).count()).toBe(1);
  const winner = await page.getByRole('region', { name: 'Wellness reminder', exact: true }).count() ? page : other;
  await winner.getByRole('region', { name: 'Wellness reminder', exact: true }).getByRole('button', { name: 'Skip today', exact: true }).click();
  await expect(winner.getByText('Skipped until Cairo midnight.', { exact: true })).toBeVisible();
  await winner.getByRole('button', { name: 'Resume today', exact: true }).click();
  await expect(winner.getByText('Skipped until Cairo midnight.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await expect(page).toHaveURL(/login/);
  await expect(other.getByRole('checkbox', { name: 'Hydration', exact: true })).toHaveCount(0);
  await other.close();
  await draftLogin(page, await draftAccount(request)); await page.goto('/wellness');
  await expect(page.getByRole('checkbox', { name: 'Hydration', exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: 'Log out', exact: true }).click(); await expect(page).toHaveURL(/login/);
  await draftLogin(page, user); await page.goto('/wellness');
  await expect(page.getByRole('checkbox', { name: 'Hydration', exact: true })).not.toBeChecked();
});

test('Arabic wellness fits 320px and storage failure never confirms a save', async ({ page, request }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await draftLogin(page, await draftAccount(request), 'ar'); await page.goto('/wellness');
  await page.getByRole('checkbox', { name: 'شرب المياه', exact: true }).click();
  await expect(page.getByText('اتحفظ على الجهاز ده.', { exact: true })).toBeVisible();
  await page.getByLabel('أخدت استراحة', { exact: true }).selectOption('done');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'verification-output/wellness-ar-320.png', fullPage: true });
  await page.evaluate(() => { Object.defineProperty(indexedDB, 'open', { configurable: true, value: () => { throw new Error('storage denied'); } }); });
  await page.getByRole('checkbox', { name: 'شرب المياه', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('تعذّر حفظ أو تحميل');
  await expect(page.getByText('اتحفظ على الجهاز ده.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'شرب المياه', exact: true })).toBeChecked();
});

test('work indicators show missing evidence instead of a health or safety score', async ({ page, request }) => {
  await draftLogin(page, await draftAccount(request)); await page.goto('/driver-score');
  await expect(page.getByRole('heading', { name: 'Work indicators', exact: true })).toBeVisible();
  await expect(page.getByText('At least three earlier recorded days', { exact: false })).toBeVisible();
  await expect(page.getByText('Safety', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Open wellness', exact: true })).toBeVisible();
  await page.route('**/api/v1/score/today', (route) => route.abort('failed'));
  await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('ehsbha.rq.account.')) localStorage.removeItem(key); });
  await page.reload();
  await expect(page.getByText('Today’s work indicators could not be loaded. Retry to read the recorded results.', { exact: true })).toBeVisible({ timeout: 15000 });
});

test('an unreadable local wellness record can be explicitly cleared and recreated', async ({ page, request }) => {
  await draftLogin(page, await draftAccount(request)); await page.goto('/wellness');
  await page.getByRole('checkbox', { name: 'Hydration', exact: true }).click();
  await expect(page.getByText('Saved on this device.', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('ehsbha-wellness', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('accounts', 'readwrite');
      const request = transaction.objectStore('accounts').openCursor();
      request.onsuccess = () => { const cursor = request.result; if (cursor) { cursor.update({ accountId: cursor.primaryKey }); cursor.continue(); } };
      transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onabort = () => reject(transaction.error);
    });
  });
  await page.reload(); await expect(page.getByRole('alert')).toContainText('could not be saved or loaded');
  await page.getByRole('button', { name: 'Clear wellness data', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear wellness data', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Hydration', exact: true })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Hydration', exact: true }).click();
  await expect(page.getByText('Saved on this device.', { exact: true })).toBeVisible();
});
