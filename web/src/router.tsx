import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute, GuestRoute } from '@/routes/protected-route';
import { DashboardPage } from '@/pages/dashboard/dashboard';
import { NotFoundPage } from '@/pages/not-found';

const LoginPage = lazy(() => import('@/pages/auth/login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/register').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/forgot-password').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/reset-password').then((m) => ({ default: m.ResetPasswordPage })));

const TripsListPage = lazy(() => import('@/pages/trips/trips-list').then((m) => ({ default: m.TripsListPage })));
const TripNewPage = lazy(() => import('@/pages/trips/trip-new').then((m) => ({ default: m.TripNewPage })));
const TripDetailPage = lazy(() => import('@/pages/trips/trip-detail').then((m) => ({ default: m.TripDetailPage })));

const ExpensesPage = lazy(() => import('@/pages/expenses/expenses').then((m) => ({ default: m.ExpensesPage })));
const MaintenancePage = lazy(() => import('@/pages/maintenance/maintenance').then((m) => ({ default: m.MaintenancePage })));
const VehicleHealthPage = lazy(() => import('@/pages/vehicle-health/vehicle-health').then((m) => ({ default: m.VehicleHealthPage })));
const AnalyticsPage = lazy(() => import('@/pages/analytics/analytics').then((m) => ({ default: m.AnalyticsPage })));
const DriverScorePage = lazy(() => import('@/pages/driver-score/driver-score').then((m) => ({ default: m.DriverScorePage })));
const DecisionsPage = lazy(() => import('@/pages/decisions/decisions').then((m) => ({ default: m.DecisionsPage })));
const WorkPlannerPage = lazy(() => import('@/pages/planner/planner').then((m) => ({ default: m.WorkPlannerPage })));
const BestHoursPage = lazy(() => import('@/pages/best-hours/best-hours').then((m) => ({ default: m.BestHoursPage })));
const ProfitSimulatorPage = lazy(() => import('@/pages/simulator/simulator').then((m) => ({ default: m.ProfitSimulatorPage })));
const NotificationsPage = lazy(() => import('@/pages/notifications/notifications').then((m) => ({ default: m.NotificationsPage })));
const SettingsPage = lazy(() => import('@/pages/settings/settings').then((m) => ({ default: m.SettingsPage })));
const GuidePage = lazy(() => import('@/pages/guide/guide').then((m) => ({ default: m.GuidePage })));
const CommunityPage = lazy(() => import('@/pages/community/community').then((m) => ({ default: m.CommunityPage })));
const ReviewsPage = lazy(() => import('@/pages/reviews/reviews').then((m) => ({ default: m.ReviewsPage })));
const SupportPage = lazy(() => import('@/pages/support/support').then((m) => ({ default: m.SupportPage })));

function FullScreenSpinner() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        aria-label="loading"
      />
    </div>
  );
}

function PageSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<FullScreenSpinner />}>{children}</Suspense>;
}

const lazyRoute = (element: React.ReactNode) => <PageSuspense>{element}</PageSuspense>;

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestRoute>
        <PageSuspense>
          <LoginPage />
        </PageSuspense>
      </GuestRoute>
    ),
  },
  {
    path: '/register',
    element: (
      <GuestRoute>
        <PageSuspense>
          <RegisterPage />
        </PageSuspense>
      </GuestRoute>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <GuestRoute>
        <PageSuspense>
          <ForgotPasswordPage />
        </PageSuspense>
      </GuestRoute>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <GuestRoute>
        <PageSuspense>
          <ResetPasswordPage />
        </PageSuspense>
      </GuestRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'trips', element: lazyRoute(<TripsListPage />) },
      { path: 'trips/new', element: lazyRoute(<TripNewPage />) },
      { path: 'trips/:id', element: lazyRoute(<TripDetailPage />) },
      { path: 'expenses', element: lazyRoute(<ExpensesPage />) },
      { path: 'maintenance', element: lazyRoute(<MaintenancePage />) },
      { path: 'vehicle-health', element: lazyRoute(<VehicleHealthPage />) },
      { path: 'analytics', element: lazyRoute(<AnalyticsPage />) },
      { path: 'driver-score', element: lazyRoute(<DriverScorePage />) },
      { path: 'smart-decisions', element: lazyRoute(<DecisionsPage />) },
      { path: 'work-planner', element: lazyRoute(<WorkPlannerPage />) },
      { path: 'best-hours', element: lazyRoute(<BestHoursPage />) },
      { path: 'profit-simulator', element: lazyRoute(<ProfitSimulatorPage />) },
      { path: 'notifications', element: lazyRoute(<NotificationsPage />) },
      { path: 'guide', element: lazyRoute(<GuidePage />) },
      { path: 'community', element: lazyRoute(<CommunityPage />) },
      { path: 'reviews', element: lazyRoute(<ReviewsPage />) },
      { path: 'support', element: lazyRoute(<SupportPage />) },
      { path: 'settings', element: lazyRoute(<SettingsPage />) },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
  { path: '/404', element: <NotFoundPage /> },
]);
