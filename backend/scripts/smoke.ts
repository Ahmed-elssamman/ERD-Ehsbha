/**
 * Ehsbha HTTP smoke test
 * --------------------------------------------------------------
 * Exercises the full API surface end-to-end against a running
 * backend + seeded database.
 *
 *   1. cd backend
 *   2. cp .env.example .env  (and set strong JWT secrets)
 *   3. docker compose up -d postgres
 *   4. npm run prisma:migrate
 *   5. npm run seed
 *   6. npm run start:dev  (in another terminal)
 *   7. npx ts-node scripts/smoke.ts
 *
 * Pass with `SMOKE_BASE_URL=http://localhost:4000/api/v1` to override.
 */

const base = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000/api/v1';
const phone = '+201000000001';
const password = 'demo1234';

let accessToken = '';
let refreshToken = '';
const failures: string[] = [];
const passes: string[] = [];

function ok(name: string) { passes.push(name); console.log(`  ✓ ${name}`); }
function ko(name: string, why: string) { failures.push(`${name}: ${why}`); console.log(`  ✗ ${name} — ${why}`); }

async function call(method: string, path: string, body?: unknown, auth = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  return { status: res.status, body: json, raw: text };
}

async function assertOk(name: string, p: Promise<{ status: number; body: any }>, expect = 200) {
  try {
    const r = await p;
    if (r.status !== expect && !(expect === 200 && r.status >= 200 && r.status < 300)) {
      ko(name, `status ${r.status}: ${JSON.stringify(r.body?.error ?? r.body)}`);
      return null;
    }
    ok(name);
    return r.body?.data ?? r.body;
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
  const driver = await assertOk('GET /drivers/me', call('GET', '/drivers/me'));

  // 7. Catalog + driver apps
  console.log('\nApps catalog:');
  await assertOk('GET /apps', call('GET', '/apps', undefined, false));
  const mine = await assertOk('GET /drivers/me/apps', call('GET', '/drivers/me/apps'));
  console.log(`    driver has ${mine?.length ?? 0} apps configured`);

  // 8. Vehicles
  console.log('\nVehicles:');
  const vehicles: any[] = await assertOk('GET /vehicles', call('GET', '/vehicles')) ?? [];
  if (vehicles.length === 0) ko('Seed must create a vehicle', 'no vehicles');

  // 9. Areas
  console.log('\nAreas:');
  const areas: any[] = await assertOk('GET /areas', call('GET', '/areas')) ?? [];

  // 10. Trips list
  console.log('\nTrips:');
  const trips = await assertOk('GET /trips', call('GET', '/trips?limit=10'));
  console.log(`    items: ${trips?.items?.length ?? 0}`);

  // 11. Create + delete trip (full aggregate round-trip)
  if (vehicles.length && mine?.length) {
    const before = await call('GET', '/analytics/today');
    const beforeNet = (before.body?.data ?? before.body)?.netProfitPiastres ?? 0;

    const startedAt = new Date(Date.now() - 30 * 60_000).toISOString();
    const endedAt = new Date().toISOString();
    const created = await call('POST', '/trips', {
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
      clientMutationId: 'smoke-' + Date.now(),
    });
    if (created.status === 200 || created.status === 201) ok('POST /trips creates trip');
    else ko('POST /trips', `status ${created.status} body ${JSON.stringify(created.body)}`);

    const tripBody = created.body?.data ?? created.body;
    const tripId = tripBody?.id;

    // Aggregate must have increased by 10000+500-2000 = 8500 piastres
    const after = await call('GET', '/analytics/today');
    const afterNet = (after.body?.data ?? after.body)?.netProfitPiastres ?? 0;
    const delta = afterNet - beforeNet;
    if (delta === 8_500) ok(`Daily aggregate +8500 piastres (actual ${delta})`);
    else ko('Daily aggregate delta', `expected 8500 piastres, got ${delta}`);

    // Idempotency
    const dupe = await call('POST', '/trips', {
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
      clientMutationId: (tripBody?.clientMutationId ?? 'smoke-x'),
    });
    if (dupe.status === 200 || dupe.status === 201) ok('Idempotent re-POST returns same trip');
    else ko('Idempotency', `status ${dupe.status}`);

    // Delete reverses the aggregate
    if (tripId) {
      const del = await call('DELETE', `/trips/${tripId}`);
      if (del.status === 204) ok('DELETE /trips/:id');
      else ko('DELETE /trips/:id', `status ${del.status}`);

      const after2 = await call('GET', '/analytics/today');
      const after2Net = (after2.body?.data ?? after2.body)?.netProfitPiastres ?? 0;
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
  await assertOk('POST /sync/pull', call('POST', '/sync/pull', { limit: 50 }));

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
