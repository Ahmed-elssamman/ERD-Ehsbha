import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '@/stores/auth.store';
import { driverAuthResultSchema } from '@ehsbha/api-contracts';
import { parseData } from '@/features/platform-api';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

export const apiBaseUrl = API_URL;

interface AccountRequestConfig extends InternalAxiosRequestConfig {
  accountId?: string | null;
  __retry?: boolean;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: AccountRequestConfig) => {
  const state = useAuth.getState();
  const accessToken = state.accessToken;
  config.accountId = state.user?.id ?? null;
  if (accessToken) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
  } else {
    config.headers.delete('Authorization');
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError<{ error?: { code?: string; message?: string } }>) => {
    const original = err.config as AccountRequestConfig | null;
    if (!original || err.response?.status !== 401 || original.__retry) {
      throw err;
    }
    const state = useAuth.getState();
    if (original.url?.startsWith('/auth/') || original.accountId !== (state.user?.id ?? null)) throw err;
    if (!state.refreshToken) {
      state.clear();
      throw err;
    }
    original.__retry = true;

    if (!refreshing) {
      refreshing = (async () => {
        try {
          const resp = await axios.post(
            `${API_URL}/auth/refresh`,
            { refreshToken: state.refreshToken },
            { timeout: 15_000 },
          );
          const data = parseData(driverAuthResultSchema, resp.data, 'driver.auth.refresh');
          if (useAuth.getState().refreshToken !== state.refreshToken) return null;
          useAuth.getState().setSession({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
          return data.accessToken;
        } catch (error) {
          if (axios.isAxiosError(error)) {
            const status = error.response?.status ?? null;
            if (status === null || status === 408 || status === 429 || status >= 500) throw error;
          }
          if (useAuth.getState().refreshToken === state.refreshToken) useAuth.getState().clear();
          return null;
        }
      })().finally(() => {
        refreshing = null;
      });
    }

    const newAccess = await refreshing;
    if (!newAccess || original.accountId !== (useAuth.getState().user?.id ?? null)) throw err;
    original.headers = original.headers ?? {};
    (original.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;
    return api.request(original);
  },
);

export interface ApiErrorShape {
  code: string;
  message: string;
}

/** Pulls a clean error code/message out of an axios error from this backend. */
export function readApiError(err: unknown): ApiErrorShape {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data;
    if (
      body !== null
      && typeof body === 'object'
      && 'error' in body
      && body.error !== null
      && typeof body.error === 'object'
      && 'code' in body.error
      && 'message' in body.error
      && typeof body.error.code === 'string'
      && typeof body.error.message === 'string'
    ) {
      return { code: body.error.code, message: body.error.message };
    }
    if (err.code === 'ERR_NETWORK' || !err.response) {
      return { code: 'NETWORK', message: 'Network unreachable' };
    }
    return { code: 'UNKNOWN', message: err.message };
  }
  return { code: 'UNKNOWN', message: 'Unknown error' };
}
