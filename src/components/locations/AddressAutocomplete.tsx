'use client';

import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useFormContext, type ControllerRenderProps } from 'react-hook-form';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LocationFormValues } from '@/lib/validation/locations';

// Dynamically import AddressAutofill to avoid SSR issues
const AddressAutofill = dynamic(
  () => import('@mapbox/search-js-react').then((mod) => mod.AddressAutofill),
  { ssr: false }
);

interface AddressAutocompleteProps {
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  // Optional field props for use within FormField
  field?: ControllerRenderProps<LocationFormValues, 'street'>;
}

// Type for the retrieve response - using a compatible interface
interface AddressAutofillRetrieveResponse {
  type: string;
  features: Array<{
    type: string;
    properties: {
      address_line1?: string;
      address_line2?: string;
      address_level1?: string; // State
      address_level2?: string; // City
      postcode?: string; // ZIP
      full_address?: string;
      [key: string]: unknown;
    };
    geometry: {
      type: string;
      coordinates: number[]; // GeoJSON Position (longitude, latitude)
    };
  }>;
  [key: string]: unknown;
}

/**
 * Validates the Mapbox access token from environment variables.
 * Returns a valid token string or null if the token is missing, empty, or invalid.
 * 
 * @returns The validated token string, or null if invalid
 */
function getValidatedMapboxToken(): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  
  // Explicitly check for undefined, null, or empty/whitespace-only strings
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return null;
  }
  
  return token;
}

// Module-level state to manage global styles and event listeners
// Uses a Set to track active instances, making it safe for React StrictMode and concurrent rendering
const STYLE_ID = 'mapbox-autofill-styles';

// Track active component instances using a Set of unique instance IDs
// This is more robust than a simple counter for React StrictMode and concurrent rendering
const activeInstances = new Set<symbol>();

// Track if global resources are injected
let stylesInjected = false;
let mapboxClickHandler: ((e: MouseEvent) => void) | null = null;

