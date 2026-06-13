import axios, { AxiosError, type AxiosInstance } from 'axios';
import { adminAuthSessionSchema } from '@ehsbha/api-contracts';
import { parseData } from '@/features/platform-api';
import { useAdminAuth } from '@/stores/admin-auth.store';

const baseURL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const adminApi: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

adminApi.interceptors.request.use((config) => {
  const session = useAdminAuth.getState().session;
  if (session) config.headers.set('Authorization', `Bearer ${session.accessToken}`);
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
    useAdminAuth.getState().setSession({
      ...session,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return data.accessToken;
  } catch {
    useAdminAuth.getState().clearSession();
    return null;
  }
}

adminApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !retriedRequests.has(original)) {
      retriedRequests.add(original);
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      const newToken = await refreshInFlight;
      if (newToken) {
        original.headers.set('Authorization', `Bearer ${newToken}`);
        return adminApi.request(original);
      }
      window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);
