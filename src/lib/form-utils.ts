/**
 * Utility functions for form handling, particularly workarounds for browser extensions.
 */

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
 * @param formElement - The form element to set up, or null if not available
 */
export function setupFormControlProperty(formElement: HTMLFormElement | null): void {
  if (!formElement) return;
  
  // Add a dummy control property to prevent browser extension errors
  // Use getter/setter to allow both reading and writing without throwing errors
  if (!('control' in formElement)) {
    // Create a storage object that can be written to
    // This object persists and can be modified by browser extensions
    const controlStorage: Record<string, unknown> = {};
    
    Object.defineProperty(formElement, 'control', {
      get() {
        // Return the storage object, allowing extensions to read properties
        return controlStorage;
      },
      set(value: unknown) {
        // Silently accept writes - merge if it's an object, otherwise clear and store as 'value'
        if (value && typeof value === 'object' && !Array.isArray(value) && value !== null) {
          // Merge object properties into storage
          Object.assign(controlStorage, value);
        } else {
          // For primitives or null/undefined, clear storage and store as 'value' property
          Object.keys(controlStorage).forEach(key => delete controlStorage[key]);
          if (value !== null && value !== undefined) {
            controlStorage.value = value;
          }
        }
      },
      enumerable: false,
      configurable: true,
    });
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

