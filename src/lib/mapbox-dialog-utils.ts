/**
 * Utility functions for detecting Mapbox autofill elements in dialogs.
 * These functions help prevent dialogs from closing when users interact with Mapbox components.
 *
 * NOTE: The selectors used in this file (e.g., [class*="mapbox-autofill"]) use substring matching
 * which could theoretically match unrelated elements if other libraries use similar naming patterns.
 * To mitigate this risk, functions validate that a Mapbox autofill container actually exists in
 * the document before trusting class/ID matches. The data-mapbox-autofill attribute check is the
 * most reliable as it's explicitly added by our code.
 */

/**
 * Type for MouseEvent or PointerEvent used in Mapbox detection helpers.
 * PointerEvent is used by onPointerDownOutside, MouseEvent is used by onInteractOutside.
 */
export type MapboxMouseEvent = MouseEvent | PointerEvent;

// Track Mapbox-related click events without mutating native event objects.
const mapboxClickEvents = new WeakSet<MouseEvent | PointerEvent>();

/**
 * Mark an event as originating from Mapbox UI (used to keep dialogs open).
 */
export function markMapboxClick(event: MouseEvent | PointerEvent): void {
  mapboxClickEvents.add(event);
}

/**
 * Validates that a Mapbox autofill container actually exists in the document.
 * This helps prevent false positives from unrelated elements with similar naming patterns.
 *
 * @returns true if a Mapbox autofill container is found in the document
 */
const MAPBOX_AUTOFILL_CONTAINER_SELECTOR =
  '[data-mapbox-autofill], [class*="mapbox-autofill"], [id*="mapbox-autofill"]';

function hasMapboxAutofillContainer(): boolean {
  return document.querySelector(MAPBOX_AUTOFILL_CONTAINER_SELECTOR) !== null;
}

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
 *
 * NOTE: Validates that a Mapbox autofill container exists in the document to prevent
 * false positives from unrelated elements with similar class names.
 */
export function hasMapboxAutofillClass(element: HTMLElement): boolean {
  // Only check class names if a Mapbox autofill container exists in the document
  // This prevents false positives from unrelated elements with similar naming
  if (!hasMapboxAutofillContainer()) {
    return false;
  }

  // Check if element itself has a class containing "mapbox-autofill"
  if (element.className && typeof element.className === 'string') {
    const classList = element.className.split(/\s+/);
    if (classList.some((cls) => cls.toLowerCase().includes('mapbox-autofill'))) {
      return true;
    }
  }

  // Check if element is within a container with mapbox-autofill class
  return element.closest('[class*="mapbox-autofill"]') !== null;
}

/**
 * Checks if an element has a Mapbox autofill-specific ID.
 * Only matches IDs containing "mapbox-autofill" (not just "mapbox").
 *
 * NOTE: Validates that a Mapbox autofill container exists in the document to prevent
 * false positives from unrelated elements with similar ID patterns.
 */
export function hasMapboxAutofillId(element: HTMLElement): boolean {
  // Only check IDs if a Mapbox autofill container exists in the document
  // This prevents false positives from unrelated elements with similar naming
  if (!hasMapboxAutofillContainer()) {
    return false;
  }

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
 *
 * NOTE: Validates that a Mapbox autofill container exists in the document to prevent
 * false positives from unrelated listboxes/options.
 */
export function isMapboxAutofillListbox(element: HTMLElement): boolean {
  const role = element.getAttribute('role');
  const isListboxOrOption = role === 'listbox' || role === 'option';

  if (!isListboxOrOption) return false;

  // Only return true if there's actually a Mapbox autofill container in the document
  // This prevents false positives from unrelated listboxes/options
  if (!hasMapboxAutofillContainer()) return false;

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
 *
 * NOTE: The data-mapbox-autofill attribute check is the most reliable as it's explicitly
 * added by our code. Class and ID checks validate that a Mapbox container exists in the
 * document to prevent false positives from unrelated elements with similar naming patterns.
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
 * Works with both MouseEvent and PointerEvent.
 */
export function getElementAtPoint(event: MouseEvent | PointerEvent): HTMLElement | null {
  if (event.clientX === undefined || event.clientY === undefined) {
    return null;
  }
  const element = document.elementFromPoint(event.clientX, event.clientY);
  return element instanceof HTMLElement ? element : null;
}

/**
 * Determines if a click event is related to Mapbox components and should prevent dialog closing.
 */
export function isMapboxRelatedClick(event: MapboxMouseEvent): boolean {
  // Prefer WeakSet marker to avoid mutating native events
  if (mapboxClickEvents.has(event)) {
    return true;
  }

  const target = event.target instanceof HTMLElement ? event.target : null;
  if (!target) return false;

  // Check if target is a Mapbox element
  if (isMapboxElement(target)) {
    return true;
  }

  // Check element at click point (for portal-rendered dropdowns)
  // This is critical because Mapbox renders suggestions in a portal
  const elementAtPoint = getElementAtPoint(event);
  if (elementAtPoint) {
    if (isMapboxElement(elementAtPoint)) {
      return true;
    }
    // Also check if the element at point is within a Mapbox container
    // This catches cases where the click is on a child element
    const mapboxContainer = elementAtPoint.closest(
      '[class*="mapbox-autofill"], [id*="mapbox-autofill"], [data-mapbox-autofill]'
    );
    if (mapboxContainer) {
      return true;
    }
  }

  // Check if click is on address input field (has data-mapbox-autofill attribute)
  if (hasMapboxAutofillAttribute(target)) {
    return true;
  }

  // Check if target is within a Mapbox container (catches nested elements)
  const mapboxContainer = target.closest(
    '[class*="mapbox-autofill"], [id*="mapbox-autofill"], [data-mapbox-autofill]'
  );
  if (mapboxContainer) {
    return true;
  }

  return false;
}
