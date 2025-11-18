'use client';

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { useFormContext, type ControllerRenderProps } from 'react-hook-form';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LocationFormValues } from '@/lib/validation/locations';
import { getValidatedMapboxToken } from '@/lib/mapbox-utils';
import { setupFormControlPropertyFromInput } from '@/lib/form-utils';

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

// Constants
const STYLE_ID = 'mapbox-autofill-styles';

// Delay in milliseconds before removing the selection-complete data attribute
// This allows Mapbox to finish processing the selection before cleanup
const MAPBOX_SELECTION_CLEANUP_DELAY = 100;

// Z-index for Mapbox autocomplete dropdown
// Must be above dialogs (z-50 = 50) but not excessively high to avoid conflicts
// Using 100 provides sufficient layering without being excessive
const MAPBOX_DROPDOWN_Z_INDEX = 100;

// Valid coordinate ranges (WGS84 standard)
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

/**
 * Singleton manager for global Mapbox autocomplete resources.
 * 
 * This manager coordinates shared resources across all AddressAutocomplete component instances:
 * - Global CSS styles injected into the document head
 * - Document-level event listeners for Mapbox click handling
 * - Reference counting to ensure resources are only cleaned up when the last instance unmounts
 * 
 * The singleton pattern ensures:
 * 1. Resources are shared across all instances (no duplication)
 * 2. Resources are only injected once (first instance)
 * 3. Resources are only removed when the last instance unmounts
 * 4. Thread-safe operations for React StrictMode and concurrent rendering
 */
class MapboxAutocompleteResourceManager {
  // Track active component instances using a Set of unique instance IDs
  // This is more robust than a simple counter for React StrictMode and concurrent rendering
  private readonly activeInstances = new Set<symbol>();
  
  // Track if global resources are injected
  private stylesInjected = false;
  private mapboxClickHandler: ((e: MouseEvent) => void) | null = null;

  /**
   * Register a component instance and inject global resources if this is the first instance.
   * @param instanceId Unique identifier for this component instance
   */
  registerInstance(instanceId: symbol): void {
    const wasFirstInstance = this.activeInstances.size === 0;
    this.activeInstances.add(instanceId);

    if (wasFirstInstance) {
      this.injectStyles();
      this.setupEventListeners();
    }
  }

  /**
   * Unregister a component instance and clean up global resources if this was the last instance.
   * @param instanceId Unique identifier for this component instance
   */
  unregisterInstance(instanceId: symbol): void {
    this.activeInstances.delete(instanceId);

    if (this.activeInstances.size === 0) {
      this.cleanupResources();
    }
  }

  /**
   * Inject global CSS styles into the document head.
   * Safe to call multiple times - will only inject once.
   */
  private injectStyles(): void {
    if (this.stylesInjected) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Ensure Mapbox dropdown is above dialog (z-50 = 50) and clickable */
      [class*="mapbox-autofill"],
      [id*="mapbox-autofill"],
      [data-mapbox-autofill],
      [role="listbox"],
      [role="option"] {
        z-index: ${MAPBOX_DROPDOWN_Z_INDEX} !important;
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
    this.stylesInjected = true;
  }

  /**
   * Set up document-level event listeners for Mapbox click handling.
   * Safe to call multiple times - will only set up once.
   */
  private setupEventListeners(): void {
    if (this.mapboxClickHandler) return;

    this.mapboxClickHandler = (e: MouseEvent) => {
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
    document.addEventListener('click', this.mapboxClickHandler, true);
    document.addEventListener('mousedown', this.mapboxClickHandler, true);
  }

  /**
   * Clean up global resources (styles and event listeners).
   * Includes guards to prevent race conditions when multiple instances unmount simultaneously.
   */
  private cleanupResources(): void {
    // Guard: only remove styles if they were actually injected
    // This prevents redundant cleanup if multiple cleanup functions run concurrently
    if (this.stylesInjected) {
      const styleEl = document.getElementById(STYLE_ID);
      if (styleEl) {
        try {
          document.head.removeChild(styleEl);
        } catch {
          // Element may have already been removed by another concurrent cleanup
          // This is safe to ignore
        }
      }
      this.stylesInjected = false;
    }

    // Guard: only remove listeners if they were actually set up
    // This prevents errors from trying to remove listeners that were already removed
    if (this.mapboxClickHandler) {
      document.removeEventListener('click', this.mapboxClickHandler, true);
      document.removeEventListener('mousedown', this.mapboxClickHandler, true);
      this.mapboxClickHandler = null;
    }
  }
}

// Singleton instance - shared across all AddressAutocomplete component instances
const mapboxResourceManager = new MapboxAutocompleteResourceManager();

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
  // Returns true if setup was successful, false otherwise
  // Uses the shared utility function
  const setupFormControlProperty = useCallback((input: HTMLInputElement | null): boolean => {
    if (!input) return false;
    const form = input.form;
    if (!form) return false;
    
    setupFormControlPropertyFromInput(input);
    return true;
  }, []);
  
  // Ensure component is mounted before accessing form methods
  // This helps prevent browser extension errors when they try to access form controls
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Workaround for browser extensions that try to access form.control
  // Some extensions (password managers, autofill tools) expect a 'control' property
  // on the native form element. We add a dummy property to prevent errors.
  // The setup is primarily handled in the ref callback (earliest opportunity).
  // This useLayoutEffect provides a fallback retry in case the ref callback didn't work
  // or the form association happened asynchronously.
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;

    // Check if setup already succeeded (via ref callback or previous attempt)
    // by checking if the form already has the control property
    const input = inputRef.current;
    const form = input?.form;
    const alreadySetup = form && 'control' in form;

    // Only attempt setup if it hasn't been set up yet
    // This avoids redundant calls when the ref callback already succeeded
    let timeoutId: NodeJS.Timeout | null = null;
    if (!alreadySetup) {
      // Try to set up immediately
      const setupSuccess = setupFormControlProperty(input);

      // Schedule a single retry as a fallback if initial setup failed
      // This handles edge cases where form association happens asynchronously
      if (!setupSuccess) {
        timeoutId = setTimeout(() => {
          setupFormControlProperty(inputRef.current);
        }, 10);
      }
    }

    // Cleanup: only clear the timeout if it was set
    // Note: We do NOT delete the control property because:
    // 1. Multiple component instances may share the same form
    // 2. The property is harmless and doesn't cause memory leaks
    // 3. Browser extensions may still need it after component unmounts
    // 4. The property is defined with configurable: true, but deletion can fail
    //    in edge cases, and silently failing cleanup is worse than leaving it
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [isMounted, setupFormControlProperty]);
  
