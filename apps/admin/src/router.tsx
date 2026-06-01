import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/admin-layout';
import {
  AdminGuestRoute,
  AdminProtectedRoute,
  RequirePermission,
} from '@/routes/admin-protected-route';
import { LoginPage } from '@/pages/login';
import { DashboardPage } from '@/pages/dashboard';
import { UsersPage } from '@/pages/users';
import { UserDetailPage } from '@/pages/user-detail';
import { DriversPage } from '@/pages/drivers';
import { DriverDetailPage } from '@/pages/driver-detail';
import { TripsPage } from '@/pages/trips';
import { TripDetailPage } from '@/pages/trip-detail';
import { VehiclesPage } from '@/pages/vehicles';
import { CommunityPage } from '@/pages/community';
import { ReviewsPage } from '@/pages/reviews';
import { SupportPage } from '@/pages/support';
import { SupportDetailPage } from '@/pages/support-detail';
import { NotificationsPage } from '@/pages/notifications';
import { AuditPage } from '@/pages/audit';
import { RolesPage } from '@/pages/roles';
import { AnalyticsPage } from '@/pages/analytics';
import { HealthPage } from '@/pages/health';
import { SettingsPage } from '@/pages/settings';
import { InfoPage } from '@/pages/info-page';
import { miscApi } from '@/lib/api/endpoints';
import { NotFoundPage } from '@/pages/stubs';

const gate = (perm: string, el: React.ReactNode) => <RequirePermission permission={perm}>{el}</RequirePermission>;

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AdminGuestRoute><LoginPage /></AdminGuestRoute>,
  },
  {
    path: '/',
    element: <AdminProtectedRoute><AdminLayout /></AdminProtectedRoute>,
    children: [
      { index: true, element: gate('dashboard.read', <DashboardPage />) },
      { path: 'users', element: gate('users.read', <UsersPage />) },
      { path: 'users/:id', element: gate('users.read', <UserDetailPage />) },
      { path: 'drivers', element: gate('drivers.read', <DriversPage />) },
      { path: 'drivers/:id', element: gate('drivers.read', <DriverDetailPage />) },
      { path: 'trips', element: gate('trips.read', <TripsPage />) },
      { path: 'trips/:id', element: gate('trips.read', <TripDetailPage />) },
      { path: 'vehicles', element: gate('vehicles.read', <VehiclesPage />) },
      { path: 'analytics', element: gate('analytics.read', <AnalyticsPage />) },
      {
        path: 'revenue',
        element: gate('revenue.read', <InfoPage
          title="Revenue"
          description="Subscription, MRR, churn and lifetime-value dashboards (post-billing)."
          query={miscApi.revenue}
          queryKey={['admin', 'revenue-overview']}
        />),
      },
      { path: 'community', element: gate('community.read', <CommunityPage />) },
      { path: 'reviews', element: gate('reviews.read', <ReviewsPage />) },
      { path: 'support', element: gate('support.read', <SupportPage />) },
      { path: 'support/:id', element: gate('support.read', <SupportDetailPage />) },
      { path: 'notifications', element: gate('notifications.read', <NotificationsPage />) },
      { path: 'audit', element: gate('audit.read', <AuditPage />) },
      { path: 'health', element: gate('platform_health.read', <HealthPage />) },
      { path: 'roles', element: gate('roles.read', <RolesPage />) },
      { path: 'settings', element: gate('settings.read', <SettingsPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
