'use client';

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { useFormContext, type ControllerRenderProps } from 'react-hook-form';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LocationFormValues } from '@/lib/validation/locations';
import { isValidCoordinatePair } from '@/lib/validation/locations';
import { getValidatedMapboxToken } from '@/lib/mapbox-utils';
import { setupFormControlPropertyFromInput } from '@/lib/form-utils';
import { markMapboxClick } from '@/lib/mapbox-dialog-utils';
import { Z_INDEX } from '@/lib/ui-constants';

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
  // Explicit form association to ensure form is available even if DOM is reparented
  formId?: string;
}

// Type for the retrieve response - using a compatible interface
interface AddressAutofillRetrieveResponse {
  type: string;
  feature: {
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
  };
  [key: string]: unknown;
}

function isValidRetrieveFeature(
  feature: unknown
): feature is AddressAutofillRetrieveResponse['feature'] {
  if (!feature || typeof feature !== 'object') return false;
  const f = feature as Record<string, unknown>;
  const props = f.properties as Record<string, unknown> | undefined;
  const geometry = f.geometry as Record<string, unknown> | undefined;
  const coords = geometry?.coordinates;
  const coordsOk =
    Array.isArray(coords) &&
    coords.length >= 2 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number' &&
    Number.isFinite(coords[0]) &&
    Number.isFinite(coords[1]);
  return Boolean(props && geometry && coordsOk);
}

function isValidRetrieveResponse(res: unknown): res is AddressAutofillRetrieveResponse {
  if (!res || typeof res !== 'object') return false;
  const maybeFeature = (res as Record<string, unknown>).feature;
  return isValidRetrieveFeature(maybeFeature);
}

// Constants
const STYLE_ID = 'mapbox-autofill-styles';

// Delay in milliseconds before removing the selection-complete data attribute
// This allows Mapbox to finish processing the selection before cleanup
const MAPBOX_SELECTION_CLEANUP_DELAY = 100;

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
 *
 * Memory leak protection:
 * - Tracks registration timestamps to detect stale instances
 * - Automatically cleans up instances that have been registered for an unreasonably long time
 * - This handles edge cases where components crash or unmount without proper cleanup
 *   (e.g., during error boundary catches, browser crashes, or React tree destruction)
 */
interface MapboxAutocompleteResourceManagerOptions {
  maxInstanceAgeMs?: number;
}

class MapboxAutocompleteResourceManager {
  // Track active component instances using a Set of unique instance IDs
  // This is more robust than a simple counter for React StrictMode and concurrent rendering
  private readonly activeInstances = new Set<symbol>();

  // Track registration timestamps for stale instance detection
  // Using WeakMap allows automatic garbage collection of metadata when Symbol is GC'd
  // However, since Symbols are unique and referenced by the Set, they won't be GC'd until removed from Set
  private readonly instanceTimestamps = new WeakMap<symbol, number>();

  // Track if global resources are injected
  private stylesInjected = false;
  private mapboxClickHandler: ((e: MouseEvent | PointerEvent) => void) | null = null;

  // Default maximum age for an instance before it's considered stale (5 minutes)
  // This is a safety mechanism for edge cases where cleanup doesn't run.
  // Normal component lifecycle should be much shorter than this.
  private static readonly DEFAULT_MAX_INSTANCE_AGE_MS = 5 * 60 * 1000;
  private readonly maxInstanceAgeMs: number;

  /**
   * Register a component instance and inject global resources if this is the first instance.
   * Also performs defensive cleanup of stale instances to prevent memory leaks.
   * @param instanceId Unique identifier for this component instance
   */
  constructor(options?: MapboxAutocompleteResourceManagerOptions) {
    this.maxInstanceAgeMs =
      options?.maxInstanceAgeMs ?? MapboxAutocompleteResourceManager.DEFAULT_MAX_INSTANCE_AGE_MS;
  }

  /**
   * Public getter for the default maximum instance age.
   * Allows external code to read the constant without direct access.
   */
  static getDefaultMaxInstanceAgeMs(): number {
    return MapboxAutocompleteResourceManager.DEFAULT_MAX_INSTANCE_AGE_MS;
  }

