import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';

export function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div className="max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <p className="gradient-text text-7xl font-extrabold">404</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
