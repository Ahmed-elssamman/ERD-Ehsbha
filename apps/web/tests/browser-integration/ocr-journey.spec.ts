import { randomInt } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { z } from 'zod';
import {
  driverAuthResultSchema, driverVehicleSchema, driverAppBindingSchema,
  ocrImportListSchema, ocrImportDetailSchema, tripsListResponseSchema, OcrImportStatus,
  dailyAnalyticsSchema, weeklyAnalyticsSchema, monthlyAnalyticsSchema,
  dailyOdometerSchema,
} from '@ehsbha/api-contracts';
import { journeyFields, journeyImage } from './ocr-journey.data';

test('real login, durable OCR review, atomic confirmation and saved receipt survive reload', async ({ page, request }) => {
  const base = 'http://127.0.0.1:55443/api/v1';
  const phone = `010${randomInt(10000000, 99999999)}`;
  const password: string = `browser-test-${randomInt(10000000, 99999999)}`;
  const registration = await request.post(`${base}/auth/register`, { data: {
    phone: `+2${phone}`, email: `${phone}@example.test`, password, displayName: 'Browser integration', locale: 'en', timezone: 'Africa/Cairo',
  } });
  expect(registration.status()).toBe(201);
  const auth = z.object({ data: driverAuthResultSchema }).parse(await registration.json()).data;
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  const vehicleResponse = await request.post(`${base}/vehicles`, { headers, data: { type: 'CAR', fuelType: 'PETROL_92', make: 'Test', model: 'Vehicle' } });
  expect(vehicleResponse.status()).toBe(201);
  const vehicle = z.object({ data: driverVehicleSchema }).parse(await vehicleResponse.json()).data;
  const appResponse = await request.post(`${base}/drivers/me/apps`, { headers, data: { customName: 'Uber', commissionPct: 15 } });
  expect(appResponse.status()).toBe(201);
  const app = z.object({ data: driverAppBindingSchema }).parse(await appResponse.json()).data;

  await page.addInitScript(() => { localStorage.setItem('ehsbha.locale', 'en'); });
  await page.goto('/login');
  await page.locator('#phone').fill(phone);
  await page.locator('#password').fill(password);
  await page.locator('button[type=submit]').click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.goto('/trips/new');
  await page.getByRole('button', { name: 'Extract from screenshot' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'trip.png', mimeType: 'image/png', buffer: journeyImage });
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Extract', exact: true }).click();
  await dialog.getByRole('button', { name: /Trip 1/ }).click({ timeout: 20_000 });
  await dialog.getByRole('combobox', { name: /^App/ }).selectOption(app.id);
  await dialog.getByRole('combobox', { name: 'Income information' }).selectOption('breakdown');
  for (const field of journeyFields) await dialog.getByLabel(field.label, { exact: false }).fill(field.value);
  await expect(dialog.getByRole('checkbox')).toBeEnabled();
  await dialog.getByRole('checkbox').check();
  await expect(dialog.getByText('Capture saved on this device. You can return to it later.')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Extract from screenshot' }).click();
  await expect(dialog.getByLabel('Pickup', { exact: false })).toHaveValue('Test pickup');
  await expect(dialog.getByRole('checkbox')).toBeChecked();
  await dialog.getByRole('button', { name: 'Save selected (1)' }).click();
  await expect(dialog.getByRole('button', { name: 'Save selected (0)' })).toBeDisabled();

  const tripsResponse = await request.get(`${base}/trips`, { headers });
  expect(tripsResponse.status()).toBe(200);
  const trips = z.object({ data: tripsListResponseSchema }).parse(await tripsResponse.json()).data.items;
  expect(trips).toHaveLength(1);
  expect(trips[0]).toMatchObject({ vehicleId: vehicle.id, driverAppId: app.id, grossPiastres: 10000,
    commissionPiastres: 1500, receivedPiastres: 8500, totalKmMeters: 10000, paidKmMeters: 10000,
    startedAt: '2026-09-16T14:00:00.000Z', endedAt: '2026-09-16T14:20:00.000Z', pickup: 'Test pickup' });
  const dayResponse = await request.get(`${base}/analytics/daily?date=2026-09-16`, { headers });
  const weekResponse = await request.get(`${base}/analytics/weekly?isoYear=2026&isoWeek=38`, { headers });
  const monthResponse = await request.get(`${base}/analytics/monthly?year=2026&month=9`, { headers });
  expect([dayResponse.status(), weekResponse.status(), monthResponse.status()]).toEqual([200, 200, 200]);
  const day = z.object({ data: dailyAnalyticsSchema }).parse(await dayResponse.json()).data;
  const week = z.object({ data: weeklyAnalyticsSchema }).parse(await weekResponse.json()).data;
  const month = z.object({ data: monthlyAnalyticsSchema }).parse(await monthResponse.json()).data;
  for (const period of [day, week, month]) {
    expect(period).toMatchObject({ tripCount: 1, grossPiastres: 10000, netProfitPiastres: 8500,
      onlineMinutes: 20, profitPerHourPiastres: 25500, profitPerKmPiastres: 850 });
  }
  const invalidDistance = await request.post(`${base}/odometer/daily`, { headers, data: { date: '2026-09-16', totalKmMeters: 5000 } });
  expect(invalidDistance.status()).toBe(400);
  expect(await invalidDistance.json()).toMatchObject({ error: { code: 'DAILY_DISTANCE_CONFLICT', messageKey: 'errors.DAILY_DISTANCE_CONFLICT' } });
  const recordedDistance = await request.post(`${base}/odometer/daily`, { headers, data: { date: '2026-09-16', totalKmMeters: 15000 } });
  expect(recordedDistance.status()).toBe(201);
  expect(z.object({ data: dailyOdometerSchema }).parse(await recordedDistance.json()).data.totalKmMeters).toBe(15000);
  const revisedMonth = await request.get(`${base}/analytics/monthly?year=2026&month=9`, { headers });
  expect(z.object({ data: monthlyAnalyticsSchema }).parse(await revisedMonth.json()).data).toMatchObject({
    netProfitPiastres: 8500, totalKmMeters: 15000, paidKmMeters: 10000, emptyKmMeters: 5000, profitPerKmPiastres: 567,
  });
  const importsResponse = await request.get(`${base}/ocr/imports`, { headers });
  const imports = z.object({ data: ocrImportListSchema }).parse(await importsResponse.json()).data.items;
  expect(imports).toHaveLength(1);
  const detailResponse = await request.get(`${base}/ocr/imports/${imports[0].id}`, { headers });
  const detail = z.object({ data: ocrImportDetailSchema }).parse(await detailResponse.json()).data;
  expect(detail.status).toBe(OcrImportStatus.Review);
  expect(detail.confirmations).toHaveLength(1);
  expect(detail.confirmations[0].tripId).toBe(trips[0].id);
  await page.reload();
  await page.getByRole('button', { name: 'Extract from screenshot' }).click();
  await expect(dialog.getByRole('button', { name: 'Save selected (0)' })).toBeDisabled();
  const replayResponse = await request.get(`${base}/trips`, { headers });
  expect(z.object({ data: tripsListResponseSchema }).parse(await replayResponse.json()).data.items).toHaveLength(1);
});
