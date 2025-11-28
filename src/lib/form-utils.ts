/**
 * Utility functions for form handling, particularly workarounds for browser extensions.
 */

// Global flag to track if document-level listener is set up
let globalFormControlListenerSetup = false;

/**
 * Sets up a form control property on a form element to prevent browser extension errors.
 *
 * Some browser extensions (password managers, autofill tools) expect a 'control' property
 * on the native form element. This function adds a dummy property with getter/setter that
 * allows extensions to read and write without throwing errors.
 *
 * Uses a getter/setter pattern to allow both reading and writing without errors.
 * The storage object persists and can be modified by browser extensions.
 *
 * **Note on property naming and conflicts**:
 * We specifically use the property name 'control' because certain browser extensions (e.g.,
 * password managers, autofill tools) incorrectly attempt to access this property on form elements,
 * causing runtime errors if it is missing or not configurable.
 *
 * While this creates a potential naming conflict with future standard APIs or other libraries:
 * 1. The standard HTMLFormElement interface currently does not define a 'control' property.
 * 2. Using a namespaced property (e.g., '__appFormControl') would fail to prevent the extension
 *    errors this workaround is designed to address.
 * 3. We intentionally check for existing descriptors to avoid overriding properties defined by
 *    other libraries or the browser itself, preserving existing behavior where possible.
 *
 * **Collision handling**: This function checks if 'control' already exists before adding it.
 * If another library or browser API defines 'control', this function will not override it.
 * The property is marked as configurable, so it can be removed if needed.
 *
 * @param formElement - The form element to set up, or null if not available
 */
export function setupFormControlProperty(formElement: HTMLFormElement | null): void {
  if (!formElement) return;

  // Check if 'control' property already exists and has both getter and setter configured
  const descriptor = Object.getOwnPropertyDescriptor(formElement, 'control');
  if (descriptor && descriptor.get && descriptor.set) {
    // Property already exists with getter/setter - likely already set up correctly
    return;
  }

  // If control exists but is null, undefined, or not a proper descriptor,
  // we need to override it to prevent extension errors
  // This handles cases where extensions set it to null/undefined
  if ('control' in formElement) {
    const currentValue = (formElement as { control?: unknown }).control;
    // If it's null or undefined, we definitely need to override it
    if (currentValue === null || currentValue === undefined) {
      // Delete the existing property so we can redefine it
      try {
        delete (formElement as { control?: unknown }).control;
      } catch {
        // If deletion fails, try to redefine anyway (might work if configurable)
      }
    } else {
      // If it has a non-null value and isn't our descriptor, don't override
      // (might be set by another library)
      return;
    }
  }

  // Add a dummy control property to prevent browser extension errors
  // Use getter/setter to allow both reading and writing without throwing errors
  // Create a storage object that can be written to
  // This object persists and can be modified by browser extensions
  const controlStorage: Record<string, unknown> = {};

  try {
    Object.defineProperty(formElement, 'control', {
      get() {
        // Return the storage object, allowing extensions to read properties
        return controlStorage;
      },
      set(value: unknown) {
        // Silently accept writes - merge if it's an object, otherwise clear and store as 'value'
        if (
          value !== null &&
          value !== undefined &&
          typeof value === 'object' &&
          !Array.isArray(value)
        ) {
          // Merge object properties into storage
          Object.assign(controlStorage, value);
        } else {
          // For primitives or null/undefined, clear storage and store as 'value' property
          Object.keys(controlStorage).forEach((key) => delete controlStorage[key]);
          if (value !== null && value !== undefined) {
            controlStorage.value = value;
          }
        }
      },
      enumerable: false,
      configurable: true,
    });
  } catch (error) {
    // If property definition fails (e.g., non-configurable property exists), silently fail
    // This prevents errors from breaking the application if another library has locked the property
    if (process.env.NODE_ENV === 'development') {
      console.warn('Failed to set up form control property:', error);
    }
  }
}

/**
 * Sets up form control property from an input element.
 * Convenience wrapper that gets the form from the input element.
 *
 * @param inputElement - The input element whose form should be set up, or null if not available
 */
export function setupFormControlPropertyFromInput(inputElement: HTMLInputElement | null): void {
  if (!inputElement) return;
  const form = inputElement.form;
  if (!form) return;
  setupFormControlProperty(form);
}

/**
 * Sets up a global document-level listener that ensures form.control is set up
 * for any form before browser extensions try to access it during focus events.
 *
 * This runs in the capture phase to execute before extension handlers.
 * Should be called once during app initialization.
 */
export function setupGlobalFormControlListener(): void {
  if (typeof window === 'undefined') return;
  if (globalFormControlListenerSetup) return;

  // Set up form control property for all existing forms immediately
  // This ensures forms are ready before any focus events occur
  const allForms = document.querySelectorAll('form');
  allForms.forEach((form) => {
    setupFormControlProperty(form);
  });

  // Also watch for new forms being added to the DOM
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          // Check if the added node is a form
          if (element.tagName === 'FORM') {
            setupFormControlProperty(element as HTMLFormElement);
          }
          // Check if the added node contains any forms
          const forms = element.querySelectorAll?.('form');
          if (forms) {
            forms.forEach((form) => {
              setupFormControlProperty(form);
            });
          }
        }
      });
    });
  });

  // Observe the document body for new forms
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Find the form containing the focused element
    const form = target.closest('form');
    if (form) {
      // Set up form control property synchronously before extension checks it
      setupFormControlProperty(form);
    }
  };

  const handleInput = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Find the form containing the input element
    const form = target.closest('form');
    if (form) {
      // Set up form control property synchronously before extension checks it
      // Extensions often check form.control during input events
      setupFormControlProperty(form);
    }
  };

  // Use capture phase (true) to run before extension handlers
  // This ensures form.control is set up before extensions check it
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('input', handleInput, true);

  globalFormControlListenerSetup = true;
}
