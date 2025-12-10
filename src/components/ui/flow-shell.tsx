import * as React from 'react';

import { cn } from '@/lib/utils';

type FlowShellWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const widthClassMap: Record<FlowShellWidth, string> = {
  sm: 'max-w-screen-sm',
  md: 'max-w-3xl',
  lg: 'max-w-5xl',
  xl: 'max-w-6xl',
  full: 'max-w-[1200px]',
};

export type FlowShellProps = {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: React.ReactNode;
  width?: FlowShellWidth;
  padded?: boolean;
  className?: string;
  headerClassName?: string;
  children: React.ReactNode;
  /** Reserve space for sticky bottom actions on mobile */
  withSafeBottom?: boolean;
};

/**
 * FlowShell provides a consistent, mobile-first page scaffold with room for
 * primary actions, breadcrumbs, and safe-area padding for sticky bars.
 */
export function FlowShell({
  title,
  description,
  icon,
  actions,
  breadcrumbs,
  width = 'lg',
  padded = true,
  className,
  headerClassName,
  children,
  withSafeBottom = true,
}: FlowShellProps) {
  return (
    <div
      data-slot="flow-shell"
      className={cn(
        'w-full',
        // provide breathing room for sticky bottom actions on touch devices
        withSafeBottom ? 'pb-[max(env(safe-area-inset-bottom,0px),1.5rem)]' : '',
        className
      )}
    >
      <div
        className={cn(
          'mx-auto w-full px-4 sm:px-6',
          widthClassMap[width],
          padded ? 'pt-4 sm:pt-6' : 'pt-0'
        )}
      >
        <div className={cn('flex flex-col gap-3 sm:gap-4', headerClassName)}>
          {breadcrumbs ? <div className="text-sm text-muted-foreground">{breadcrumbs}</div> : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
              {icon ? <div className="mt-0.5 sm:mt-1 text-muted-foreground">{icon}</div> : null}
              <div className="min-w-0 space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                {description ? (
                  <p className="text-sm text-muted-foreground sm:text-base line-clamp-3">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            {actions ? (
              <div className="flex w-full flex-1 justify-start sm:w-auto sm:flex-none sm:justify-end">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className={cn('mt-4 sm:mt-6', padded ? 'space-y-4 sm:space-y-6' : 'space-y-2')}>
          {children}
        </div>
      </div>
    </div>
  );
}

export type FlowSectionProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  gap?: 'sm' | 'md' | 'lg';
};

/**
 * FlowSection standardizes spacing within FlowShell for grouped content.
 */
export function FlowSection({
  title,
  description,
  action,
  children,
  className,
  gap = 'md',
}: FlowSectionProps) {
  const gapClass = gap === 'lg' ? 'space-y-6' : gap === 'sm' ? 'space-y-3' : 'space-y-4';

  return (
    <section
      className={cn(
        'rounded-xl border bg-card text-card-foreground shadow-sm',
        'px-4 py-4 sm:px-6 sm:py-5',
        gapClass,
        className
      )}
    >
      {title || description || action ? (
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-lg font-semibold tracking-tight">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export type OneHandGridProps = {
  children: React.ReactNode;
  className?: string;
  columns?: 1 | 2 | 3;
};

/**
 * OneHandGrid constrains content for thumb reach and readable density on mobile,
 * while expanding progressively on larger breakpoints.
 */
export function OneHandGrid({ children, className, columns = 2 }: OneHandGridProps) {
  const columnClass =
    columns === 3
      ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'
      : columns === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1';

  return (
    <div
      className={cn(
        'grid w-full gap-3 sm:gap-4 md:gap-5',
        columnClass,
        'max-w-screen-md xl:max-w-none',
        className
      )}
    >
      {children}
    </div>
  );
}
