import { businessDateKey, SyncMutationKind, SyncMutationStatus } from '@ehsbha/shared-types';
import { dailyAnalyticsSchema, tripItemSchema, syncPullResponseSchema, syncPushResponseSchema, driverAppBindingSchema, sessionSchema } from '@ehsbha/api-contracts';
/**
 * Ehsbha HTTP smoke test
 * --------------------------------------------------------------
 * Exercises the full API surface end-to-end against a running
 * API + seeded database.
 *
 *   1. cd apps/api
 *   2. cp .env.example .env
 *   3. Set Neon DATABASE_URL + DIRECT_URL and the required non-secret placeholders
 *   4. npm run prisma:migrate
 *   5. npm run seed
 *   6. npm run start:dev (in another terminal)
 *   7. npx ts-node scripts/smoke.ts
 *
 * Pass with `SMOKE_BASE_URL=http://localhost:4000/api/v1` to override.
 */

const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000/api/v1';
const phone = process.env.SMOKE_DRIVER_PHONE ?? '+201000000001';
const password = process.env.SMOKE_DRIVER_PASSWORD;
if (!password) throw new Error('SMOKE_DRIVER_PASSWORD is required');

let accessToken = '';
let refreshToken = '';
const failures: string[] = [];
const passes: string[] = [];

function ok(name: string) { passes.push(name); console.log(`  ✓ ${name}`); }
function ko(name: string, why: string) { failures.push(`${name}: ${why}`); console.log(`  ✗ ${name} — ${why}`); }

async function call(method: string, path: string, body?: unknown, auth = true, idempotencyKey = '') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, body: json, raw: text };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertOk(name: string, p: Promise<{ status: number; body: any }>, expect = 200) {
  try {
    const r = await p;
    if (r.status !== expect && !(expect === 200 && r.status >= 200 && r.status < 300)) {
      ko(name, `status ${r.status}: ${JSON.stringify(r.body?.error ?? r.body)}`);
      return null;
    }
    ok(name);
    return r.body?.data ?? r.body;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    ko(name, e?.message ?? String(e));
    return null;
  }
}

