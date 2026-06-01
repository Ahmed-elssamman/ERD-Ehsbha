import axios from 'axios';

export interface ApiError {
  code: string;
  message: string;
}

export function readApiError(err: unknown, fallback = 'Something went wrong'): ApiError {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as
      | { error?: ApiError; message?: string; code?: string }
      | undefined;
    if (body?.error?.code) return body.error;
    if (body?.code && body?.message) return { code: body.code, message: body.message };
    if (err.code === 'ERR_NETWORK' || !err.response) {
      return { code: 'NETWORK', message: 'Network unreachable' };
    }
    return { code: 'UNKNOWN', message: body?.message ?? err.message ?? fallback };
  }
  return { code: 'UNKNOWN', message: fallback };
}
