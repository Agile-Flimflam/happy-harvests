import * as React from 'react';
import { BadgeCheck, Info, Leaf, MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export type EntityMetaItem = {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
};

export type EntityTag = {
  label: string;
  tone?: 'default' | 'success' | 'info' | 'warn';
};

export type EntitySummaryCardProps = {
  title: string;
  description?: string;
  meta?: EntityMetaItem[];
  tags?: EntityTag[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  isLoading?: boolean;
  accent?: 'default' | 'primary' | 'muted';
  className?: string;
};

const toneStyles: Record<NonNullable<EntityTag['tone']>, string> = {
  default: 'bg-muted text-muted-foreground',
  success:
    'bg-emerald-50 text-emerald-800 border border-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200',
  info: 'bg-blue-50 text-blue-800 border border-blue-100 dark:bg-blue-950/60 dark:text-blue-200',
  warn: 'bg-amber-50 text-amber-900 border border-amber-100 dark:bg-amber-950/60 dark:text-amber-200',
};

const accentRing: Record<NonNullable<EntitySummaryCardProps['accent']>, string> = {
  default: 'border-border',
  primary: 'border-primary/50 shadow-md shadow-primary/10',
  muted: 'border-muted',
};

/**
 * EntitySummaryCard presents a concise snapshot with metadata, tags, and actions.
 * Ideal for list/detail hybrids across mobile and desktop.
 */
export function EntitySummaryCard({
  title,
  description,
  meta,
  tags,
  actions,
  children,
  footer,
  icon,
  isLoading = false,
  accent = 'default',
  className,
}: EntitySummaryCardProps) {
  return (
    <Card
      className={cn(
        'flex h-full flex-col overflow-hidden transition hover:shadow-md',
        accentRing[accent],
        className
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-1 text-muted-foreground">{icon ?? <Leaf className="h-5 w-5" />}</div>
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate text-lg font-semibold leading-tight">{title}</CardTitle>
            {description ? (
              <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            ) : null}
            {tags && tags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag.label}
                    variant="outline"
                    className={cn('capitalize', toneStyles[tag.tone ?? 'default'])}
                  >
                    {tag.label}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </CardHeader>

      {isLoading ? (
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </CardContent>
      ) : meta && meta.length > 0 ? (
        <CardContent className="space-y-2">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {meta.map((item) => (
              <div key={item.label} className="flex items-start gap-2">
                <div className="mt-0.5 text-muted-foreground">
                  {item.icon ?? <Info className="h-4 w-4" />}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <dt className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="text-sm font-medium text-foreground">{item.value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      ) : null}

      {children ? <CardContent className="pt-0">{children}</CardContent> : null}

      {footer ? (
        <CardFooter className="flex flex-wrap items-center gap-2 border-t bg-muted/40 text-sm text-muted-foreground">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function AddressPill({ address, label = 'Location' }: { address: string; label?: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
      <MapPin className="h-3 w-3" aria-hidden />
      <span className="font-medium text-foreground">{label}</span>
      <span className="text-muted-foreground">{address}</span>
    </div>
  );
}

export function VerifiedPill({ label = 'Verified' }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200">
      <BadgeCheck className="h-3 w-3" aria-hidden />
      {label}
    </div>
  );
}
