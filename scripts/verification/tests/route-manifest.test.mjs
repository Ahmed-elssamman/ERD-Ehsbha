import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { tmpdir } from 'os';
import { extractRoutes } from '../lib/extract-routes.mjs';

const fixtureDirectory = resolve(tmpdir(), `ehsbha-route-extractor-${process.pid}`);
const fixturePath = resolve(fixtureDirectory, 'router.tsx');

const fixture = `
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardPage } from '@/pages/dashboard';
const LoginPage = lazyWithRetry(() => import('@/pages/login').then((m) => ({ default: m.LoginPage })));
const TripPage = lazyWithRetry(() => import('@/pages/trip').then((m) => ({ default: m.TripPage })));
const gate = (permission, element) => <RequirePermission permission={permission}>{element}</RequirePermission>;

createBrowserRouter([
  { path: '/login', element: <GuestRoute><LoginPage /></GuestRoute> },
  {
    path: '/',
    element: <ProtectedRoute><Layout /></ProtectedRoute>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'trips/:id', element: gate('trips.read', <TripPage />) },
      { path: 'old', element: <Navigate to="/trips" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '/duplicate', element: <DashboardPage /> },
  { path: '/duplicate', element: <DashboardPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
`;

describe('production route extractor', () => {
  let result;

  before(async () => {
    mkdirSync(fixtureDirectory, { recursive: true });
    writeFileSync(fixturePath, fixture, 'utf-8');
    result = await extractRoutes(fixturePath);
  });

  after(() => rmSync(fixtureDirectory, { recursive: true, force: true }));

  it('resolves nested and index routes to full paths', () => {
    assert.ok(result.routes.some((route) => route.path === '/' && route.isIndex));
    assert.ok(result.routes.some((route) => route.path === '/trips/:id'));
  });

  it('detects nested and root catch-all routes', () => {
    const catchAllRoutes = result.routes.filter((route) => route.isCatchAll);
    assert.equal(catchAllRoutes.length, 2);
    assert.ok(catchAllRoutes.every((route) => route.path === '/*'));
  });

  it('resolves separately declared lazy modules', () => {
    const login = result.routes.find((route) => route.path === '/login');
    const trip = result.routes.find((route) => route.path === '/trips/:id');
    assert.equal(login.modulePath, '@/pages/login');
    assert.equal(login.isLazy, true);
    assert.equal(trip.modulePath, '@/pages/trip');
    assert.equal(trip.isLazy, true);
  });

  it('distinguishes static modules from lazy modules', () => {
    const dashboard = result.routes.find((route) => route.path === '/' && route.isIndex);
    assert.equal(dashboard.modulePath, '@/pages/dashboard');
    assert.equal(dashboard.isLazy, false);
  });

  it('inherits parent protection and extracts permission gates', () => {
    const trip = result.routes.find((route) => route.path === '/trips/:id');
    assert.equal(trip.guarded, true);
    assert.equal(trip.permission, 'trips.read');
  });

  it('detects redirects', () => {
    const redirect = result.routes.find((route) => route.path === '/old');
    assert.equal(redirect.isRedirect, true);
    assert.equal(redirect.redirectTo, '/trips');
  });

  it('retains and marks duplicate sibling paths', () => {
    const duplicates = result.routes.filter((route) => route.path === '/duplicate');
    assert.equal(duplicates.length, 2);
    assert.equal(duplicates[0].isDuplicate, false);
    assert.equal(duplicates[1].isDuplicate, true);
  });
});
