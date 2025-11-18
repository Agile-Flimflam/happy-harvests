"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

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
  // Allow interactions with Mapbox dropdown elements and form inputs
  const handleInteractOutside = (event: Event) => {
    const mouseEvent = event as MouseEvent & { __isMapboxClick?: boolean };
    
    // If the event was marked as a Mapbox click, prevent dialog from closing
    if (mouseEvent.__isMapboxClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    
    const target = (mouseEvent.target || event.target) as HTMLElement;
    if (!target) return;
    
    // Helper to safely check className
    const hasClassName = (element: HTMLElement, search: string): boolean => {
      const className = element.className;
      if (typeof className === 'string') {
        return className.toLowerCase().includes(search.toLowerCase());
      }
      return String(className || '').toLowerCase().includes(search.toLowerCase());
    };
    
    // Get the element at the actual click point (more reliable for portals)
    let elementAtPoint: HTMLElement | null = null;
    if (mouseEvent.clientX !== undefined && mouseEvent.clientY !== undefined) {
      const element = document.elementFromPoint(mouseEvent.clientX, mouseEvent.clientY);
      elementAtPoint = element as HTMLElement;
    }
    
    // Check both the target and element at point
    const elementsToCheck = [target];
    if (elementAtPoint && elementAtPoint !== target) {
      elementsToCheck.push(elementAtPoint);
    }
    
    // Check if any of the elements are Mapbox-related
    for (const element of elementsToCheck) {
      if (!element) continue;
      
      // Check for Mapbox autofill attributes and classes
      const hasMapboxAttribute = 
        element.hasAttribute('data-mapbox-autofill') ||
        element.closest('[data-mapbox-autofill]') !== null;
      
      const hasMapboxClass = 
        hasClassName(element, 'mapbox') ||
        hasClassName(element, 'autofill') ||
        hasClassName(element, 'mbx') ||
        element.closest('[class*="mapbox"]') !== null ||
        element.closest('[class*="mbx"]') !== null ||
        element.closest('[id*="mapbox"]') !== null;
      
      const hasMapboxRole = 
        (element.getAttribute('role') === 'option' || element.getAttribute('role') === 'listbox') &&
        (hasMapboxClass || element.closest('[class*="mapbox"]') !== null);
      
      // Check if it's a listbox or option that's likely from Mapbox
      const isListboxOrOption = 
        element.getAttribute('role') === 'listbox' ||
        element.getAttribute('role') === 'option';
      
      // If it's a listbox/option and we can find Mapbox containers nearby, it's likely Mapbox
      const isLikelyMapbox = isListboxOrOption && (
        document.querySelector('[class*="mapbox-autofill"]') !== null ||
        document.querySelector('[id*="mapbox-autofill"]') !== null
      );
      
      if (hasMapboxAttribute || hasMapboxClass || hasMapboxRole || isLikelyMapbox) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    
    // Also check if the click is on the address input field
    const isAddressInput = 
      target.hasAttribute('data-mapbox-autofill') || 
      target.closest('[data-mapbox-autofill]') !== null;
    
    if (isAddressInput) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn("flex max-h-[85vh] w-full max-w-[calc(100vw-2rem)] flex-col overflow-visible px-0 py-6", className)}
        onInteractOutside={handleInteractOutside}
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
