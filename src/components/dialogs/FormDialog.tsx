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

/**
 * Safely checks if an element's className contains a search string.
 */
function hasClassName(element: HTMLElement, search: string): boolean {
  const className = element.className;
  if (typeof className === 'string') {
    return className.toLowerCase().includes(search.toLowerCase());
  }
  return String(className || '').toLowerCase().includes(search.toLowerCase());
}

/**
 * Checks if an element has Mapbox-related attributes.
 */
function hasMapboxAttribute(element: HTMLElement): boolean {
  return (
    element.hasAttribute('data-mapbox-autofill') ||
    element.closest('[data-mapbox-autofill]') !== null
  );
}

/**
 * Checks if an element has Mapbox-related CSS classes or IDs.
 */
function hasMapboxClass(element: HTMLElement): boolean {
  return (
    hasClassName(element, 'mapbox') ||
    hasClassName(element, 'autofill') ||
    hasClassName(element, 'mbx') ||
    element.closest('[class*="mapbox"]') !== null ||
    element.closest('[class*="mbx"]') !== null ||
    element.closest('[id*="mapbox"]') !== null
  );
}

/**
 * Checks if an element has a Mapbox-related ARIA role.
 */
function hasMapboxRole(element: HTMLElement): boolean {
  const role = element.getAttribute('role');
  const isOptionOrListbox = role === 'option' || role === 'listbox';
  return isOptionOrListbox && (
    hasMapboxClass(element) || 
    element.closest('[class*="mapbox"]') !== null
  );
}

/**
 * Checks if an element is a listbox or option that's likely from Mapbox.
 */
function isLikelyMapboxListbox(element: HTMLElement): boolean {
  const role = element.getAttribute('role');
  const isListboxOrOption = role === 'listbox' || role === 'option';
  
  if (!isListboxOrOption) return false;
  
  return (
    document.querySelector('[class*="mapbox-autofill"]') !== null ||
    document.querySelector('[id*="mapbox-autofill"]') !== null
  );
}

/**
 * Determines if an element is Mapbox-related by checking attributes, classes, roles, and context.
 */
function isMapboxElement(element: HTMLElement): boolean {
  return (
    hasMapboxAttribute(element) ||
    hasMapboxClass(element) ||
    hasMapboxRole(element) ||
    isLikelyMapboxListbox(element)
  );
}

/**
 * Gets the element at the click coordinates (more reliable for portal-rendered elements).
 */
function getElementAtPoint(event: MouseEvent): HTMLElement | null {
  if (event.clientX === undefined || event.clientY === undefined) {
    return null;
  }
  const element = document.elementFromPoint(event.clientX, event.clientY);
  return element as HTMLElement | null;
}

/**
 * Determines if a click event is related to Mapbox components and should prevent dialog closing.
 */
function isMapboxRelatedClick(event: MouseEvent & { __isMapboxClick?: boolean }): boolean {
  // Check if event was explicitly marked as a Mapbox click
  if (event.__isMapboxClick) {
    return true;
  }
  
  const target = event.target as HTMLElement | null;
  if (!target) return false;
  
  // Check if target is a Mapbox element
  if (isMapboxElement(target)) {
    return true;
  }
  
  // Check element at click point (for portal-rendered dropdowns)
  const elementAtPoint = getElementAtPoint(event);
  if (elementAtPoint && elementAtPoint !== target && isMapboxElement(elementAtPoint)) {
    return true;
  }
  
  // Check if click is on address input field
  return hasMapboxAttribute(target);
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
    
    if (isMapboxRelatedClick(mouseEvent)) {
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
