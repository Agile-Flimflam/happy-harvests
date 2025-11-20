"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { isMapboxRelatedClick, isMapboxElement, type MapboxMouseEvent } from "@/lib/mapbox-dialog-utils"

type FormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  submitLabel?: string
  cancelLabel?: string
  formId?: string
  children: React.ReactNode
  className?: string
}

export default function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  cancelLabel = "Cancel",
  formId,
  children,
  className,
}: FormDialogProps) {
  // Ref to track the dialog content element for Mapbox selection state
  const dialogContentRef = React.useRef<HTMLDivElement>(null);

  // Wrapper for onOpenChange that prevents closing during Mapbox interactions
  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    // If trying to close, check if Mapbox is active
    if (!newOpen) {
      const dialogContent = 
        dialogContentRef.current || 
        document.querySelector('[data-slot="dialog-content"]');
      
      if (dialogContent && (
        dialogContent.hasAttribute('data-mapbox-dropdown-open') ||
        dialogContent.hasAttribute('data-mapbox-selection-in-progress')
      )) {
        // Prevent closing if Mapbox is active
        return;
      }
    }
    
    // Otherwise, allow normal open/close behavior
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // Allow interactions with Mapbox dropdown elements and form inputs
  // Handle onInteractOutside, onPointerDownOutside, and onFocusOutside to catch all outside interaction events
  const handleInteractOutside = (event: Event) => {
    const mouseEvent = event as MapboxMouseEvent;
    
    // Check if Mapbox selection is in progress - always prevent closing during this
    const dialogContent = 
      dialogContentRef.current || 
      (event.currentTarget as HTMLElement) ||
      document.querySelector('[data-slot="dialog-content"]');
    
    if (dialogContent?.hasAttribute('data-mapbox-selection-in-progress')) {
      // During selection processing, prevent ALL outside interactions
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // Check if Mapbox dropdown is open
    const isDropdownOpen = dialogContent?.hasAttribute('data-mapbox-dropdown-open');
    
    if (isDropdownOpen) {
      // If dropdown is open, only prevent Mapbox-related clicks
      // This allows users to close the dialog by clicking truly outside
      if (isMapboxRelatedClick(mouseEvent)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      // If it's not a Mapbox click, allow normal closing behavior
    } else if (isMapboxRelatedClick(mouseEvent)) {
      // Normal Mapbox click detection when dropdown is not active
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handlePointerDownOutside = (event: Event) => {
    const mouseEvent = event as MapboxMouseEvent;
    
    // Check if Mapbox selection is in progress - always prevent closing during this
    const dialogContent = 
      dialogContentRef.current || 
      (event.currentTarget as HTMLElement) ||
      document.querySelector('[data-slot="dialog-content"]');
    
    if (dialogContent?.hasAttribute('data-mapbox-selection-in-progress')) {
      // During selection processing, prevent ALL outside interactions
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    // Check if Mapbox dropdown is open
    const isDropdownOpen = dialogContent?.hasAttribute('data-mapbox-dropdown-open');
    
    if (isDropdownOpen) {
      // If dropdown is open, only prevent Mapbox-related clicks
      // This allows users to close the dialog by clicking truly outside
      if (isMapboxRelatedClick(mouseEvent)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      // If it's not a Mapbox click, allow normal closing behavior
    } else if (isMapboxRelatedClick(mouseEvent)) {
      // Normal Mapbox click detection when dropdown is not active
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleFocusOutside = (event: Event) => {
    const focusEvent = event as FocusEvent;
    const target = focusEvent.target as HTMLElement | null;
    
    // Find the dialog content element (try ref first, then fallback to currentTarget or query)
    const dialogContent = 
      dialogContentRef.current || 
      (event.currentTarget as HTMLElement) ||
      document.querySelector('[data-slot="dialog-content"]');
    
    // Check if Mapbox dropdown is open or selection is in progress
    // This prevents the dialog from closing when focus moves outside during Mapbox interactions
    if (dialogContent && (
      dialogContent.hasAttribute('data-mapbox-dropdown-open') ||
      dialogContent.hasAttribute('data-mapbox-selection-in-progress')
    )) {
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
        className={cn("flex max-h-[85vh] w-full max-w-[calc(100vw-2rem)] flex-col overflow-visible px-0 py-6", className)}
        onInteractOutside={handleInteractOutside}
        onPointerDownOutside={handlePointerDownOutside}
        onFocusOutside={handleFocusOutside}
      >
        <DialogHeader className="shrink-0 px-6">
          <DialogTitle className="whitespace-normal break-words">{title}</DialogTitle>
          {description ? <DialogDescription className="whitespace-normal break-words">{description}</DialogDescription> : null}
        </DialogHeader>
        <div
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" as React.CSSProperties["overscrollBehavior"] }}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-visible"
        >
          <div className="px-6">
            {children}
          </div>
        </div>
        <DialogFooter className="shrink-0 px-6">
          {submitLabel && formId ? (
            <>
              <DialogClose asChild>
                <Button variant="outline">{cancelLabel}</Button>
              </DialogClose>
              <Button type="submit" form={formId}>{submitLabel}</Button>
            </>
          ) : (
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
