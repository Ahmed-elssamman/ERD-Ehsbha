import axios, { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/stores/admin-auth.store';
import { adminApi } from './admin-client';

const fixture = vi.hoisted(() => ({
  session: null as AdminSession | null,
  setSession: vi.fn<(session: AdminSession) => void>(),
  clearSession: vi.fn<() => void>(),
}));
vi.mock('@/stores/admin-auth.store', () => ({
  useAdminAuth: { getState: () => ({ session: fixture.session, setSession: fixture.setSession, clearSession: fixture.clearSession }) },
}));

const original: AdminSession = {
  accessToken: 'test-admin-access', refreshToken: 'test-admin-session',
  admin: { id: 'admin-a', email: 'test@example.invalid', displayName: 'Test admin', roles: [], permissions: [] },
};
const refreshed = {
  data: { ...original, mfaRequired: false, accessToken: 'test-new-access', refreshToken: 'test-new-session' },
  meta: { requestId: 'test-request-id-0001', serverTime: '2026-09-17T00:00:00.000Z', apiVersion: 'v1', contractVersion: '2.0.0' },
};
const response: AxiosResponse<typeof refreshed> = {
  data: refreshed, status: 200, statusText: 'OK', headers: {}, config: { headers: new AxiosHeaders() },
};
const originalAdapter = adminApi.defaults.adapter;

describe('Admin refresh account boundaries', () => {
  beforeEach(() => {
    fixture.session = original;
    fixture.setSession.mockReset(); fixture.clearSession.mockReset();
    vi.stubGlobal('window', { location: { assign: vi.fn() } });
    adminApi.defaults.adapter = async (config) => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
        status: 401, data: {}, statusText: 'Unauthorized', headers: {}, config,
      });
    };
  });
  afterEach(() => { adminApi.defaults.adapter = originalAdapter; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('does not restore a session after logout', async () => {
    let finish = (value: AxiosResponse<typeof refreshed>): void => { void value; };
    const pending = new Promise<AxiosResponse<typeof refreshed>>((resolve) => { finish = resolve; });
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(pending);
    const rejected = expect(adminApi.get('/admin/users')).rejects.toBeInstanceOf(AxiosError);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    fixture.session = null;
    finish(response);
    await rejected;
    expect(fixture.setSession).not.toHaveBeenCalled();
    expect(fixture.clearSession).not.toHaveBeenCalled();
  });

  it('preserves a new account after a previous refresh failure', async () => {
    let fail = (error: Error): void => { void error; };
    const pending = new Promise<AxiosResponse<typeof refreshed>>((_resolve, reject) => { fail = reject; });
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(pending);
    const rejected = expect(adminApi.get('/admin/users')).rejects.toBeInstanceOf(AxiosError);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    fixture.session = { ...original, refreshToken: 'test-account-b-session', admin: { ...original.admin, id: 'admin-b' } };
    fail(new Error('Refresh failed'));
    await rejected;
    expect(fixture.clearSession).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it('does not refresh on a failed login', async () => {
    const refresh = vi.spyOn(axios, 'post');
    await expect(adminApi.post('/admin/auth/login', { email: original.admin.email, password: 'test-wrong-password' }))
      .rejects.toBeInstanceOf(AxiosError);
    expect(refresh).not.toHaveBeenCalled();
  });
});
