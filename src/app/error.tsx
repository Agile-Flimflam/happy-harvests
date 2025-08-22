'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Root error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">An unexpected error occurred. You can try again.</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center rounded-md bg-black px-3 py-2 text-sm font-medium text-white shadow hover:opacity-90 dark:bg-white dark:text-black"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-900"
          >
            Go home
          </Link>
        </div>
        {error?.digest && (
          <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}


