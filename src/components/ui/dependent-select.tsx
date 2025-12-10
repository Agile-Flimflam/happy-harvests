'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export type SelectOption = {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
};

export type DependentSelectProps = {
  parentLabel: string;
  childLabel: string;
  parentValue: string | null;
  childValue: string | null;
  parentOptions: SelectOption[];
  childOptions: SelectOption[];
  onParentChange: (value: string) => void;
  onChildChange: (value: string) => void;
  loadingChild?: boolean;
  errorChild?: string | null;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
};

/**
 * DependentSelect keeps two selects in sync (e.g., location -> plot),
 * surfacing loading and error states and enforcing keyboard/ARIA labelling.
 */
export function DependentSelect({
  parentLabel,
  childLabel,
  parentValue,
  childValue,
  parentOptions,
  childOptions,
  onParentChange,
  onChildChange,
  loadingChild = false,
  errorChild = null,
  className,
  required = false,
  disabled = false,
  helperText,
}: DependentSelectProps) {
  const parentId = React.useId();
  const childId = React.useId();

  return (
    <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}>
      <div className="space-y-1.5">
        <Label htmlFor={parentId}>
          {parentLabel}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>
        <Select
          value={parentValue ?? ''}
          onValueChange={onParentChange}
          disabled={disabled}
          name={parentId}
        >
          <SelectTrigger
            id={parentId}
            aria-describedby={helperText ? `${parentId}-helper` : undefined}
          >
            <SelectValue placeholder={`Select ${parentLabel.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {parentOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  <span className="flex flex-col">
                    <span>{option.label}</span>
                    {option.description ? (
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {helperText ? (
          <p id={`${parentId}-helper`} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={childId}>
          {childLabel}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </Label>

        {loadingChild ? (
          <SelectTrigger id={childId} disabled className="justify-start">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">Loading {childLabel.toLowerCase()}…</span>
          </SelectTrigger>
        ) : childOptions.length === 0 && !errorChild ? (
          <SelectTrigger id={childId} disabled className="justify-start">
            <span className="text-muted-foreground">No options available</span>
          </SelectTrigger>
        ) : null}

        {!loadingChild && childOptions.length > 0 ? (
          <Select
            value={childValue ?? ''}
            onValueChange={onChildChange}
            disabled={disabled || childOptions.length === 0}
            name={childId}
          >
            <SelectTrigger id={childId}>
              <SelectValue placeholder={`Select ${childLabel.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {childOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    <span className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description ? (
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}

        {loadingChild ? (
          <div className="flex items-center gap-2" aria-live="polite">
            <Skeleton className="h-9 w-full" />
          </div>
        ) : null}

        {errorChild ? (
          <p className="text-xs text-destructive" role="status">
            {errorChild}
          </p>
        ) : null}
      </div>
    </div>
  );
}
