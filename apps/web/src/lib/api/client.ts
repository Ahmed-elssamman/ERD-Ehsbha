import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { useAuth } from '@/stores/auth.store';
import { driverAuthResultSchema } from '@ehsbha/api-contracts';
import { parseData } from '@/features/platform-api';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000/api/v1';

export const apiBaseUrl = API_URL;

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError<{ error?: { code?: string; message?: string } }>) => {
    const original = err.config as (InternalAxiosRequestConfig & { __retry?: boolean }) | undefined;
    if (!original || err.response?.status !== 401 || original.__retry) {
      throw err;
    }
    const state = useAuth.getState();
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
          useAuth.getState().setSession({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
          return data.accessToken;
        } catch {
          useAuth.getState().clear();
          return null;
        } finally {
          // released below
        }
      })().finally(() => {
        refreshing = null;
      });
    }

    const newAccess = await refreshing;
    if (!newAccess) throw err;
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
