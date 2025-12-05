'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  isMapboxRelatedClick,
  isMapboxElement,
  type MapboxMouseEvent,
} from '@/lib/mapbox-dialog-utils';

type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  submitLabel?: string;
  cancelLabel?: string;
  formId?: string;
  children: React.ReactNode;
  className?: string;
};

// Helper to find the dialog content element
const getDialogContent = (
  ref: React.RefObject<HTMLDivElement | null>,
  eventOrElement?: Event | HTMLElement
) => {
  if (ref.current) return ref.current;

  if (eventOrElement) {
    if (eventOrElement instanceof HTMLElement) {
      return eventOrElement;
    }
    if ('currentTarget' in eventOrElement) {
      return eventOrElement.currentTarget as HTMLElement;
    }
  }

  return document.querySelector('[data-slot="dialog-content"]') as HTMLElement;
};

// Helper to determine if outside interaction should be prevented
const shouldPreventInteraction = (event: Event, ref: React.RefObject<HTMLDivElement | null>) => {
  const dialogContent = getDialogContent(ref, event);

  if (dialogContent?.hasAttribute('data-mapbox-selection-in-progress')) {
    return true;
  }

  // Logic for dropdown open / normal mapbox click
  // In both cases (dropdown open or closed), we want to prevent closing
  // ONLY if the click is related to Mapbox.
  const mouseEvent = event as MapboxMouseEvent;
  return isMapboxRelatedClick(mouseEvent);
};

export default function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  cancelLabel = 'Cancel',
  formId,
  children,
  className,
}: FormDialogProps) {
  // Ref to track the dialog content element for Mapbox selection state
  const dialogContentRef = React.useRef<HTMLDivElement>(null);

  // Wrapper for onOpenChange that prevents closing during Mapbox interactions
  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      // If trying to close, check if Mapbox is active
      if (!newOpen) {
        const dialogContent = getDialogContent(dialogContentRef);

        if (
          dialogContent &&
          (dialogContent.hasAttribute('data-mapbox-dropdown-open') ||
            dialogContent.hasAttribute('data-mapbox-selection-in-progress'))
        ) {
          // Prevent closing if Mapbox is active
          return;
        }
      }

      // Otherwise, allow normal open/close behavior
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  // Allow interactions with Mapbox dropdown elements and form inputs
  const preventOutsideInteraction = (event: Event) => {
    if (shouldPreventInteraction(event, dialogContentRef)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleInteractOutside = preventOutsideInteraction;
  const handlePointerDownOutside = preventOutsideInteraction;

  const handleFocusOutside = (event: Event) => {
    const focusEvent = event as FocusEvent;
    const target = focusEvent.target as HTMLElement | null;

    // Find the dialog content element
    const dialogContent = getDialogContent(dialogContentRef, event);

    // Check if Mapbox dropdown is open or selection is in progress
    // This prevents the dialog from closing when focus moves outside during Mapbox interactions
    if (
      dialogContent &&
      (dialogContent.hasAttribute('data-mapbox-dropdown-open') ||
        dialogContent.hasAttribute('data-mapbox-selection-in-progress'))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // Check if focus is moving to a Mapbox element
    if (target && isMapboxElement(target)) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Check if the related target (where focus is coming from) is a Mapbox element
    const relatedTarget = focusEvent.relatedTarget as HTMLElement | null;
    if (relatedTarget && isMapboxElement(relatedTarget)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        ref={dialogContentRef}
        className={cn(
          'flex max-h-[85vh] w-full max-w-[calc(100vw-2rem)] flex-col overflow-visible px-0 py-6',
          className
        )}
        onInteractOutside={handleInteractOutside}
        onPointerDownOutside={handlePointerDownOutside}
        onFocusOutside={handleFocusOutside}
      >
        <DialogHeader className="shrink-0 px-6">
          <DialogTitle className="whitespace-normal break-words">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="whitespace-normal break-words">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <div
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain' as React.CSSProperties['overscrollBehavior'],
          }}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-visible"
        >
          <div className="px-6">{children}</div>
        </div>
        <DialogFooter className="shrink-0 px-6">
          {submitLabel && formId ? (
            <>
              <DialogClose asChild>
                <Button variant="outline">{cancelLabel}</Button>
              </DialogClose>
              <Button type="submit" form={formId}>
                {submitLabel}
              </Button>
            </>
          ) : (
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
