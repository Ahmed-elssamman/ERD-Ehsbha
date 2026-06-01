export const brand = {
  primary: '#0B7CFF',
  primaryFg: '#FFFFFF',
} as const;

export const semantic = {
  success: { bg: '#ECFDF5', fg: '#065F46', border: '#A7F3D0' },
  warning: { bg: '#FFFBEB', fg: '#92400E', border: '#FCD34D' },
  danger: { bg: '#FEF2F2', fg: '#991B1B', border: '#FCA5A5' },
  info: { bg: '#EFF6FF', fg: '#1E40AF', border: '#93C5FD' },
} as const;

export const neutral = {
  bg: '#FFFFFF',
  bgMuted: '#F8FAFC',
  fg: '#0F172A',
  fgMuted: '#64748B',
  border: '#E2E8F0',
} as const;

export const neutralDark = {
  bg: '#0B0F14',
  bgMuted: '#0F1620',
  fg: '#E2E8F0',
  fgMuted: '#94A3B8',
  border: '#1E293B',
} as const;
