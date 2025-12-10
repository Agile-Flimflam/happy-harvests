'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { StickyActionBar } from '@/components/ui/sticky-action-bar';
const VisuallyHidden = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} className={cn('sr-only', className)} {...props} />
  )
);
VisuallyHidden.displayName = 'VisuallyHidden';

export type InlineCreatePrimaryAction = {
  label: string;
  formId?: string;
  loading?: boolean;
  onClick?: () => void;
  disabled?: boolean;
};

export type InlineCreateSecondaryAction = {
  label: string;
  onClick: () => void;
  variant?: 'ghost' | 'secondary' | 'outline';
};

export type InlineCreateSheetProps = {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  primaryAction: InlineCreatePrimaryAction;
  secondaryAction?: InlineCreateSecondaryAction;
  footerContent?: React.ReactNode;
  className?: string;
  side?: 'left' | 'right' | 'bottom';
};

/**
 * InlineCreateSheet wraps creation/edit flows in a sheet with consistent actions,
 * safe-area padding, and focus management.
 */
export function InlineCreateSheet({
  title,
  description,
  open,
  onOpenChange,
  children,
  primaryAction,
  secondaryAction,
  footerContent,
  className,
  side = 'right',
}: InlineCreateSheetProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const [hasRendered, setHasRendered] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setHasRendered(true);
    }
  }, [open]);

  const resolvedTitle = title?.trim() || 'Form';
  const resolvedDescription = description?.trim() || 'Complete the form below';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          'flex h-full flex-col gap-0 p-0 sm:max-w-[520px]',
          side === 'bottom' ? 'max-h-[90dvh]' : 'max-h-[100dvh]',
          className
        )}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <SheetHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
          {title ? (
            <SheetTitle id={titleId} className="text-xl">
              {title}
            </SheetTitle>
          ) : (
            <SheetTitle id={titleId} className="sr-only">
              {resolvedTitle}
            </SheetTitle>
          )}
          {description ? (
            <SheetDescription id={descriptionId} className="text-sm text-muted-foreground">
              {description}
            </SheetDescription>
          ) : (
            <SheetDescription id={descriptionId} className="sr-only">
              {resolvedDescription}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-28 pt-2 sm:px-6 sm:pb-6">{children}</div>

        <StickyActionBar
          role="group"
          aria-label="Sheet actions"
          className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75"
        >
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {footerContent ? (
              <div className="text-sm text-muted-foreground">{footerContent}</div>
            ) : null}
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
              {secondaryAction ? (
                <Button
                  type="button"
                  variant={secondaryAction.variant ?? 'ghost'}
                  onClick={secondaryAction.onClick}
                >
                  {secondaryAction.label}
                </Button>
              ) : null}
              <Button
                type={primaryAction.formId ? 'submit' : 'button'}
                form={primaryAction.formId}
                onClick={primaryAction.formId ? undefined : primaryAction.onClick}
                disabled={primaryAction.disabled || primaryAction.loading}
                aria-busy={primaryAction.loading}
              >
                {primaryAction.loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {primaryAction.label}
                  </>
                ) : (
                  primaryAction.label
                )}
              </Button>
            </div>
          </div>
        </StickyActionBar>
        {!hasRendered ? <span className="sr-only">Opening form</span> : null}
      </SheetContent>
    </Sheet>
  );
}
