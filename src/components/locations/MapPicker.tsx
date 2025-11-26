'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Map, Marker, Popup } from 'react-map-gl';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LocationFormValues } from '@/lib/validation/locations';
import { getValidatedMapboxToken } from '@/lib/mapbox-utils';
import 'mapbox-gl/dist/mapbox-gl.css';

interface MapPickerProps {
  className?: string;
  height?: string;
  disabled?: boolean;
}

interface ReverseGeocodeResult {
  place_name?: string;
  address?: string;
}

// Default center (US center)
const DEFAULT_LATITUDE = 39.8283;
const DEFAULT_LONGITUDE = -98.5795;
const DEFAULT_ZOOM = 3;

// Threshold for coordinate comparison (in degrees)
// 0.0001 degrees is roughly 11 meters at the equator and decreases toward the poles,
// so this is an approximation meant only to prevent frequent updates from tiny drifts.
// Used to determine if coordinates have changed significantly enough to trigger updates
const COORDINATE_CHANGE_THRESHOLD = 0.0001;

export function MapPicker({
  className,
  height = 'h-[300px] sm:h-[400px] md:h-[500px]',
  disabled = false,
}: MapPickerProps) {
  const { watch, setValue } = useFormContext<LocationFormValues>();
  const latitude = watch('latitude');
  const longitude = watch('longitude');
  const street = watch('street');
  const city = watch('city');
  const state = watch('state');
  const zip = watch('zip');

  const [viewState, setViewState] = useState({
    latitude: latitude ?? DEFAULT_LATITUDE,
    longitude: longitude ?? DEFAULT_LONGITUDE,
    zoom: DEFAULT_ZOOM,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [reverseGeocodeError, setReverseGeocodeError] = useState<string | null>(null);
  const [popupInfo, setPopupInfo] = useState<ReverseGeocodeResult | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  // Track last coordinates we've attempted to reverse geocode to prevent duplicate calls
  const lastReverseGeocodedRef = useRef<{ lat: number; lng: number } | null>(null);

  // Store the latest reverseGeocode function in a ref to avoid including it in effect dependencies
  // This prevents unnecessary re-renders when the function reference changes
  const reverseGeocodeRef = useRef<((lat: number, lng: number) => Promise<void>) | null>(null);

  // Track last form coordinates we've processed to update viewState
  // This prevents the effect from running on every map pan/zoom interaction
  const lastProcessedFormCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  // SECURITY CONSIDERATION: Mapbox access token usage
  //
  // IMPORTANT: The mapbox-gl library requires the token to be passed as a prop, which means
  // it will be embedded in the client-side JavaScript bundle. This is a limitation of the library.
  //
  // Security measures implemented:
  // 1. Reverse geocoding is proxied through /api/mapbox/reverse-geocode (token kept server-side)
  // 2. Token is validated to ensure it's not a secret token (sk.*) in development
  // 3. Token is never logged or exposed in error messages
  // 4. Token is only used for map display (read-only operations)
  //
  // Required Mapbox token configuration:
  // - MUST be a PUBLIC token (pk.*), NOT a secret token (sk.*)
  // - MUST have URL restrictions configured in Mapbox dashboard
  // - MUST have minimal scopes: styles:read, fonts:read, sprites:read only
  // - MUST NOT have uploads, datasets, or write permissions
  // - MUST monitor usage in Mapbox dashboard regularly
  // - MUST rotate tokens periodically
  //
  // See README.md for additional security documentation

  // Validate and normalize Mapbox access token once on mount
  // WARNING: This token will be embedded in client-side code due to mapbox-gl requirements
  // Returns null if token is undefined, null, empty string, or whitespace-only
  const mapboxToken = useMemo(() => {
    const token = getValidatedMapboxToken();
    // Never log the token, even in development
    if (!token && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.warn('Mapbox token not configured. Map display will not work.');
    }
    return token;
  }, []);

  // Build address string from form values
  const addressString = useMemo(() => {
    const parts = [street, city, state, zip].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [street, city, state, zip]);

  // Update view state when form coordinates change (but not during drag)
  // Uses a ref to track last processed coordinates to prevent running on every map pan/zoom
  useEffect(() => {
    if (!isDragging && (latitude != null || longitude != null)) {
      const newLat = latitude ?? DEFAULT_LATITUDE;
      const newLng = longitude ?? DEFAULT_LONGITUDE;
      const lastProcessed = lastProcessedFormCoordsRef.current;

      // Only update if coordinates actually changed from what we last processed
      const coordsChanged =
        !lastProcessed ||
        Math.abs(lastProcessed.lat - newLat) > COORDINATE_CHANGE_THRESHOLD ||
        Math.abs(lastProcessed.lng - newLng) > COORDINATE_CHANGE_THRESHOLD;

      if (coordsChanged) {
        setViewState((prev) => ({
          ...prev,
          latitude: newLat,
          longitude: newLng,
          zoom: prev.zoom < 10 ? 12 : prev.zoom, // Zoom in if coordinates are set
        }));
        // Update ref to track that we've processed these coordinates
        lastProcessedFormCoordsRef.current = { lat: newLat, lng: newLng };
      }
    } else if (latitude == null || longitude == null) {
      // Reset ref when coordinates are cleared
      lastProcessedFormCoordsRef.current = null;
    }
  }, [latitude, longitude, isDragging]);

  // Reverse geocode to get address from coordinates
  // Uses backend API route to keep Mapbox access token secure server-side
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    // Track that we're attempting to reverse geocode these coordinates
    lastReverseGeocodedRef.current = { lat, lng };

    setIsReverseGeocoding(true);
    setReverseGeocodeError(null);

    try {
      // Use backend API route instead of direct Mapbox API call
      // This keeps the access token secure on the server
      const url = new URL('/api/mapbox/reverse-geocode', window.location.origin);
      url.searchParams.set('latitude', String(lat));
      url.searchParams.set('longitude', String(lng));
      url.searchParams.set('types', 'address');

      // Use backend API route - token is kept server-side and never exposed in URLs
      const response = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
        // Ensure credentials are not sent (token is server-side)
        credentials: 'same-origin',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || response.statusText;

        if (response.status === 401) {
          throw new Error('Mapbox authentication failed. Please check your access token.');
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please try again in a moment.');
        } else if (response.status >= 500) {
          throw new Error('Mapbox service is temporarily unavailable. Please try again later.');
        } else {
          throw new Error(
            errorMessage ||
              'Unable to retrieve address for this location. You can still use the coordinates.'
          );
        }
      }

      const data = await response.json();
      if (data && (data.place_name || data.address)) {
        setPopupInfo({
          place_name: data.place_name,
          address: data.address || data.place_name,
        });
        setShowPopup(true);
        setReverseGeocodeError(null);
      } else {
        // No address found, but that's okay - coordinates are still valid
        setPopupInfo(null);
        setShowPopup(false);
        setReverseGeocodeError(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unable to retrieve address information. The coordinates are still valid.';
      setReverseGeocodeError(errorMessage);
      setPopupInfo(null);
      setShowPopup(false);
    } finally {
      setIsReverseGeocoding(false);
    }
  }, []);

  // Keep the ref updated with the latest reverseGeocode function
  useEffect(() => {
    reverseGeocodeRef.current = reverseGeocode;
  }, [reverseGeocode]);

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(
    (event: { lngLat: { lat: number; lng: number } }) => {
      const { lat, lng } = event.lngLat;
      setIsDragging(false);

      // Update form coordinates
      setValue('latitude', lat, { shouldValidate: true, shouldDirty: true });
      setValue('longitude', lng, { shouldValidate: true, shouldDirty: true });

      // Reverse geocode to get address
      reverseGeocode(lat, lng);
    },
    [setValue, reverseGeocode]
  );

  // Handle map click
  const handleMapClick = useCallback(
    (event: { lngLat: { lat: number; lng: number } }) => {
      if (disabled) return;
      const { lat, lng } = event.lngLat;

      // Update form coordinates
      setValue('latitude', lat, { shouldValidate: true, shouldDirty: true });
      setValue('longitude', lng, { shouldValidate: true, shouldDirty: true });

      // Reverse geocode to get address
      reverseGeocode(lat, lng);
    },
    [disabled, setValue, reverseGeocode]
  );

  // Reset the reverse geocode tracking ref when coordinates are cleared
  // This ensures that if coordinates are set again (even to the same values),
  // reverse geocoding will trigger again
  useEffect(() => {
    if (latitude == null || longitude == null) {
      lastReverseGeocodedRef.current = null;
    }
  }, [latitude, longitude]);

  // Show popup when coordinates exist and we have address info
  useEffect(() => {
    if (latitude == null || longitude == null) {
      return;
    }

    // If we have an address string, use it for the popup
    if (addressString) {
      setPopupInfo({ address: addressString });
      setShowPopup(true);
      return;
    }

    // If we don't have an address, try to reverse geocode
    // Only call if:
    // 1. We're not already reverse geocoding
    // 2. These coordinates are different from the last ones we tried
    const lastCoords = lastReverseGeocodedRef.current;
    const coordsChanged =
      !lastCoords ||
      Math.abs(lastCoords.lat - latitude) > COORDINATE_CHANGE_THRESHOLD ||
      Math.abs(lastCoords.lng - longitude) > COORDINATE_CHANGE_THRESHOLD;

    if (!isReverseGeocoding && coordsChanged && reverseGeocodeRef.current) {
      reverseGeocodeRef.current(latitude, longitude);
    }
    // Note: This effect uses reverseGeocodeRef.current instead of reverseGeocode directly.
    // This ref pattern is intentional and avoids circular dependencies. If we included reverseGeocode
    // in the dependency array, it would create an infinite loop: coordinates change → effect runs →
    // reverseGeocode called → state updates (isReverseGeocoding, popupInfo, etc.) → effect runs again.
    // The ref pattern stores the latest function without triggering re-renders when the function
    // reference changes. The ref is updated in a separate effect (lines 210-212) whenever
    // reverseGeocode changes, ensuring we always call the latest version of the function.
  }, [latitude, longitude, addressString, isReverseGeocoding]);

  if (!mapboxToken) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Mapbox access token is not configured. Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in
              your environment variables.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasCoordinates = latitude != null && longitude != null;
  const markerLat = latitude ?? viewState.latitude;
  const markerLng = longitude ?? viewState.longitude;

  return (
    <Card className={cn('w-full overflow-hidden', className)}>
      <CardContent className="p-0">
        <div className={cn('relative w-full', height)}>
          <Map
            {...viewState}
            onMove={(evt) => setViewState(evt.viewState)}
            onClick={handleMapClick}
            mapboxAccessToken={mapboxToken || ''}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            style={{ width: '100%', height: '100%' }}
            cursor={disabled ? 'default' : 'pointer'}
            doubleClickZoom={!disabled}
            dragPan={!disabled}
            scrollZoom={!disabled}
          >
            {hasCoordinates && (
              <Marker
                latitude={markerLat}
                longitude={markerLng}
                draggable={!disabled}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleMarkerDragEnd}
                anchor="bottom"
              >
                <div className="relative">
                  <MapPin className="h-6 w-6 text-primary fill-primary drop-shadow-lg" />
                  {isDragging && (
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-primary text-primary-foreground text-xs px-2 py-1 rounded shadow-lg">
                      Drag to move
                    </div>
                  )}
                </div>
              </Marker>
            )}

            {showPopup && popupInfo && hasCoordinates && (
              <Popup
                latitude={markerLat}
                longitude={markerLng}
                anchor="bottom"
                closeButton={false}
                closeOnClick={false}
                onClose={() => setShowPopup(false)}
              >
                <div className="space-y-1">
                  {isReverseGeocoding ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading address...</span>
                    </div>
                  ) : (
                    <>
                      {popupInfo.address && (
                        <div className="font-medium text-sm">{popupInfo.address}</div>
                      )}
                      {popupInfo.place_name && popupInfo.place_name !== popupInfo.address && (
                        <div className="text-xs text-muted-foreground">{popupInfo.place_name}</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {markerLat.toFixed(6)}, {markerLng.toFixed(6)}
                      </div>
                    </>
                  )}
                </div>
              </Popup>
            )}
          </Map>

          {reverseGeocodeError && (
            <div className="absolute bottom-4 left-4 right-4 z-10 flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{reverseGeocodeError}</span>
            </div>
          )}

          {!hasCoordinates && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
              <div className="text-center space-y-2 p-4">
                <MapPin className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {disabled ? 'No coordinates set' : 'Click on the map to set location'}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
