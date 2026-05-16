import axios, { AxiosError } from 'axios';
import { getLocale } from '@/i18n';

interface ErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

const MESSAGES: Record<string, { ar: string; en: string }> = {
  // Network layer
  NETWORK_OFFLINE: {
    ar: 'مفيش إنترنت — اتأكد من الاتصال وحاول تاني',
    en: 'No internet — check your connection',
  },
  API_UNREACHABLE: {
    ar: 'مش قادرين نوصل للسيرفر. لو بتجرّب من الموبايل، اتأكد إن الـ API URL في الإعدادات بتاع موبايلك يحتوي على IP الكمبيوتر (مثلاً 192.168.x.x) مش localhost',
    en: 'Can\'t reach the server. If testing on a phone, make sure EXPO_PUBLIC_API_URL points to your PC\'s LAN IP (e.g. 192.168.x.x), not localhost',
  },
  TIMEOUT: {
    ar: 'الطلب أخد وقت أكتر من اللازم — السيرفر بطيء أو الإنترنت ضعيف',
    en: 'Request timed out — server slow or connection weak',
  },
  SERVER_ERROR: {
    ar: 'في مشكلة في السيرفر دلوقتي — حاول تاني بعد دقيقة',
    en: 'Server problem — try again in a minute',
  },
  RATE_LIMITED: {
    ar: 'حاولت بسرعة كتير — استنى شوية وارجع جرب',
    en: 'Too many attempts — wait a bit and try again',
  },

  // Auth
  INVALID_CREDENTIALS: { ar: 'رقم الموبايل أو كلمة السر غلط', en: 'Wrong phone or password' },
  PHONE_TAKEN: { ar: 'الرقم ده مسجّل عندنا بحساب تاني', en: 'Phone already registered' },
  REFRESH_INVALID: { ar: 'الجلسة انتهت — سجّل دخول تاني', en: 'Session expired — please log in again' },
  REFRESH_REUSED: { ar: 'حصلت مشكلة أمان — تم تسجيل خروج من كل أجهزتك', en: 'Security issue — all sessions ended' },
  REFRESH_EXPIRED: { ar: 'الجلسة انتهت — سجّل دخول تاني', en: 'Session expired — please log in again' },
  UNAUTHORIZED: { ar: 'محتاج تسجّل دخول الأول', en: 'You need to log in first' },
  FORBIDDEN: { ar: 'مش مسموحلك تعمل ده', en: 'Not allowed' },

  // Validation
  VALIDATION_ERROR: { ar: 'البيانات اللي دخلتها فيها حاجة غلط', en: 'Some fields are invalid' },
  BAD_REQUEST: { ar: 'الطلب فيه مشكلة', en: 'Request has a problem' },
  UNPROCESSABLE: { ar: 'البيانات اللي دخلتها فيها حاجة غلط', en: 'Invalid data' },

  // Domain
  TRIP_NOT_FOUND: { ar: 'الرحلة دي مش موجودة', en: 'Trip not found' },
  TRIP_OVERLAP: { ar: 'فيه رحلة متداخلة معاها في نفس الوقت', en: 'Another trip overlaps this time' },
  VEHICLE_NOT_FOUND: { ar: 'العربية دي مش موجودة', en: 'Vehicle not found' },
  AREA_NOT_FOUND: { ar: 'المنطقة دي مش موجودة', en: 'Area not found' },
  DRIVER_APP_NOT_FOUND: { ar: 'التطبيق ده مش متفعّل عندك', en: 'App not configured' },
  DRIVER_APP_DUPLICATE: { ar: 'التطبيق ده مضاف قبل كده', en: 'App already added' },
  SESSION_NOT_FOUND: { ar: 'الشيفت ده مش موجود', en: 'Session not found' },
  SESSION_ALREADY_OPEN: { ar: 'فيه شيفت شغّال — اقفله الأول', en: 'You have an open session — end it first' },
  SESSION_ALREADY_ENDED: { ar: 'الشيفت ده مقفول بالفعل', en: 'Session already ended' },
  FUEL_NOT_FOUND: { ar: 'تسجيل البنزين ده مش موجود', en: 'Fuel log not found' },
  EXPENSE_NOT_FOUND: { ar: 'المصروف ده مش موجود', en: 'Expense not found' },
  GOAL_NOT_FOUND: { ar: 'الهدف ده مش موجود', en: 'Goal not found' },
  RECOMMENDATION_NOT_FOUND: { ar: 'التوصية دي مش موجودة', en: 'Recommendation not found' },
  NOTIFICATION_NOT_FOUND: { ar: 'الإشعار ده مش موجود', en: 'Notification not found' },

  // Prisma / DB
  DUPLICATE: { ar: 'البيانات دي مسجّلة قبل كده', en: 'Already exists' },
  NOT_FOUND: { ar: 'مش موجود', en: 'Not found' },
  FOREIGN_KEY: { ar: 'فيه بيانات مرتبطة مش موجودة', en: 'Related data missing' },
  DB_ERROR: { ar: 'في مشكلة في قاعدة البيانات', en: 'Database error' },

  // Default
  INTERNAL_ERROR: { ar: 'في مشكلة عندنا — جرب تاني بعد شوية', en: 'Something went wrong on our side' },
  UNKNOWN: { ar: 'حصل خطأ غير متوقع', en: 'Unexpected error' },
};

