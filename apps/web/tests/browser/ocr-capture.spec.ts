import { test, expect, type Page } from '@playwright/test';
import { OcrCandidateStatus, OcrImportStatus, OcrImportImageStatus, createOcrImportRequestSchema, ocrConfirmationRequestSchema, type OcrExtractResponse, type OcrImportDetail } from '@ehsbha/api-contracts';
import { browserApps, browserCandidate, browserDriver, browserExtraction, browserImage, browserVehicles, responseEnvelope } from './ocr-fixtures';

async function prepare(page: Page, result: OcrExtractResponse, locale = 'en') {
  let job: OcrImportDetail | null = null;
  const requests = { creates: 0, uploads: 0, confirmations: 0, holdProcessing: false, loseCreateResponse: false, loseConfirmationResponse: false, keys: [] as string[] };
  await page.addInitScript(({ user, language }) => {
    localStorage.setItem('ehsbha.auth', JSON.stringify({ state: { user, refreshToken: 'test-browser-session' }, version: 0 }));
    localStorage.setItem('ehsbha.locale', language);
  }, { user: browserDriver, language: locale });
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: object = [];
    if (path.endsWith('/vehicles')) data = browserVehicles;
    else if (path.endsWith('/drivers/me/apps')) data = browserApps;
    else if (path.endsWith('/ocr/imports') && route.request().method() === 'POST') {
      requests.creates += 1;
      const input = createOcrImportRequestSchema.parse(route.request().postDataJSON());
      requests.keys.push(input.clientMutationId);
      if (!job) job = { id: 'batch-1', clientMutationId: input.clientMutationId, status: OcrImportStatus.Uploading,
        createdAt: '2026-09-17T00:00:00.000Z', expiresAt: '2099-09-24T00:00:00.000Z', uploadExpiresAt: '2099-09-18T00:00:00.000Z',
        imageCount: input.images.length, finishedImageCount: 0, hints: input.hints, result: null, confirmations: [],
        images: input.images.map((image, index) => ({ ...image, id: `image-${index}`, index, status: OcrImportImageStatus.AwaitingUpload, duplicateOf: null, errorCode: null, attempts: 0 })),
      };
      data = job;
      if (requests.loseCreateResponse) { requests.loseCreateResponse = false; await route.abort('failed'); return; }
    } else if (path.includes('/ocr/imports/batch-1/images/') && job) {
      requests.uploads += 1;
      const imageId = path.split('/').at(-1);
      job.images = job.images.map((image) => image.id === imageId ? { ...image, status: OcrImportImageStatus.Completed, attempts: 1 } : image);
      job.finishedImageCount = job.images.filter((image) => image.status === OcrImportImageStatus.Completed).length;
      job.status = OcrImportStatus.Processing;
      data = job;
    } else if (path.endsWith('/ocr/imports/batch-1/confirm') && job) {
      requests.confirmations += 1;
      const input = ocrConfirmationRequestSchema.parse(route.request().postDataJSON());
      const saved = input.items.map((item) => ({ candidateId: item.candidateId, tripId: `saved-${item.candidateId}`, savedAt: '2026-09-17T00:00:00.000Z', deleted: false }));
      job.confirmations.push(...saved.filter((receipt) => !job?.confirmations.some((existing) => existing.candidateId === receipt.candidateId)));
      data = { saved, failed: [] };
      if (requests.loseConfirmationResponse) { requests.loseConfirmationResponse = false; await route.abort('failed'); return; }
    } else if (path.endsWith('/ocr/imports/batch-1') && job) {
      if (route.request().method() === 'DELETE') { job.status = OcrImportStatus.Cancelled; job.result = null; }
      else if (job.finishedImageCount === job.imageCount && !requests.holdProcessing) { job.status = OcrImportStatus.Review; job.result = result; }
      data = job;
    }
    else if (path.endsWith('/auth/refresh')) data = { user: browserDriver, accessToken: 'test-browser-access', refreshToken: 'test-browser-session' };
    await route.fulfill({ json: responseEnvelope(data) });
  });
  await page.goto('/trips/new');
  await page.getByRole('button', { name: locale === 'en' ? 'Extract from screenshot' : 'استخراج من لقطة الشاشة' }).click();
  return requests;
}

async function upload(page: Page) {
  await page.locator('input[type=file]').setInputFiles({ name: 'trip.png', mimeType: 'image/png', buffer: browserImage });
  await page.getByRole('dialog').getByRole('button', { name: /^(Extract|استخراج)$/ }).click();
}