export function AddressAutocomplete({
  className,
  placeholder = 'Start typing an address...',
  disabled = false,
  field,
}: AddressAutocompleteProps) {
  // useFormContext must be called unconditionally (React hook rules)
  // It will throw if used outside FormProvider, which is expected
  const formContext = useFormContext<LocationFormValues>();
  
  // Access form methods - formContext is guaranteed to exist when used within FormProvider
  const { setValue, watch } = formContext;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Use a ref to store a unique instance ID for this component instance
  // This persists across re-renders and is safe for React StrictMode double-mounting
  const instanceIdRef = useRef<symbol | null>(null);
  
  // Generate a unique instance ID on first render
  if (instanceIdRef.current === null) {
    instanceIdRef.current = Symbol('AddressAutocomplete-instance');
  }

  // Helper to set up form control property for browser extensions
  // Uses a getter/setter to allow both reading and writing without errors
  const setupFormControlProperty = useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    const form = input.form;
    if (!form) return;
    
    // Add a dummy control property to prevent browser extension errors
    // Use getter/setter to allow both reading and writing without throwing errors
    if (!('control' in form)) {
      // Create a storage object that can be written to
      // This object persists and can be modified by browser extensions
      const controlStorage: Record<string, unknown> = {};
      
      Object.defineProperty(form, 'control', {
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
  }, []);
  
  // Ensure component is mounted before accessing form methods
  // This helps prevent browser extension errors when they try to access form controls
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Workaround for browser extensions that try to access form.control
  // Some extensions (password managers, autofill tools) expect a 'control' property
  // on the native form element. We add a dummy property to prevent errors.
  // Using useLayoutEffect as a backup to ensure it's set up synchronously before browser paints
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;

    // Try to set up immediately
    setupFormControlProperty(inputRef.current);

    // Also try after a short delay in case form association happens asynchronously
    const timeoutId = setTimeout(() => {
      setupFormControlProperty(inputRef.current);
    }, 10);

    // Cleanup: only clear the timeout
    // Note: We do NOT delete the control property because:
    // 1. Multiple component instances may share the same form
    // 2. The property is harmless and doesn't cause memory leaks
    // 3. Browser extensions may still need it after component unmounts
    // 4. The property is defined with configurable: true, but deletion can fail
    //    in edge cases, and silently failing cleanup is worse than leaving it
    return () => {
      clearTimeout(timeoutId);
    };
  }, [isMounted, setupFormControlProperty]);
  
  // Use field value if provided (from FormField), otherwise watch the form
  // Fallback to empty string if watch is not available or component not mounted
  const addressValue = field?.value ?? (isMounted && watch ? watch('street') : '') ?? '';

  // Validate and normalize Mapbox access token once on mount
  // Returns null if token is undefined, null, empty string, or whitespace-only
  const mapboxToken = useMemo(() => getValidatedMapboxToken(), []);

  // Handle input changes to keep form in sync
  // This is needed because Mapbox's AddressAutofill manages the input internally
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      // Update form value when user types
      if (field?.onChange) {
        field.onChange(newValue);
      } else if (setValue && isMounted) {
        setValue('street', newValue, { shouldValidate: false, shouldDirty: true });
      }
    },
    [field, setValue, isMounted]
  );

  const handleRetrieve = useCallback(
    (res: AddressAutofillRetrieveResponse) => {
      setIsLoading(false);
      setError(null);

      if (!res?.features || res.features.length === 0) {
        setError('No address found. Please try a different search.');
        return;
      }

      // Check if component is mounted before proceeding
      // setValue is guaranteed to exist from useFormContext (throws if not in FormProvider)
      if (!isMounted) {
        console.warn('AddressAutocomplete: Component not mounted, skipping form update');
        return;
      }

      const feature = res.features[0];
      const { properties, geometry } = feature;

      // Extract address components
      const street = properties.address_line1 || '';
      const city = properties.address_level2 || '';
      const state = properties.address_level1 || '';
      const zip = properties.postcode || '';
      
      // Handle Position type (GeoJSON Position is number[] with at least 2 elements)
      const coordinates = geometry.coordinates;
      const longitude = Array.isArray(coordinates) && coordinates.length >= 2 ? coordinates[0] : null;
      const latitude = Array.isArray(coordinates) && coordinates.length >= 2 ? coordinates[1] : null;

      // Populate form fields - Mapbox already updated the input value
      // Use setValue directly to avoid interfering with Mapbox's event handling
      // setValue is guaranteed to exist from useFormContext

      if (street) {
        setValue('street', street, { shouldValidate: true, shouldDirty: true });
      }
      if (city) {
        setValue('city', city, { shouldValidate: true, shouldDirty: true });
      }
      if (state) {
        setValue('state', state, { shouldValidate: true, shouldDirty: true });
      }
      if (zip) {
        setValue('zip', zip, { shouldValidate: true, shouldDirty: true });
      }
      if (typeof latitude === 'number' && !Number.isNaN(latitude)) {
        setValue('latitude', latitude, { shouldValidate: true, shouldDirty: true });
      }
      if (typeof longitude === 'number' && !Number.isNaN(longitude)) {
        setValue('longitude', longitude, { shouldValidate: true, shouldDirty: true });
      }
      
      // Close the dropdown by blurring the input after Mapbox processes the selection
      // Mark the input with a data attribute to indicate programmatic blur
      // This allows the dialog to distinguish between user clicks and programmatic actions
      if (inputRef.current) {
        // Mark that we're programmatically closing the dropdown
        inputRef.current.setAttribute('data-mapbox-selection-complete', 'true');
        
        // Use requestAnimationFrame to ensure Mapbox has finished processing the selection
        requestAnimationFrame(() => {
          // Blur the input to close the dropdown naturally
          // This is more reliable than DOM manipulation and works with Mapbox's internal state
          inputRef.current?.blur();
          
          // Remove the data attribute after a short delay
          setTimeout(() => {
            inputRef.current?.removeAttribute('data-mapbox-selection-complete');
          }, 100);
        });
      }
    },
    [setValue, isMounted]
  );

  const handleSuggest = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  const handleSuggestError = useCallback((err: Error) => {
    setIsLoading(false);
    const errorMessage = err.message || 'An error occurred while searching for addresses.';
    setError(errorMessage);
  }, []);

  // Add global styles and click handler to ensure Mapbox dropdown works correctly
  // Uses a Set to track active instances, making it safe for React StrictMode and concurrent rendering
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const instanceId = instanceIdRef.current;
    if (!instanceId) return;

    // Add this instance to the active instances Set
    const wasFirstInstance = activeInstances.size === 0;
    activeInstances.add(instanceId);

    // Inject styles only if this is the first instance
    if (wasFirstInstance && !stylesInjected) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        /* Ensure Mapbox dropdown is above dialog (z-50) and clickable */
        [class*="mapbox-autofill"],
        [id*="mapbox-autofill"],
        [data-mapbox-autofill],
        [role="listbox"],
        [role="option"] {
          z-index: 9999 !important;
          pointer-events: auto !important;
        }
        
        /* Ensure all Mapbox suggestion elements are clickable */
        [class*="mapbox-autofill"] *,
        [id*="mapbox-autofill"] *,
        [data-mapbox-autofill] *,
        [role="listbox"] *,
        [role="option"] * {
          pointer-events: auto !important;
          cursor: pointer !important;
        }
      `;
      
      document.head.appendChild(style);
      stylesInjected = true;
    }

    // Set up event listeners only if not already set up
    if (!mapboxClickHandler) {
      // Add a click handler to mark Mapbox clicks so the dialog doesn't close
      // We use a data attribute to mark the event, which the dialog can check
      mapboxClickHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target) return;

        // Check if this is a Mapbox element
        const isMapboxElement = 
          target.closest('[class*="mapbox"]') !== null ||
          target.closest('[class*="mbx"]') !== null ||
          target.closest('[id*="mapbox"]') !== null ||
          target.closest('[data-mapbox-autofill]') !== null ||
          (target.getAttribute('role') === 'option' && 
           document.querySelector('[class*="mapbox-autofill"]') !== null) ||
          (target.getAttribute('role') === 'listbox' && 
           document.querySelector('[class*="mapbox-autofill"]') !== null);

        if (isMapboxElement) {
          // Mark the event so the dialog knows not to close
          // We don't stop propagation to allow Mapbox to handle the click
          (e as MouseEvent & { __isMapboxClick?: boolean }).__isMapboxClick = true;
        }
      };

      // Use capture phase to catch the event early, but don't stop propagation
      document.addEventListener('click', mapboxClickHandler, true);
      document.addEventListener('mousedown', mapboxClickHandler, true);
    }

    // Cleanup: remove this instance from the Set and remove styles/listeners only when last instance unmounts
    return () => {
      activeInstances.delete(instanceId);
      
      // Only remove styles and listeners when the last instance unmounts
      // Add guards to prevent race conditions when multiple instances unmount simultaneously
      if (activeInstances.size === 0) {
        // Guard: only remove styles if they were actually injected
        // This prevents redundant cleanup if multiple cleanup functions run concurrently
        if (stylesInjected) {
          const styleEl = document.getElementById(STYLE_ID);
          if (styleEl) {
            try {
              document.head.removeChild(styleEl);
            } catch {
              // Element may have already been removed by another concurrent cleanup
              // This is safe to ignore
            }
          }
          stylesInjected = false;
        }

        // Guard: only remove listeners if they were actually set up
        // This prevents errors from trying to remove listeners that were already removed
        if (mapboxClickHandler) {
          document.removeEventListener('click', mapboxClickHandler, true);
          document.removeEventListener('mousedown', mapboxClickHandler, true);
          mapboxClickHandler = null;
        }
      }
    };
  }, []);

  if (!mapboxToken) {
    return (
      <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <span>Mapbox access token is not configured. Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your environment variables.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2" style={{ position: 'relative', zIndex: 1, overflow: 'visible' }}>
      <div className="relative" style={{ isolation: 'isolate', pointerEvents: 'auto', overflow: 'visible' }}>
        <AddressAutofill
          accessToken={mapboxToken}
          onRetrieve={handleRetrieve as (res: unknown) => void}
          onSuggest={handleSuggest}
          onSuggestError={handleSuggestError}
          options={{
            language: 'en',
            country: 'US',
            limit: 5,
          }}
        >
          <input
            ref={(el) => {
              inputRef.current = el;
              // Set up form control property as soon as input is available
              if (el) {
                setupFormControlProperty(el);
              }
            }}
            type="text"
            name="street"
            value={addressValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            disabled={disabled}
            data-mapbox-autofill="true"
            className={cn(
              'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
              'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
              'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
              'w-full pr-10',
              error && 'border-destructive focus-visible:border-destructive',
              className
            )}
            autoComplete="address-line1"
            aria-label="Street address"
            aria-describedby={error ? 'address-error' : undefined}
          />
        </AddressAutofill>
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      {error && (
        <div
          id="address-error"
          className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
