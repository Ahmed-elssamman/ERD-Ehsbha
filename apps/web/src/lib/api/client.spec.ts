import axios, { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/stores/auth.store';
import { api } from './client';

interface SessionState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

const fixture = vi.hoisted(() => ({
  state: { user: null, accessToken: null, refreshToken: null } as SessionState,
  setSession: vi.fn<(state: SessionState) => void>(),
  clear: vi.fn<() => void>(),
}));
vi.mock('@/stores/auth.store', () => ({
  useAuth: { getState: () => ({ ...fixture.state, setSession: fixture.setSession, clear: fixture.clear }) },
}));

const driver: AuthUser = { id: 'driver-a', phone: '+201000000001', locale: 'ar', timezone: 'Africa/Cairo', driverId: 'profile-a' };
const refreshed = {
  data: { user: driver, accessToken: 'test-refreshed-access', refreshToken: 'test-refreshed-session' },
  meta: { requestId: 'test-request-id-0001', serverTime: '2026-09-17T00:00:00.000Z', apiVersion: 'v1', contractVersion: '2.0.0' },
};
const response: AxiosResponse<typeof refreshed> = {
  data: refreshed, status: 200, statusText: 'OK', headers: {}, config: { headers: new AxiosHeaders() },
};
const originalAdapter = api.defaults.adapter;

describe('Driver refresh account boundaries', () => {
  beforeEach(() => {
    fixture.state = { user: driver, accessToken: 'test-expired-access', refreshToken: 'test-original-session' };
    fixture.setSession.mockReset(); fixture.clear.mockReset();
    api.defaults.adapter = async (config) => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
        status: 401, data: {}, statusText: 'Unauthorized', headers: {}, config,
      });
    };
  });
  afterEach(() => { api.defaults.adapter = originalAdapter; vi.restoreAllMocks(); });

  it('does not restore a session when refresh finishes after logout', async () => {
    let finish = (value: AxiosResponse<typeof refreshed>): void => { void value; };
    const pending = new Promise<AxiosResponse<typeof refreshed>>((resolve) => { finish = resolve; });
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(pending);
    const rejected = expect(api.get('/trips')).rejects.toBeInstanceOf(AxiosError);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    fixture.state = { user: null, accessToken: null, refreshToken: null };
    finish(response);
    await rejected;
    expect(fixture.setSession).not.toHaveBeenCalled();
    expect(fixture.clear).not.toHaveBeenCalled();
  });

  it('does not clear a new account when the previous refresh fails', async () => {
    let fail = (error: Error): void => { void error; };
    const pending = new Promise<AxiosResponse<typeof refreshed>>((_resolve, reject) => { fail = reject; });
    const refresh = vi.spyOn(axios, 'post').mockReturnValue(pending);
    const rejected = expect(api.get('/trips')).rejects.toBeInstanceOf(AxiosError);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    fixture.state = { user: { ...driver, id: 'driver-b' }, accessToken: 'test-account-b-access', refreshToken: 'test-account-b-session' };
    fail(new Error('Refresh failed'));
    await rejected;
    expect(fixture.setSession).not.toHaveBeenCalled();
    expect(fixture.clear).not.toHaveBeenCalled();
    expect(fixture.state.user?.id).toBe('driver-b');
  });

  it('does not refresh the current account for a failed login attempt', async () => {
    const refresh = vi.spyOn(axios, 'post');
    await expect(api.post('/auth/login', { phone: driver.phone, password: 'test-wrong-password' })).rejects.toBeInstanceOf(AxiosError);
    expect(refresh).not.toHaveBeenCalled();
    expect(fixture.clear).not.toHaveBeenCalled();
  });

  it('preserves the account and local records when refresh cannot reach the server', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('Offline', 'ERR_NETWORK'));
    await expect(api.get('/trips')).rejects.toMatchObject({ code: 'ERR_NETWORK' });
    expect(fixture.clear).not.toHaveBeenCalled();
    expect(fixture.setSession).not.toHaveBeenCalled();
  });

  it('clears the current session when the server rejects the refresh credential', async () => {
    vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('Expired', 'ERR_BAD_REQUEST', response.config, null, { ...response, status: 401 }));
    await expect(api.get('/trips')).rejects.toBeInstanceOf(AxiosError);
    expect(fixture.clear).toHaveBeenCalledOnce();
  });

  it.each([408, 429, 503])('preserves local records when refresh returns retryable HTTP %s', async (status) => {
    vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('Retry later', 'ERR_BAD_RESPONSE', response.config, null, { ...response, status }));
    await expect(api.get('/trips')).rejects.toMatchObject({ response: { status } });
    expect(fixture.clear).not.toHaveBeenCalled();
  });
});
