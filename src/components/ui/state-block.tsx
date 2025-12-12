import * as React from 'react';
import { AlertTriangle, Info, RefreshCw } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export type StateBlockProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  tone?: 'info' | 'error';
  className?: string;
};

export function StateBlock({
  title,
  description,
  icon,
  action,
  tone = 'info',
  className,
}: StateBlockProps) {
  const toneStyles =
    tone === 'error'
      ? 'border-destructive/30 bg-destructive/5 text-destructive'
      : 'border-border bg-muted/50 text-foreground';

  return (
    <Card className={cn('border-dashed', toneStyles, className)}>
      <CardContent className="flex flex-col items-start gap-3 py-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-muted-foreground">
            {icon ??
              (tone === 'error' ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <Info className="h-5 w-5" />
              ))}
          </div>
          <div className="space-y-1">
            <div className="text-base font-semibold">{title}</div>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function LoadingBlock({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} aria-busy="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function RetryAction({
  label = 'Retry',
  onClick,
  loading = false,
}: {
  label?: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
    >
      {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
      {label}
    </Button>
  );
}