test('automatic extraction, partial save retry, and stable candidate identities', async ({ page }) => {
  await prepare(page, browserExtraction());
  const submitted: string[][] = [];
  await page.route('**/api/v1/ocr/imports/batch-1/confirm', async (route) => {
    const body = ocrConfirmationRequestSchema.parse(route.request().postDataJSON());
    submitted.push(body.items.map((item) => item.candidateId));
    const ids = submitted.length === 1 ? body.items.slice(0, 1) : body.items;
    await route.fulfill({ json: responseEnvelope({ saved: ids.map((item) => ({ candidateId: item.candidateId, tripId: `saved-${item.candidateId}`, savedAt: '2026-09-17T00:00:00.000Z', deleted: false })),
      failed: submitted.length === 1 ? [{ candidateId: body.items[1].candidateId, code: 'OCR_CONFIRMATION_RETRY' }] : [] }) });
  });
  await upload(page);
  await expect(page.getByRole('button', { name: 'Save selected (2)' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save selected (2)' }).click();
  await expect(page.getByRole('button', { name: 'Save selected (1)' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save selected (1)' }).click();
  await expect(page.getByRole('button', { name: 'Save selected (0)' })).toBeDisabled();
  expect(submitted).toEqual([[browserCandidate(1).evidence?.id, browserCandidate(2).evidence?.id], [browserCandidate(2).evidence?.id]]);
});

test('missing facts block save, edits survive closing review, and Cairo times stay local', async ({ page }) => {
  const candidate = browserCandidate(1);
  candidate.parsed.grossEgp = null;
  candidate.parsed.receivedEgp = null;
  if (candidate.evidence) candidate.evidence.status = OcrCandidateStatus.Review;
  await prepare(page, browserExtraction([candidate]));
  await upload(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox')).toBeDisabled();
  await dialog.getByRole('button', { name: /Trip 1/ }).click();
  await expect(dialog.getByLabel('Started at')).toHaveValue('2026-09-16T17:00');
  await dialog.getByLabel('Quoted price', { exact: false }).fill('100');
  await expect(dialog.getByRole('checkbox')).toBeEnabled();
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('button', { name: 'Extract from screenshot' }).click();
  await expect(dialog.getByLabel('Quoted price', { exact: false })).toHaveValue('100');
  await expect(dialog.getByRole('checkbox')).toBeChecked();
});

test('Arabic review explains a daily-distance conflict and retains the unsaved trip', async ({ page }) => {
  await prepare(page, browserExtraction([browserCandidate(1)]), 'ar');
  await page.route('**/api/v1/ocr/imports/batch-1/confirm', async (route) => {
    const body = ocrConfirmationRequestSchema.parse(route.request().postDataJSON());
    await route.fulfill({ json: responseEnvelope({ saved: [], failed: body.items.map((item) => ({
      candidateId: item.candidateId, code: 'DAILY_DISTANCE_CONFLICT',
    })) }) });
  });
  await upload(page);
  await page.getByRole('button', { name: 'حفظ المحدد (1)' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'صحّح مسافة اليوم أو مسافات الرحلات' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'حفظ المحدد (1)' })).toBeEnabled();
  await expect(page.getByRole('checkbox')).toBeChecked();
});

test('twenty images are accepted and an extra image is rejected visibly', async ({ page }) => {
  await prepare(page, browserExtraction());
  await page.locator('input[type=file]').setInputFiles(Array.from({ length: 20 }, (_, index) => ({ name: `trip-${index}.png`, mimeType: 'image/png', buffer: browserImage })));
  await expect(page.getByRole('dialog').getByText('20 selected')).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'extra.png', mimeType: 'image/png', buffer: browserImage });
  await expect(page.getByRole('alert')).toContainText('Choose at most 20 screenshots');
  await expect(page.getByRole('dialog').getByText('20 selected')).toBeVisible();
});

test('duplicates start unselected and extracted seconds are preserved', async ({ page }) => {
  const first = browserCandidate(1);
  first.parsed.endedAt = '2026-09-16T14:20:41.000Z';
  first.parsed.durationSec = 1241;
  const duplicate = browserCandidate(2);
  if (duplicate.evidence) { duplicate.evidence.status = OcrCandidateStatus.Duplicate; duplicate.evidence.duplicateOf = first.evidence?.id ?? null; }
  await prepare(page, browserExtraction([first, duplicate]));
  await upload(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox', { name: 'Select trip 2' })).not.toBeChecked();
  await expect(dialog.getByRole('button', { name: 'Save selected (1)' })).toBeEnabled();
  await dialog.getByRole('button', { name: /Trip 1/ }).click();
  await expect(dialog.getByLabel('End time', { exact: false })).toHaveValue('2026-09-16T17:20:41');
});

test('a network failure preserves selected images for retry', async ({ page }) => {
  await prepare(page, browserExtraction());
  await page.route('**/api/v1/ocr/imports', (route) => route.abort('failed'));
  await upload(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('dialog').getByText('1 selected')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Extract', exact: true })).toBeEnabled();
});

test('a full reload preserves invalid review input and then a corrected selection', async ({ page }) => {
  const candidate = browserCandidate(1);
  candidate.parsed.grossEgp = null;
  await prepare(page, browserExtraction([candidate]));
  await upload(page);
  await page.getByRole('button', { name: /Trip 1/ }).click();
  await page.getByRole('dialog').getByLabel('Quoted price', { exact: false }).fill('-1');
  await expect(page.getByText('Capture saved on this device. You can return to it later.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Extract from screenshot' }).click();
  await expect(page.getByRole('dialog').getByLabel('Quoted price', { exact: false })).toHaveValue('-1');
  await expect(page.getByRole('dialog').getByRole('checkbox')).toBeDisabled();
  await page.getByRole('dialog').getByLabel('Quoted price', { exact: false }).fill('100');
  await page.getByRole('dialog').getByRole('checkbox').check();
  await expect(page.getByText('Capture saved on this device. You can return to it later.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Extract from screenshot' }).click();
  await expect(page.getByRole('dialog').getByLabel('Quoted price', { exact: false })).toHaveValue('100');
  await expect(page.getByRole('dialog').getByRole('checkbox')).toBeChecked();
});

test('a processing job resumes after reload without uploading accepted images again', async ({ page }) => {
  const requests = await prepare(page, browserExtraction());
  requests.holdProcessing = true;
  await upload(page);
  await expect.poll(() => requests.uploads).toBe(1);
  await expect(page.getByText('Capture saved on this device. You can return to it later.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Extract from screenshot' }).click();
  await expect(page.getByRole('dialog').getByText('1 selected')).toBeVisible();
  requests.holdProcessing = false;
  await page.getByRole('dialog').getByRole('button', { name: 'Extract', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save selected (2)' })).toBeEnabled();
  expect(requests.creates).toBe(1); expect(requests.uploads).toBe(1);
});

test('a lost create response reuses the persisted manifest key after reload', async ({ page }) => {
  const requests = await prepare(page, browserExtraction());
  requests.loseCreateResponse = true;
  await upload(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Extract from screenshot' }).click();
  await expect(page.getByRole('dialog').getByText('1 selected')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Extract', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save selected (2)' })).toBeEnabled();
  expect(requests.keys).toHaveLength(2); expect(new Set(requests.keys).size).toBe(1);
  expect(requests.uploads).toBe(1);
});

test('a lost confirmation response recovers acknowledgements without another save', async ({ page }) => {
  const requests = await prepare(page, browserExtraction());
  requests.loseConfirmationResponse = true;
  await upload(page);
  await page.getByRole('button', { name: 'Save selected (2)' }).click();
  await expect(page.getByRole('button', { name: 'Save selected (0)' })).toBeDisabled();
  await expect(page.getByText('2 trips have already been saved from these images.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Extract from screenshot' }).click();
  await expect(page.getByRole('button', { name: 'Save selected (0)' })).toBeDisabled();
  expect(requests.confirmations).toBe(1);
});

test('device storage failure remains visible while online capture can finish', async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name === 'images') throw new DOMException('Test storage capacity', 'QuotaExceededError');
      return put.call(this, value, key);
    };
  });
  await prepare(page, browserExtraction());
  await upload(page);
  await expect(page.getByRole('alert')).toContainText('could not be saved on your device');
  await expect(page.getByRole('button', { name: 'Save selected (2)' })).toBeEnabled();
  await expect(page.getByText('Capture saved on this device. You can return to it later.')).not.toBeVisible();
});

test('saving draft edits keeps keyboard focus on the edited field', async ({ page }) => {
  await prepare(page, browserExtraction());
  await upload(page);
  await page.getByRole('button', { name: /Trip 1/ }).click();
  const input = page.getByRole('dialog').getByLabel('Notes', { exact: false });
  await input.fill('');
  await input.pressSequentially('A driver note', { delay: 80 });
  await expect(page.getByText('Capture saved on this device. You can return to it later.')).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('A driver note');
});

test('logging out clears the account capture and its local image blobs', async ({ page }) => {
  await prepare(page, browserExtraction());
  await upload(page);
  await expect(page.getByRole('button', { name: 'Save selected (2)' })).toBeEnabled();
  await expect(page.getByText('Capture saved on this device. You can return to it later.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect.poll(() => page.evaluate((accountId) => new Promise<number>((resolve, reject) => {
    const request = indexedDB.open('ehsbha-ocr-capture', 1);
    request.onerror = () => reject(new Error('Storage unavailable'));
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(['drafts', 'images'], 'readonly');
      const draft = transaction.objectStore('drafts').count(accountId);
      const files = transaction.objectStore('images').count(accountId);
      transaction.oncomplete = () => { database.close(); resolve(draft.result + files.result); };
    };
  }), browserDriver.id)).toBe(0);
});

for (const width of [320, 390, 768, 1280]) {
  test(`Arabic review at ${width}px preserves RTL and avoids horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await prepare(page, browserExtraction(), 'ar');
    await upload(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('2 رحلات تم استخراجها')).toBeVisible();
    await dialog.getByRole('button', { name: /رحلة 1/ }).click();
    const overflow = await dialog.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    expect(overflow).toBe(false);
    await page.screenshot({ path: `verification-output/ocr-ar-${width}.png`, fullPage: true });
  });
}
