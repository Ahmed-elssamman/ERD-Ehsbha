import { useEffect, useState } from 'react';
import { businessDateKey, businessDay } from '@ehsbha/shared-types';

/** Refresh calendar queries at Cairo midnight and when a suspended tab returns. */
export function useBusinessDate(): string {
  const [date, setDate] = useState(() => businessDateKey(new Date()));
  useEffect(() => {
    const refresh = () => setDate(businessDateKey(new Date()));
    const delay = Math.max(1, businessDay(date).end.getTime() - Date.now() + 1);
    const timer = window.setTimeout(refresh, delay);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [date]);
  return date;
}
