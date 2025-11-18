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
 * **Note on property naming**: We use 'control' (not a namespaced name like '__appFormControl')
 * because browser extensions specifically look for this exact property name. Using a namespaced
 * name would break compatibility with the extensions this workaround is designed to support.
 * 
 * **Collision handling**: This function checks if 'control' already exists before adding it.
 * If another library or browser API defines 'control', this function will not override it.
 * The property is marked as configurable, so it can be removed if needed.
 * 
 * @param formElement - The form element to set up, or null if not available
 */
export function setupFormControlProperty(formElement: HTMLFormElement | null): void {
  if (!formElement) return;
  
  // Check if 'control' property already exists
  // If it does, we don't override it to avoid conflicts with other libraries or browser APIs
  if ('control' in formElement) {
    // Check if it's already our property descriptor (has getter/setter)
    const descriptor = Object.getOwnPropertyDescriptor(formElement, 'control');
    if (descriptor && (descriptor.get || descriptor.set)) {
      // Property already exists with getter/setter - likely already set up or set by another library
      return;
    }
    // If it exists but isn't a property descriptor, it might be a regular property
    // We still don't override it to avoid conflicts
    return;
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
        if (value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)) {
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

