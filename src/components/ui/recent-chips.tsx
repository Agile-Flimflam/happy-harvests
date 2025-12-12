'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type RecentChip = {
  label: string;
  value: string;
  count?: number;
  icon?: React.ReactNode;
};

export type RecentChipsProps = {
  items: RecentChip[];
  activeValue?: string | null;
  onSelect: (value: string | null) => void;
  className?: string;
  clearLabel?: string;
  ariaLabel?: string;
};

/**
 * RecentChips renders horizontally scrollable filter chips with an optional clear action.
 */
export function RecentChips({
  items,
  activeValue = null,
  onSelect,
  className,
  clearLabel = 'Clear',
  ariaLabel = 'Recent filters',
}: RecentChipsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 overflow-x-auto rounded-lg border bg-card/60 px-3 py-2',
        'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted',
        className
      )}
      role="listbox"
      aria-label={ariaLabel}
    >
      {items.map((chip) => {
        const isActive = activeValue === chip.value;
        return (
          <Button
            key={chip.value}
            type="button"
            variant={isActive ? 'secondary' : 'outline'}
            size="sm"
            className="whitespace-nowrap"
            onClick={() => onSelect(isActive ? null : chip.value)}
            aria-selected={isActive}
            role="option"
          >
            <span className="flex items-center gap-2">
              {chip.icon}
              <span className="text-sm font-medium">{chip.label}</span>
              {typeof chip.count === 'number' ? (
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[11px] font-semibold',
                    isActive ? 'bg-primary text-primary-foreground' : ''
                  )}
                >
                  {chip.count}
                </Badge>
              ) : null}
            </span>
          </Button>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="ml-auto shrink-0 text-muted-foreground"
        onClick={() => onSelect(null)}
        aria-label={clearLabel}
      >
        <X className="mr-1 h-4 w-4" aria-hidden />
        {clearLabel}
      </Button>
    </div>
  );
}
