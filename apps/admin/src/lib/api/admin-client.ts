import axios, { AxiosError, type AxiosInstance, type AxiosResponse } from 'axios';
import { useAdminAuth } from '@/stores/admin-auth.store';

const baseURL = import.meta.env.VITE_API_URL ?? '/api/v1';

export const adminApi: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Unwrap the backend's `{ data, meta }` envelope automatically so every
// caller sees the real payload at response.data.
function unwrapEnvelope(response: AxiosResponse): AxiosResponse {
  const body = response.data;
  if (
    body &&
    typeof body === 'object' &&
    'data' in body &&
    'meta' in body &&
    !('error' in body)
  ) {
    response.data = (body as { data: unknown }).data;
  }
  return response;
}

adminApi.interceptors.request.use((config) => {
  const session = useAdminAuth.getState().session;
  if (session) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const session = useAdminAuth.getState().session;
  if (!session) return null;
  try {
    const resp = await axios.post(`${baseURL}/admin/auth/refresh`, {
      refreshToken: session.refreshToken,
    });
    // Manual unwrap — this call doesn't go through the instance interceptor.
    const body = resp.data;
    const data =
      body && typeof body === 'object' && 'data' in body && 'meta' in body
        ? (body as { data: { accessToken?: string; refreshToken?: string } }).data
        : (body as { accessToken?: string; refreshToken?: string });
    if (data?.accessToken && data?.refreshToken) {
      useAdminAuth.getState().setSession({
        ...session,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      return data.accessToken;
    }
    return null;
  } catch {
    useAdminAuth.getState().clearSession();
    return null;
  }
}

adminApi.interceptors.response.use(
  (r) => unwrapEnvelope(r),
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    if (status === 401 && original && !original._retried) {
      original._retried = true;
      refreshInFlight ??= refreshAccessToken().finally(() => (refreshInFlight = null));
      const newToken = await refreshInFlight;
      if (newToken) {
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return adminApi.request(original);
      }
      window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);