export interface UserError {
  code: string;
  title: string;
  message: string;
  isNetwork: boolean;
  rawMessage?: string;
}

export function toUserError(err: unknown): UserError {
  const locale = getLocale();
  const pick = (code: string): string => {
    const m = MESSAGES[code];
    if (!m) return code;
    return m[locale];
  };

  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<{ error?: ErrorPayload }>;

    // No response — network error
    if (!ax.response) {
      if (ax.code === 'ECONNABORTED' || /timeout/i.test(ax.message)) {
        return {
          code: 'TIMEOUT',
          title: locale === 'ar' ? 'انتهت المهلة' : 'Timeout',
          message: pick('TIMEOUT'),
          isNetwork: true,
          rawMessage: ax.message,
        };
      }
      if (ax.code === 'ERR_NETWORK' || /network/i.test(ax.message)) {
        return {
          code: 'API_UNREACHABLE',
          title: locale === 'ar' ? 'مش قادرين نوصل للسيرفر' : 'Server unreachable',
          message: pick('API_UNREACHABLE'),
          isNetwork: true,
          rawMessage: ax.message,
        };
      }
      return {
        code: 'NETWORK_OFFLINE',
        title: locale === 'ar' ? 'مفيش اتصال' : 'Offline',
        message: pick('NETWORK_OFFLINE'),
        isNetwork: true,
        rawMessage: ax.message,
      };
    }

    const status = ax.response.status;
    const apiErr = ax.response.data?.error;
    const code = apiErr?.code ?? statusToCode(status);
    const title = locale === 'ar' ? titleFor(code, 'ar') : titleFor(code, 'en');

    return {
      code,
      title,
      message: pick(code) || apiErr?.message || pick('UNKNOWN'),
      isNetwork: false,
      rawMessage: apiErr?.message,
    };
  }

  if (err instanceof Error) {
    return {
      code: 'UNKNOWN',
      title: locale === 'ar' ? 'في مشكلة' : 'Error',
      message: pick('UNKNOWN'),
      isNetwork: false,
      rawMessage: err.message,
    };
  }

  return {
    code: 'UNKNOWN',
    title: locale === 'ar' ? 'في مشكلة' : 'Error',
    message: pick('UNKNOWN'),
    isNetwork: false,
  };
}

function statusToCode(status: number): string {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'DUPLICATE';
  if (status === 422) return 'UNPROCESSABLE';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'SERVER_ERROR';
  return 'UNKNOWN';
}

function titleFor(code: string, locale: 'ar' | 'en'): string {
  const titles: Record<string, { ar: string; en: string }> = {
    INVALID_CREDENTIALS: { ar: 'تسجيل دخول فاشل', en: 'Login failed' },
    PHONE_TAKEN: { ar: 'الرقم مسجّل قبل كده', en: 'Phone taken' },
    VALIDATION_ERROR: { ar: 'بيانات غير صحيحة', en: 'Invalid data' },
    SERVER_ERROR: { ar: 'مشكلة في السيرفر', en: 'Server error' },
    UNAUTHORIZED: { ar: 'سجّل دخول', en: 'Login required' },
    FORBIDDEN: { ar: 'غير مسموح', en: 'Not allowed' },
    RATE_LIMITED: { ar: 'بطّأ شوية', en: 'Slow down' },
    NOT_FOUND: { ar: 'مش موجود', en: 'Not found' },
    DUPLICATE: { ar: 'مسجّل قبل كده', en: 'Already exists' },
  };
  return titles[code]?.[locale] ?? (locale === 'ar' ? 'في مشكلة' : 'Error');
}

export function showErrorAlert(err: unknown, AlertImpl?: { alert: (t: string, m?: string) => void }): UserError {
  const ue = toUserError(err);
  const { Alert } = require('react-native');
  const A = AlertImpl ?? Alert;
  A.alert(ue.title, ue.message);
  if (__DEV__ && ue.rawMessage) {
    // eslint-disable-next-line no-console
    console.log('[error]', ue.code, '-', ue.rawMessage);
  }
  return ue;
}
