'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

export type StickyActionBarProps = {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end' | 'between';
  elevated?: boolean;
  position?: 'sticky' | 'fixed';
} & React.ComponentProps<'div'>;

/**
 * StickyActionBar pins actions to the bottom of the viewport and accounts for
 * safe areas plus mobile keyboards. Use inside forms or sheets.
 */
export function StickyActionBar({
  children,
  className,
  align = 'between',
  elevated = true,
  position = 'sticky',
  ...divProps
}: StickyActionBarProps) {
  const [keyboardOffset, setKeyboardOffset] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const handleResize = () => {
      const offset =
        window.innerHeight - viewport.height - viewport.offsetTop > 0
          ? window.innerHeight - viewport.height - viewport.offsetTop
          : 0;
      setKeyboardOffset(Math.max(0, Math.round(offset)));
    };
    viewport.addEventListener('resize', handleResize);
    viewport.addEventListener('scroll', handleResize);
    handleResize();
    return () => {
      viewport.removeEventListener('resize', handleResize);
      viewport.removeEventListener('scroll', handleResize);
    };
  }, []);

  return (
    <div
      data-slot="sticky-action-bar"
      className={cn(
        position === 'fixed'
          ? 'fixed bottom-0 left-0 right-0 z-40 w-full'
          : 'sticky bottom-0 left-0 right-0 z-30 w-full',
        'border-t bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75',
        elevated ? 'shadow-[0_-6px_24px_-12px_rgba(0,0,0,0.25)]' : '',
        className
      )}
      style={{
        paddingBottom: `calc(0.75rem + env(safe-area-inset-bottom, 0px) + ${keyboardOffset}px)`,
      }}
      {...divProps}
    >
      <div
        className={cn(
          'mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-6',
          align === 'end'
            ? 'sm:justify-end'
            : align === 'start'
              ? 'sm:justify-start'
              : 'sm:justify-between'
        )}
      >
        {children}
      </div>
    </div>
  );
}
