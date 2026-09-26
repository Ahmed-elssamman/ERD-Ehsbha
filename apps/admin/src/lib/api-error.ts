import axios from 'axios';
import { parseFailureResponse } from '@ehsbha/api-contracts/core';

export interface ApiError {
  code: string;
  message: string;
}

export function readApiError(err: unknown, fallback = 'Something went wrong'): ApiError {
  if (axios.isAxiosError(err)) {
    const parsed = parseFailureResponse(err.response?.data);
    if (parsed.kind === 'failure') return { code: parsed.code, message: parsed.message };
    if (parsed.kind === 'contract-mismatch') {
      return {
        code: 'CONTRACT_VERSION_MISMATCH',
        message: `Unsupported contract version ${parsed.receivedVersion}`,
      };
    }
    if (err.code === 'ERR_NETWORK' || !err.response) {
      return { code: 'NETWORK', message: 'Network unreachable' };
    }
    return { code: 'UNKNOWN', message: err.message || fallback };
  }
  return { code: 'UNKNOWN', message: fallback };
}
