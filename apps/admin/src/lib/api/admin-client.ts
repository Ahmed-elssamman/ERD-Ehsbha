import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { adminAuthSessionSchema } from '@ehsbha/api-contracts';
import { parseData } from '@/features/platform-api';
import { useAdminAuth } from '@/stores/admin-auth.store';

const baseURL = import.meta.env.VITE_API_URL ?? '/api/v1';

interface AccountRequestConfig extends InternalAxiosRequestConfig {
  accountId?: string | null;
}

export const adminApi: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

adminApi.interceptors.request.use((config: AccountRequestConfig) => {
  const session = useAdminAuth.getState().session;
  config.accountId = session?.admin.id ?? null;
  if (session) config.headers.set('Authorization', `Bearer ${session.accessToken}`);
  else config.headers.delete('Authorization');
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;
const retriedRequests = new WeakSet<object>();

async function refreshAccessToken(): Promise<string | null> {
  const session = useAdminAuth.getState().session;
  if (!session) return null;
  try {
    const response = await axios.post(`${baseURL}/admin/auth/refresh`, {
      refreshToken: session.refreshToken,
    });
    const data = parseData(
      adminAuthSessionSchema,
      response.data,
      'admin.auth.refresh',
    );
    if (useAdminAuth.getState().session?.refreshToken !== session.refreshToken) return null;
    useAdminAuth.getState().setSession({
      ...session,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return data.accessToken;
  } catch {
    if (useAdminAuth.getState().session?.refreshToken === session.refreshToken) {
      useAdminAuth.getState().clearSession();
    }
    return null;
  }
}

adminApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as AccountRequestConfig | null;
    if (original?.url?.startsWith('/admin/auth/')
      || original?.accountId !== (useAdminAuth.getState().session?.admin.id ?? null)) throw error;
    if (error.response?.status === 401 && original && !retriedRequests.has(original)) {
      retriedRequests.add(original);
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      const newToken = await refreshInFlight;
      if (newToken && original.accountId === (useAdminAuth.getState().session?.admin.id ?? null)) {
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return adminApi.request(original);
      }
      if (!useAdminAuth.getState().session) window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);
