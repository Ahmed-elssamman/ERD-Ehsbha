import { Badge } from './badge';

interface UserStatusBadgeProps {
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
}

export function UserStatusBadge({ status }: UserStatusBadgeProps) {
  const variant = status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'warning' : 'muted';
  return <Badge variant={variant}>{status}</Badge>;
}

interface TicketStatusBadgeProps {
  status: 'OPEN' | 'IN_REVIEW' | 'PLANNED' | 'RESOLVED' | 'CLOSED';
}

export function TicketStatusBadge({ status }: TicketStatusBadgeProps) {
  const map: Record<TicketStatusBadgeProps['status'], 'success' | 'warning' | 'muted' | 'default' | 'danger'> = {
    OPEN: 'warning',
    IN_REVIEW: 'default',
    PLANNED: 'default',
    RESOLVED: 'success',
    CLOSED: 'muted',
  };
  return <Badge variant={map[status]}>{status.replace('_', ' ')}</Badge>;
}
