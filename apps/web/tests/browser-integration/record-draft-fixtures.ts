import { randomInt, randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { z } from 'zod';
import { driverAuthResultSchema, driverVehicleSchema, maintenanceItemSchema } from '@ehsbha/api-contracts';

export const draftApiBase = 'http://127.0.0.1:55443/api/v1';
export async function draftAccount(request: APIRequestContext) {
  const phone = `010${randomInt(10000000, 99999999)}`, password = `draft-test-${randomUUID()}`;
  const registered = await request.post(`${draftApiBase}/auth/register`, { data: { phone: `+2${phone}`, email: `${phone}@example.test`, password,
    displayName: 'Draft journey', locale: 'en', timezone: 'Africa/Cairo' } });
  expect(registered.status()).toBe(201);
  const auth = z.object({ data: driverAuthResultSchema }).parse(await registered.json()).data;
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  const created = await request.post(`${draftApiBase}/vehicles`, { headers, data: { type: 'CAR', fuelType: 'PETROL_92' } });
  const vehicle = z.object({ data: driverVehicleSchema }).parse(await created.json()).data;
  const items = await request.get(`${draftApiBase}/maintenance/items`, { headers });
  const item = z.object({ data: maintenanceItemSchema.array() }).parse(await items.json()).data.find((row) => row.code === 'ENGINE_OIL');
  if (!item) throw new Error('Seeded engine oil item missing');
  return { phone, password, headers, vehicle, item };
}
export async function draftLogin(page: Page, user: { phone: string; password: string }, locale = 'en') {
  await page.addInitScript((value) => { if (!localStorage.getItem('ehsbha.locale')) localStorage.setItem('ehsbha.locale', value); }, locale);
  await page.goto('/login'); await page.locator('#phone').fill(user.phone); await page.locator('#password').fill(user.password);
  await page.locator('button[type=submit]').click(); await expect(page).not.toHaveURL(/\/login/);
}
export const DRAFT_JOURNEYS = [
  { name: 'fuel', path: '/fuel', add: 'Add purchase', amount: '#fuel-totalEgp', notes: '#fuel-notes', retry: 'Retry same save', api: '/fuel' },
  { name: 'expense', path: '/expenses', add: 'Add expense', amount: '#amountEgp', notes: '#notes', retry: 'Retry', api: '/expenses' },
  { name: 'maintenance', path: '/maintenance', add: 'Log maintenance', amount: '#costEgp', notes: '#maintenance-notes', retry: 'Retry', api: '/maintenance/records' },
];
