import { Construction } from 'lucide-react';

interface StubProps {
  title: string;
  blurb?: string;
}

export function Stub({ title, blurb }: StubProps) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-2xl font-semibold tracking-tight">{title}</div>
      <div className="rounded-lg border bg-card p-8 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Construction className="h-5 w-5" />
        </div>
        <div className="mt-3 font-medium">Coming in a later phase</div>
        <p className="mt-1 text-sm text-muted-foreground">
          {blurb ?? 'This module is in the architecture blueprint and will be built next.'}
        </p>
      </div>
    </div>
  );
}

export const DriversPage = () => <Stub title="Drivers" />;
export const TripsPage = () => <Stub title="Trips" />;
export const VehiclesPage = () => <Stub title="Vehicles" />;
export const OcrPage = () => <Stub title="OCR System" />;
export const AnalyticsPage = () => <Stub title="Analytics" />;
export const FeatureUsagePage = () => <Stub title="Feature Usage" />;
export const RevenuePage = () => (
  <Stub
    title="Revenue"
    blurb="Subscription analytics. Dashboards will populate once billing is enabled."
  />
);
export const CommunityPage = () => <Stub title="Community" />;
export const ReviewsPage = () => <Stub title="Reviews" />;
export const FeedbackPage = () => <Stub title="Feedback" />;
export const SupportPage = () => <Stub title="Support" />;
export const NotificationsPage = () => <Stub title="Notifications" />;
export const AuditPage = () => <Stub title="Audit Logs" />;
export const HealthPage = () => <Stub title="Platform Health" />;
export const RolesPage = () => <Stub title="Roles & Permissions" />;
export const SettingsPage = () => <Stub title="Settings" />;

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="text-center">
        <div className="text-6xl font-bold text-muted-foreground">404</div>
        <div className="mt-2 text-lg">Page not found</div>
      </div>
    </div>
  );
}
