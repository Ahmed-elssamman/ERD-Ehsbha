import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { useAuth } from '@/stores/auth.store';

const apiUrl =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  'http://10.0.2.2:4000/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: apiUrl,
  timeout: 15_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuth.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError<any>) => {
    const original = err.config as InternalAxiosRequestConfig & { __retry?: boolean };
    if (err.response?.status !== 401 || !original || original.__retry) {
      throw err;
    }
    const state = useAuth.getState();
    if (!state.refreshToken) {
      await state.clear();
      throw err;
    }
    original.__retry = true;

    if (!refreshing) {
      refreshing = (async () => {
        try {
          const resp = await axios.post(`${apiUrl}/auth/refresh`, {
            refreshToken: state.refreshToken,
          });
          const data = resp.data?.data ?? resp.data;
          await useAuth.getState().setSession({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
          return data.accessToken as string;
        } catch {
          await useAuth.getState().clear();
          return null;
        }
      })().finally(() => {
        refreshing = null;
      });
    }

    const newAccess = await refreshing;
    if (!newAccess) throw err;
    (original.headers as any).Authorization = `Bearer ${newAccess}`;
    return api.request(original);
  },
);

export function unwrap<T>(payload: any): T {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data as T;
  return payload as T;
}
