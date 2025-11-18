/**
 * Utility functions for detecting Mapbox autofill elements in dialogs.
 * These functions help prevent dialogs from closing when users interact with Mapbox components.
 */

/**
 * Type for MouseEvent with optional Mapbox click marker.
 */
export type MapboxMouseEvent = MouseEvent & { __isMapboxClick?: boolean };

/**
 * Checks if an element has the data-mapbox-autofill attribute (explicitly added by our code).
 */
export function hasMapboxAutofillAttribute(element: HTMLElement): boolean {
  return (
    element.hasAttribute('data-mapbox-autofill') ||
    element.closest('[data-mapbox-autofill]') !== null
  );
}

/**
 * Checks if an element has Mapbox autofill-specific CSS classes.
 * Only matches classes containing "mapbox-autofill" (not just "mapbox").
 */
export function hasMapboxAutofillClass(element: HTMLElement): boolean {
  // Check if element itself has a class containing "mapbox-autofill"
  if (element.className && typeof element.className === 'string') {
    const classList = element.className.split(/\s+/);
    if (classList.some(cls => cls.toLowerCase().includes('mapbox-autofill'))) {
      return true;
    }
  }
  
  // Check if element is within a container with mapbox-autofill class
  return element.closest('[class*="mapbox-autofill"]') !== null;
}

/**
 * Checks if an element has a Mapbox autofill-specific ID.
 * Only matches IDs containing "mapbox-autofill" (not just "mapbox").
 */
export function hasMapboxAutofillId(element: HTMLElement): boolean {
  const id = element.id;
  if (id && id.toLowerCase().includes('mapbox-autofill')) {
    return true;
  }
  
  // Check if element is within a container with mapbox-autofill ID
  return element.closest('[id*="mapbox-autofill"]') !== null;
}

/**
 * Checks if an element is a listbox or option within a Mapbox autofill container.
 * This is more specific than checking for any listbox/option.
 */
export function isMapboxAutofillListbox(element: HTMLElement): boolean {
  const role = element.getAttribute('role');
  const isListboxOrOption = role === 'listbox' || role === 'option';
  
  if (!isListboxOrOption) return false;
  
  // Only return true if there's actually a Mapbox autofill container in the document
  // This prevents false positives from unrelated listboxes/options
  const hasMapboxContainer = 
    document.querySelector('[class*="mapbox-autofill"]') !== null ||
    document.querySelector('[id*="mapbox-autofill"]') !== null ||
    document.querySelector('[data-mapbox-autofill]') !== null;
  
  if (!hasMapboxContainer) return false;
  
  // Check if this element is within a Mapbox autofill container
  return (
    element.closest('[class*="mapbox-autofill"]') !== null ||
    element.closest('[id*="mapbox-autofill"]') !== null ||
    element.closest('[data-mapbox-autofill]') !== null
  );
}

/**
 * Determines if an element is Mapbox autofill-related by checking specific attributes,
 * classes, IDs, and roles. Uses precise selectors to avoid false positives.
 */
export function isMapboxElement(element: HTMLElement): boolean {
  return (
    hasMapboxAutofillAttribute(element) ||
    hasMapboxAutofillClass(element) ||
    hasMapboxAutofillId(element) ||
    isMapboxAutofillListbox(element)
  );
}

/**
 * Gets the element at the click coordinates (more reliable for portal-rendered elements).
 */
export function getElementAtPoint(event: MouseEvent): HTMLElement | null {
  if (event.clientX === undefined || event.clientY === undefined) {
    return null;
  }
  const element = document.elementFromPoint(event.clientX, event.clientY);
  return element as HTMLElement | null;
}

/**
 * Determines if a click event is related to Mapbox components and should prevent dialog closing.
 */
export function isMapboxRelatedClick(event: MapboxMouseEvent): boolean {
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
  
  // Check if click is on address input field (has data-mapbox-autofill attribute)
  return hasMapboxAutofillAttribute(target);
}