  registerInstance(instanceId: symbol): void {
    // Clean up any stale instances before registering a new one
    // This is a defensive measure to prevent memory leaks from crashed/unmounted components
    this.cleanupStaleInstances();

    const wasFirstInstance = this.activeInstances.size === 0;
    this.activeInstances.add(instanceId);

    // Track registration timestamp for stale instance detection
    this.instanceTimestamps.set(instanceId, Date.now());

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
    // Note: We don't explicitly delete from WeakMap as it will be automatically cleaned up
    // when the Symbol is garbage collected (though in practice, the Symbol may persist
    // if referenced elsewhere, which is fine since WeakMap doesn't prevent GC)

    if (this.activeInstances.size === 0) {
      this.cleanupResources();
    }
  }

  /**
   * Clean up stale instances that have been registered for an unreasonably long time.
   * This is a defensive measure to prevent memory leaks from components that crash
   * or unmount without proper cleanup (e.g., during error boundary catches).
   *
   * Note: In normal React operation, useEffect cleanup functions are guaranteed to run,
   * so this primarily handles edge cases like browser crashes or React tree destruction.
   */
  private cleanupStaleInstances(): void {
    const now = Date.now();
    const staleInstances: symbol[] = [];

    // Check all active instances for staleness
    // We iterate over the Set to check each instance's age
    for (const instanceId of this.activeInstances) {
      const registrationTime = this.instanceTimestamps.get(instanceId);

      // If we can't find a timestamp, consider it stale (shouldn't happen in normal operation)
      // If the instance is older than MAX_INSTANCE_AGE_MS, consider it stale
      if (!registrationTime || now - registrationTime > this.maxInstanceAgeMs) {
        staleInstances.push(instanceId);
      }
    }

    // Remove stale instances
    // This prevents memory leaks from components that never properly unregistered
    for (const staleInstance of staleInstances) {
      this.activeInstances.delete(staleInstance);
      // Log for debugging in development (helps identify if this is actually happening)
      if (process.env.NODE_ENV === 'development') {
        const registrationTime = this.instanceTimestamps.get(staleInstance);
        const ageSeconds = registrationTime ? Math.round((now - registrationTime) / 1000) : null;
        console.debug(
          '[AddressAutocomplete] Cleaned up stale instance that was registered for',
          ageSeconds !== null ? `${ageSeconds}s` : 'unknown time'
        );
      }
    }

    // If we removed all instances, clean up global resources
    if (this.activeInstances.size === 0 && staleInstances.length > 0) {
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
      /* Ensure Mapbox dropdown is above dialogs (z-${Z_INDEX.dropdown} = ${Z_INDEX.dropdown}) and clickable */
      [class*="mapbox-autofill"],
      [id*="mapbox-autofill"],
      [data-mapbox-autofill],
      [role="listbox"],
      [role="option"] {
        z-index: ${Z_INDEX.autocomplete} !important;
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

    this.mapboxClickHandler = (e: MouseEvent | PointerEvent) => {
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
        markMapboxClick(e);
      }
    };

    // Use capture phase to catch the event early, but don't stop propagation
    // Handle both mouse and pointer events to catch all interaction types
    document.addEventListener('click', this.mapboxClickHandler, true);
    document.addEventListener('mousedown', this.mapboxClickHandler, true);
    document.addEventListener('pointerdown', this.mapboxClickHandler, true);
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
        } catch (error) {
          // Element may have already been removed by another concurrent cleanup
          // This is safe to ignore, but log for debugging purposes
          console.debug(
            '[AddressAutocomplete] Style element removal failed (expected in concurrent cleanup):',
            error instanceof Error ? error.message : String(error)
          );
        }
      }
      this.stylesInjected = false;
    }

    // Guard: only remove listeners if they were actually set up
    // This prevents errors from trying to remove listeners that were already removed
    if (this.mapboxClickHandler) {
      document.removeEventListener('click', this.mapboxClickHandler, true);
      document.removeEventListener('mousedown', this.mapboxClickHandler, true);
      document.removeEventListener('pointerdown', this.mapboxClickHandler, true);
      this.mapboxClickHandler = null;
    }
  }
}

const MAPBOX_MAX_INSTANCE_AGE_ENV_VAR = 'NEXT_PUBLIC_MAPBOX_AUTOCOMPLETE_MAX_INSTANCE_AGE_MS';