  // Use field value if provided (from FormField), otherwise watch the form
  // Fallback to empty string if watch is not available or component not mounted
  const addressValue = field?.value ?? (isMounted && watch ? watch('street') : '') ?? '';

  // SECURITY CONSIDERATION: Mapbox access token is exposed in client-side code
  // The token is necessary for Mapbox to work in the browser, but must be properly secured:
  // 1. Configure URL restrictions in Mapbox dashboard to limit token usage to your domain(s)
  // 2. Set minimal permissions - only enable geocoding and mapping APIs (not uploads, etc.)
  // 3. Enable usage monitoring in Mapbox dashboard to detect abuse or unexpected usage patterns
  // 4. Regularly rotate tokens and review access logs
  // 5. Never use a token with admin or write permissions in client-side code
  // See README.md for additional security documentation

  // Validate and normalize Mapbox access token
  // Returns null if token is undefined, null, empty string, or whitespace-only
  // No need for useMemo since getValidatedMapboxToken() reads from process.env (constant at build time)
  const mapboxToken = getValidatedMapboxToken();

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
      // Validate that coordinates is an array with at least 2 numeric elements
      const coordinates = geometry.coordinates;
      let longitude: number | null = null;
      let latitude: number | null = null;
      
      if (Array.isArray(coordinates) && coordinates.length >= 2) {
        const lon = coordinates[0];
        const lat = coordinates[1];
        
        // Validate that both values are numbers, not NaN, and within valid ranges
        if (
          typeof lon === 'number' &&
          !Number.isNaN(lon) &&
          lon >= MIN_LONGITUDE &&
          lon <= MAX_LONGITUDE &&
          typeof lat === 'number' &&
          !Number.isNaN(lat) &&
          lat >= MIN_LATITUDE &&
          lat <= MAX_LATITUDE
        ) {
          longitude = lon;
          latitude = lat;
        }
      }

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
      // Validate latitude is within valid range before setting
      if (
        typeof latitude === 'number' &&
        !Number.isNaN(latitude) &&
        latitude >= MIN_LATITUDE &&
        latitude <= MAX_LATITUDE
      ) {
        setValue('latitude', latitude, { shouldValidate: true, shouldDirty: true });
      }
      // Validate longitude is within valid range before setting
      if (
        typeof longitude === 'number' &&
        !Number.isNaN(longitude) &&
        longitude >= MIN_LONGITUDE &&
        longitude <= MAX_LONGITUDE
      ) {
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
          }, MAPBOX_SELECTION_CLEANUP_DELAY);
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

  // Register/unregister with the singleton resource manager
  // This ensures global resources (styles, event listeners) are shared across all instances
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const instanceId = instanceIdRef.current;
    if (!instanceId) return;

    // Register this instance - will inject global resources if this is the first instance
    mapboxResourceManager.registerInstance(instanceId);

    // Cleanup: unregister this instance - will clean up global resources if this was the last instance
    return () => {
      mapboxResourceManager.unregisterInstance(instanceId);
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
    <div className="relative z-[1] overflow-visible w-full space-y-2">
      <div className="isolate pointer-events-auto overflow-visible relative">
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