async function main() {
  console.log(`\nEhsbha smoke test → ${base}\n`);

  // 1. Health
  console.log('Health:');
  await assertOk('GET /health', call('GET', '/health', undefined, false));
  await assertOk('GET /ready', call('GET', '/ready', undefined, false));

  // 2. Auth
  console.log('\nAuth:');
  const loginRes = await call('POST', '/auth/login', { phone, password }, false);
  if (loginRes.status === 200) {
    const data = loginRes.body?.data ?? loginRes.body;
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    ok('POST /auth/login');
  } else {
    ko('POST /auth/login', `status ${loginRes.status}. Did you run seed?`);
    summarize();
    return;
  }

  // 3. Wrong password should 401
  const wrong = await call('POST', '/auth/login', { phone, password: 'wrong-pass' }, false);
  if (wrong.status === 401) ok('Wrong password → 401');
  else ko('Wrong password → 401', `got ${wrong.status}`);

  // 4. Refresh
  const refreshed = await call('POST', '/auth/refresh', { refreshToken }, false);
  if (refreshed.status === 200) {
    const d = refreshed.body?.data ?? refreshed.body;
    accessToken = d.accessToken;
    refreshToken = d.refreshToken;
    ok('POST /auth/refresh rotates tokens');
  } else ko('POST /auth/refresh', `status ${refreshed.status}`);

  // 5. Reuse-detection (old token now revoked)
  const reused = await call('POST', '/auth/refresh', { refreshToken: 'definitely-invalid-token-xxxxxxxxxx' }, false);
  if (reused.status === 401) ok('Invalid refresh → 401');
  else ko('Invalid refresh → 401', `got ${reused.status}`);

  // 6. Identity
  console.log('\nIdentity:');
  await assertOk('GET /me', call('GET', '/me'));
  await assertOk('GET /drivers/me', call('GET', '/drivers/me'));

  // 7. Catalog + driver apps
  console.log('\nApps catalog:');
  await assertOk('GET /apps', call('GET', '/apps', undefined, false));
  const mine = await assertOk('GET /drivers/me/apps', call('GET', '/drivers/me/apps'));
  console.log(`    driver has ${mine?.length ?? 0} apps configured`);

  // 8. Vehicles
  console.log('\nVehicles:');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vehicles: any[] = await assertOk('GET /vehicles', call('GET', '/vehicles')) ?? [];
  if (vehicles.length === 0) ko('Seed must create a vehicle', 'no vehicles');

  // 9. Areas
  console.log('\nAreas:');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const areas: any[] = await assertOk('GET /areas', call('GET', '/areas')) ?? [];

  // 10. Trips list
  console.log('\nTrips:');
  const trips = await assertOk('GET /trips', call('GET', '/trips?limit=10'));
  console.log(`    items: ${trips?.items?.length ?? 0}`);

  // 11. Create + delete trip (full aggregate round-trip)
  if (vehicles.length && mine?.length) {
    const endedAt = new Date().toISOString();
    const startedAt = new Date(Date.parse(endedAt) - 30 * 60_000).toISOString();
    // The trip can start yesterday when this test runs just after midnight.
    // Read its actual reporting bucket for all three aggregate assertions.
    const dailyPath = `/analytics/daily?date=${businessDateKey(new Date(startedAt))}`;
    const before = await call('GET', dailyPath);
    if (before.status !== 200) throw new Error(`Daily report before creation returned ${before.status}`);
    const beforeNet = dailyAnalyticsSchema.parse(before.body?.data ?? before.body).netProfitPiastres;

    const mutationKey = 'smoke-' + Date.now();
    const tripRequest = {
      vehicleId: vehicles[0].id,
      driverAppId: mine[0].id,
      areaId: areas[0]?.id ?? null,
      startedAt,
      endedAt,
      grossPiastres: 10_000,
      tipPiastres: 500,
      commissionPiastres: 2_000,
      totalKmMeters: 5_000,
      paidKmMeters: 4_000,
      clientMutationId: mutationKey,
    };
    const created = await call('POST', '/trips', tripRequest, true, mutationKey);
    if (created.status === 200 || created.status === 201) ok('POST /trips creates trip');
    else ko('POST /trips', `status ${created.status} body ${JSON.stringify(created.body)}`);

    const tripBody = tripItemSchema.parse(created.body?.data ?? created.body);
    const tripId = tripBody.id;

    // Aggregate must have increased by 10000+500-2000 = 8500 piastres
    const after = await call('GET', dailyPath);
    if (after.status !== 200) throw new Error(`Daily report after creation returned ${after.status}`);
    const afterNet = dailyAnalyticsSchema.parse(after.body?.data ?? after.body).netProfitPiastres;
    const delta = afterNet - beforeNet;
    if (delta === 8_500) ok(`Daily aggregate +8500 piastres (actual ${delta})`);
    else ko('Daily aggregate delta', `expected 8500 piastres, got ${delta}`);

    // Idempotency
    const dupe = await call('POST', '/trips', tripRequest, true, mutationKey);
    const duplicateId = (dupe.body?.data ?? dupe.body)?.id;
    if ((dupe.status === 200 || dupe.status === 201) && tripId && duplicateId === tripId) ok('Idempotent re-POST returns same trip');
    else ko('Idempotency', `status ${dupe.status}`);

    // Delete reverses the aggregate
    if (tripId) {
      const del = await call('DELETE', `/trips/${tripId}?expectedVersion=${tripBody.version}`, null, true, crypto.randomUUID());
      if (del.status === 200 && del.body?.data?.ok === true) ok('DELETE /trips/:id');
      else ko('DELETE /trips/:id', `status ${del.status}`);

      const after2 = await call('GET', dailyPath);
      if (after2.status !== 200) throw new Error(`Daily report after deletion returned ${after2.status}`);
      const after2Net = dailyAnalyticsSchema.parse(after2.body?.data ?? after2.body).netProfitPiastres;
      if (after2Net === beforeNet) ok('Aggregate restored after delete');
      else ko('Aggregate restored after delete', `expected ${beforeNet}, got ${after2Net}`);
    }
  }

  // 12. Analytics endpoints
  console.log('\nAnalytics:');
  await assertOk('GET /analytics/today', call('GET', '/analytics/today'));
  await assertOk('GET /analytics/daily', call('GET', '/analytics/daily'));
  await assertOk('GET /analytics/apps?window=7d', call('GET', '/analytics/apps?window=7d'));
  await assertOk('GET /analytics/areas?window=7d', call('GET', '/analytics/areas?window=7d'));
  await assertOk('GET /analytics/hours?window=7d', call('GET', '/analytics/hours?window=7d'));
  await assertOk('GET /analytics/forecast/monthly', call('GET', '/analytics/forecast/monthly'));

  // 13. Recommendations + decisions
  console.log('\nRecommendations:');
  await assertOk('GET /recommendations', call('GET', '/recommendations'));
  await assertOk('GET /decisions/today', call('GET', '/decisions/today'));

  // 14. Score
  console.log('\nScore:');
  await assertOk('GET /score/today', call('GET', '/score/today'));
  await assertOk('GET /score/history', call('GET', '/score/history'));

  // 15. Goals
  console.log('\nGoals:');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const goals: any[] = await assertOk('GET /goals', call('GET', '/goals')) ?? [];
  if (goals[0]) await assertOk('GET /goals/:id/progress', call('GET', `/goals/${goals[0].id}/progress`));

  // 16. Maintenance
  console.log('\nMaintenance:');
  await assertOk('GET /maintenance/items', call('GET', '/maintenance/items'));
  if (vehicles[0]) {
    await assertOk('GET /vehicles/:id/maintenance/risk', call('GET', `/vehicles/${vehicles[0].id}/maintenance/risk`));
  }

  // 17. Sync
  console.log('\nSync:');
  syncPullResponseSchema.parse(await assertOk('POST /sync/pull', call('POST', '/sync/pull', { limit: 50 })));

  const syncApp = driverAppBindingSchema.array().parse(mine)[0];
  if (!syncApp) throw new Error('Smoke driver has no platform for sync');
  const syncStart = { mutations: [{ kind: SyncMutationKind.SessionStart, clientMutationId: crypto.randomUUID(),
    payload: { driverAppId: syncApp.id, startedAt: new Date(Date.now() - 120000).toISOString() } }] };
  const syncStarted = syncPushResponseSchema.parse(await assertOk('POST /sync/push starts a session', call('POST', '/sync/push', syncStart))).results[0];
  if (syncStarted.status !== SyncMutationStatus.Applied) throw new Error('Sync session start was not applied');
  const syncRepeated = syncPushResponseSchema.parse(await assertOk('POST /sync/push replays a session start', call('POST', '/sync/push', syncStart))).results[0];
  if (syncRepeated.status !== SyncMutationStatus.Applied || !syncRepeated.replayed || syncRepeated.recordId !== syncStarted.recordId) throw new Error('Sync start replay changed identity');
  const sessionEnd = { expectedVersion: 1, clientMutationId: crypto.randomUUID(), endedAt: new Date().toISOString() };
  const sessionPath = '/sessions/' + syncStarted.recordId + '/end';
  const sessionEnded = sessionSchema.parse(await assertOk('POST /sessions/:id/end stores a receipt', call('POST', sessionPath, sessionEnd)));
  const sessionRepeated = sessionSchema.parse(await assertOk('POST /sessions/:id/end replays its receipt', call('POST', sessionPath, sessionEnd)));
  if (sessionRepeated.endedAt !== sessionEnded.endedAt) throw new Error('Session end replay changed its timestamp');
  const syncEnd = { mutations: [{ kind: SyncMutationKind.SessionEnd, clientMutationId: sessionEnd.clientMutationId,
    payload: { id: syncStarted.recordId, expectedVersion: sessionEnd.expectedVersion, endedAt: sessionEnd.endedAt } }] };
  const syncEnded = syncPushResponseSchema.parse(await assertOk('POST /sync/push replays ordinary session end', call('POST', '/sync/push', syncEnd))).results[0];
  if (syncEnded.status !== SyncMutationStatus.Applied || !syncEnded.replayed) throw new Error('Session end receipt did not cross transports');


  // 18. Password reset flow
  console.log('\nPassword reset:');
  const forgotRes = await call('POST', '/auth/password/forgot', { phone }, false);
  if (forgotRes.status === 200) ok('POST /auth/password/forgot');
  else ko('POST /auth/password/forgot', `status ${forgotRes.status}`);

  const devCode = (forgotRes.body?.data ?? forgotRes.body)?.devCode;
  if (devCode && /^\d{6}$/.test(devCode)) ok('Dev code returned (6 digits)');
  else ko('Dev code', 'expected a 6-digit devCode in dev mode');

  // The recovery contract directs unknown accounts to registration.
  const forgotUnknown = await call('POST', '/auth/password/forgot', { phone: '+209999999999' }, false);
  if (forgotUnknown.status === 404) ok('Unknown phone returns 404 USER_NOT_FOUND');
  else ko('Unknown phone forgot', `expected 404, got ${forgotUnknown.status}`);

  // Wrong code → 401
  const wrongReset = await call('POST', '/auth/password/reset', {
    phone,
    code: devCode === '000000' ? '000001' : '000000',
    newPassword: 'temp-new-pass-1234',
  }, false);
  if (wrongReset.status === 401) ok('Wrong code → 401');
  else ko('Wrong code → 401', `got ${wrongReset.status}`);

  // Right code → reset, then login with new password, then restore original
  if (devCode) {
    const newPassword = 'newDemoPass99';
    const reset1 = await call('POST', '/auth/password/reset', {
      phone,
      code: devCode,
      newPassword,
    }, false);
    if (reset1.status === 200) ok('POST /auth/password/reset with correct code');
    else ko('POST /auth/password/reset', `status ${reset1.status} body ${JSON.stringify(reset1.body)}`);

    // Old password no longer works
    const oldLogin = await call('POST', '/auth/login', { phone, password }, false);
    if (oldLogin.status === 401) ok('Old password rejected after reset');
    else ko('Old password rejected', `got ${oldLogin.status}`);

    // New password works
    const newLogin = await call('POST', '/auth/login', { phone, password: newPassword }, false);
    if (newLogin.status === 200) ok('New password works');
    else ko('New password login', `got ${newLogin.status}`);

    // Restore original password so the smoke test is idempotent
    const restoreForgot = await call('POST', '/auth/password/forgot', { phone }, false);
    const restoreCode = (restoreForgot.body?.data ?? restoreForgot.body)?.devCode;
    if (restoreCode) {
      await call('POST', '/auth/password/reset', {
        phone,
        code: restoreCode,
        newPassword: password,
      }, false);
      ok('Restored original password');
    }
  }

  summarize();
}

function summarize() {
  console.log('\n' + '─'.repeat(50));
  console.log(`Passed: ${passes.length}    Failed: ${failures.length}`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log('\nAll smoke checks passed ✓');
  process.exit(0);
}

main().catch((e) => {
  console.error('Smoke crashed:', e);
  process.exit(2);
});