function getMaxInstanceAgeMsFromEnv(): number {
  const rawValue = process.env[MAPBOX_MAX_INSTANCE_AGE_ENV_VAR];
  if (typeof rawValue === 'string' && rawValue.trim() !== '') {
    const parsedValue = Number(rawValue.trim());
    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }
  }

  return MapboxAutocompleteResourceManager.getDefaultMaxInstanceAgeMs();
}

// Singleton instance - shared across all AddressAutocomplete component instances
const mapboxResourceManager = new MapboxAutocompleteResourceManager({
  maxInstanceAgeMs: getMaxInstanceAgeMsFromEnv(),
});

export function AddressAutocomplete({
  className,
  placeholder = 'Start typing an address...',
  disabled = false,
  field,
  formId,
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

  // Validate provided formId to avoid silent failures when the form cannot be found
  useEffect(() => {
    // Only warn when a formId is explicitly provided
    if (!isMounted || !formId || typeof document === 'undefined') return;
    const formEl = document.getElementById(formId);
    if (!formEl || formEl.tagName !== 'FORM') {
      const message = 'Form not found for the provided formId.';
      console.warn('[AddressAutocomplete] ' + message, { formId });
      setError(message);
    }
  }, [formId, isMounted]);

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
      setupFormControlPropertyFromInput(input);

      // Schedule a single retry as a fallback if form association happens asynchronously
      timeoutId = setTimeout(() => {
        setupFormControlPropertyFromInput(inputRef.current);
      }, 10);
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
  }, [isMounted]);

  // Set up form control property on focus events to ensure it's available
  // before browser extensions try to access it during focus handlers
  // This is critical because extensions check form.control synchronously during focus events
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Ensure form control property is set up before extension checks it
    // This must happen synchronously before the extension's focus handler runs
    setupFormControlPropertyFromInput(e.target);
  }, []);

  // Also set up on focusin (capture phase) to catch it even earlier
  // This ensures the property is set up before any extension focus handlers run
  useEffect(() => {
    if (typeof window === 'undefined' || !isMounted) return;

    const input = inputRef.current;
    if (!input) return;

    const handleFocusIn = (e: FocusEvent) => {
      // Only handle focus events for our input
      if (e.target !== input && !input.contains(e.target as Node)) return;

      // Ensure form control property is set up synchronously
      // This must happen before the extension's focus handler runs
      setupFormControlPropertyFromInput(input);
    };

    // Use capture phase to run before extension handlers
    input.addEventListener('focusin', handleFocusIn, true);

    return () => {
      input.removeEventListener('focusin', handleFocusIn, true);
    };
  }, [isMounted, setupFormControlProperty]);

  // Use field value if provided (from FormField), otherwise watch the form
  // Fallback to empty string if watch is not available or component not mounted
  const addressValue = field?.value ?? (isMounted && watch ? watch('street') : '') ?? '';

  // SECURITY CONSIDERATION: Mapbox access token usage
  //
  // IMPORTANT: The @mapbox/search-js-react library requires the token to be passed as a prop,
  // which means it will be embedded in the client-side JavaScript bundle. This is a limitation of the library.
  //
  // Security measures implemented:
  // 1. Token is validated to ensure it's not a secret token (sk.*) in development
  // 2. Token is never logged or exposed in error messages
  // 3. Token is only used for address autocomplete (read-only operations)
  //
  // Required Mapbox token configuration:
  // - MUST be a PUBLIC token (pk.*), NOT a secret token (sk.*)
  // - MUST have URL restrictions configured in Mapbox dashboard
  // - MUST have minimal scopes: geocoding API access only
  // - MUST NOT have uploads, datasets, or write permissions
  // - MUST monitor usage in Mapbox dashboard regularly
  // - MUST rotate tokens periodically
  //
  // See README.md for additional security documentation

  // Validate and normalize Mapbox access token
  // WARNING: This token will be embedded in client-side code due to @mapbox/search-js-react requirements
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
    (res: unknown) => {
      if (!isValidRetrieveResponse(res)) {
        setIsLoading(false);
        setError('Invalid address data returned. Please try again.');
        return;
      }
      setIsLoading(false);
      setError(null);

      // Check if component is mounted before proceeding
      // setValue is guaranteed to exist from useFormContext (throws if not in FormProvider)
      if (!isMounted) {
        console.warn('AddressAutocomplete: Component not mounted, skipping form update');
        return;
      }

      // Ensure form control property is set up before processing selection
      // This prevents browser extension errors when they check form.control during focus events
      // that may occur when Mapbox processes the selection
      // Set it up immediately and also schedule it for the next microtask to catch async extension checks
      const input = inputRef.current;
      if (input) {
        setupFormControlPropertyFromInput(input);
        // Also set it up in a microtask to catch Promise-based extension checks
        Promise.resolve().then(() => {
          setupFormControlPropertyFromInput(input);
        });
      }

      const feature = res.feature;
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

        const lonIsNumber = typeof lon === 'number';
        const latIsNumber = typeof lat === 'number';

        // Validate that both values are numeric and within valid WGS84 ranges.
        // The explicit typeof checks clarify whether we received numbers before
        // running the shared validation utility.
        if (lonIsNumber && latIsNumber && isValidCoordinatePair(lat, lon)) {
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
      // Coordinates are already validated when extracted from the geometry
      // Only set if they were successfully validated (not null)
      if (latitude !== null) {
        setValue('latitude', latitude, { shouldValidate: true, shouldDirty: true });
      }
      if (longitude !== null) {
        setValue('longitude', longitude, { shouldValidate: true, shouldDirty: true });
      }

      // Close the dropdown and manage focus after Mapbox processes the selection
      // CRITICAL: We must keep focus within the dialog to prevent it from closing
      if (inputRef.current) {
        // Ensure form control property is set up one more time
        setupFormControlPropertyFromInput(inputRef.current);

        // Mark that we're programmatically closing the dropdown
        inputRef.current.setAttribute('data-mapbox-selection-complete', 'true');

        // Find the dialog and mark it as processing Mapbox selection
        // Set this IMMEDIATELY (synchronously) before any async operations
        const form = inputRef.current.form;
        const dialog = form?.closest('[data-slot="dialog-content"]');
        if (dialog) {
          // Set both flags immediately to prevent dialog closing
          dialog.setAttribute('data-mapbox-selection-in-progress', 'true');
        }

        // Find the next focusable element BEFORE blurring
        // This ensures we can focus it immediately to prevent focus from leaving the dialog
        let nextFocusableElement: HTMLElement | null = null;
        if (form) {
          const focusableElements = form.querySelectorAll<HTMLElement>(
            'input:not([disabled]):not([readonly]):not([data-mapbox-autofill]), textarea:not([disabled]):not([readonly]), select:not([disabled]), button:not([disabled])'
          );

          for (const element of focusableElements) {
            if (element !== inputRef.current && element.offsetParent !== null) {
              nextFocusableElement = element;
              break;
            }
          }
        }

        // Use requestAnimationFrame to ensure Mapbox has finished processing the selection
        requestAnimationFrame(() => {
          // Ensure form control property is still set up
          setupFormControlPropertyFromInput(inputRef.current);

          // CRITICAL: Focus the next element BEFORE blurring to prevent focus from leaving the dialog
          // This must happen synchronously to prevent onFocusOutside from firing
          if (nextFocusableElement) {
            nextFocusableElement.focus();
          }

          // Now blur the input to close the dropdown
          // Since we've already moved focus, this blur won't cause focus to leave the dialog
          inputRef.current?.blur();

          // Clean up data attributes after a short delay
          setTimeout(() => {
            inputRef.current?.removeAttribute('data-mapbox-selection-complete');
            if (dialog) {
              dialog.removeAttribute('data-mapbox-selection-in-progress');
              dialog.removeAttribute('data-mapbox-dropdown-open');
            }
          }, MAPBOX_SELECTION_CLEANUP_DELAY);
        });
      }
    },
    [setValue, isMounted]
  );

  const handleSuggest = useCallback(() => {
    setIsLoading(true);
    setError(null);

    // Mark the dialog as having an active Mapbox dropdown
    // This prevents the dialog from closing when clicking on suggestions
    if (inputRef.current) {
      const form = inputRef.current.form;
      const dialog = form?.closest('[data-slot="dialog-content"]');
      if (dialog) {
        dialog.setAttribute('data-mapbox-dropdown-open', 'true');
      }
    }
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
          <span>
            Mapbox access token is not configured. Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in
            your environment variables.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-[1] overflow-visible w-full space-y-2">
      <div className="isolate pointer-events-auto overflow-visible relative">
        <AddressAutofill
          accessToken={mapboxToken}
          onRetrieve={handleRetrieve}
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
            form={formId}
            value={addressValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
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
