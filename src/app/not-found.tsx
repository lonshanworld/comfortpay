import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons/logo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="mb-8">
        <Logo className="h-12 w-auto text-primary" />
      </div>
      <div className="space-y-4">
        <h1 className="text-8xl font-bold text-primary">404</h1>
        <p className="text-2xl font-semibold tracking-tight text-foreground">
          Oops! Page Not Found
        </p>
        <p className="max-w-md text-muted-foreground">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <Button asChild>
          <Link href="/">Return to Homepage</Link>
        </Button>
      </div>
    </div>
  );
}
