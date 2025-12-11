'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from './button';
import { Card, CardContent } from './card';

export type ErrorPresenterProps = {
  message: string;
  title?: string;
  correlationId?: string;
  details?: string;
  retryLabel?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
};

export function ErrorPresenter({
  message,
  title = 'Something went wrong',
  correlationId,
  details,
  retryLabel = 'Retry',
  onRetry,
  onDismiss,
  className,
}: ErrorPresenterProps) {
  const liveRegionRef = useRef<HTMLDivElement | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    liveRegionRef.current?.focus();
  }, [message, correlationId]);

  return (
    <Card
      className={cn(
        'border-destructive/50 bg-destructive/5 text-destructive shadow-none',
        className
      )}
    >
      <CardContent className="flex flex-col gap-3 py-4">
        <div
          ref={liveRegionRef}
          tabIndex={-1}
          aria-live="assertive"
          aria-atomic="true"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 focus-visible:ring-offset-2"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <div className="space-y-1">
              <div className="text-sm font-semibold leading-tight">{title}</div>
              <p className="text-sm leading-relaxed text-destructive/90">{message}</p>
              {correlationId ? (
                <p className="text-xs text-destructive/80">
                  Reference: <span className="font-medium">{correlationId}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {details ? (
          <div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-destructive underline-offset-4 hover:underline"
              aria-expanded={showDetails}
              onClick={() => setShowDetails((open) => !open)}
            >
              <ChevronDown
                className={cn('h-4 w-4 transition', showDetails ? 'rotate-180' : '')}
                aria-hidden
              />
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            {showDetails ? (
              <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive/90">
                {details}
              </div>
            ) : null}
          </div>
        ) : null}

        {(onRetry || onDismiss) && (
          <div className="flex flex-wrap gap-2">
            {onRetry ? (
              <Button
                type="button"
                variant="outline"
                className="border-destructive/60 text-destructive hover:bg-destructive/10"
                onClick={onRetry}
              >
                {retryLabel}
              </Button>
            ) : null}
            {onDismiss ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/5"
                onClick={onDismiss}
              >
                Dismiss
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
