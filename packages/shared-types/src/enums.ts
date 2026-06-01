export const USER_STATUS = ['ACTIVE', 'SUSPENDED', 'DELETED'] as const;
export type UserStatus = (typeof USER_STATUS)[number];

export const TICKET_STATUS = ['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUS)[number];

export const TICKET_CATEGORY = [
  'BUG',
  'FEATURE_REQUEST',
  'IMPROVEMENT',
  'QUESTION',
  'OTHER',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORY)[number];

export const ADMIN_ROLE_CODES = [
  'super_admin',
  'admin',
  'moderator',
  'support',
  'analyst',
] as const;
export type AdminRoleCode = (typeof ADMIN_ROLE_CODES)[number];

export const ADMIN_ALERT_SEVERITY = ['info', 'medium', 'high', 'critical'] as const;
export type AdminAlertSeverity = (typeof ADMIN_ALERT_SEVERITY)[number];
