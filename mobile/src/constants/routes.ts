import type { Href } from 'expo-router';

export const ROUTES = {
  LOGIN: '/(auth)/login',
  REGISTER: '/(auth)/register',
  FORGOT: '/(auth)/forgot',
  RESET: '/(auth)/reset',
  WELCOME: '/(auth)/welcome',

  HOME: '/(tabs)/home',
  TRIPS: '/(tabs)/trips',
  PROFILE: '/(tabs)/profile',

  TRIP_NEW: '/trips/new',
  TRIP_DETAIL: '/trips/[id]',

  VEHICLE_NEW: '/vehicles/new',

  APPS: '/apps',
  AREAS: '/areas',
  GOALS: '/goals',
  DECISIONS: '/decisions',

  MAINTENANCE: '/maintenance',
  MAINTENANCE_NEW: '/maintenance/new',
  MAINTENANCE_COSTS: '/maintenance/costs',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];

type Params = Record<string, string | number>;

export function go(
  route: RoutePath,
  params?: Params,
): Href {
  if (!params) return route as Href;

  let path: string = route;
  const query: Params = {};

  for (const [key, value] of Object.entries(params)) {
    const placeholder = `[${key}]`;
    if (path.includes(placeholder)) {
      path = path.replace(placeholder, encodeURIComponent(String(value)));
    } else {
      query[key] = value;
    }
  }

  const queryKeys = Object.keys(query);
  if (queryKeys.length === 0) return path as Href;

  const search = queryKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(query[k]))}`)
    .join('&');
  return `${path}?${search}` as Href;
}
