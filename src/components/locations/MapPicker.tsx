'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Map, Marker, Popup } from 'react-map-gl';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LocationFormValues } from '@/lib/validation/locations';
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

/**
 * Validates and normalizes the Mapbox access token from environment variables.
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

  // Validate and normalize Mapbox access token once on mount
  // Returns null if token is undefined, null, empty string, or whitespace-only
  const mapboxToken = useMemo(() => getValidatedMapboxToken(), []);

  // Build address string from form values
  const addressString = useMemo(() => {
    const parts = [street, city, state, zip].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  }, [street, city, state, zip]);

  // Update view state when form coordinates change (but not during drag)
  useEffect(() => {
    if (!isDragging && (latitude != null || longitude != null)) {
      const newLat = latitude ?? DEFAULT_LATITUDE;
      const newLng = longitude ?? DEFAULT_LONGITUDE;
      
      // Only update if coordinates actually changed
      if (
        Math.abs(viewState.latitude - newLat) > 0.0001 ||
        Math.abs(viewState.longitude - newLng) > 0.0001
      ) {
        setViewState((prev) => ({
          ...prev,
          latitude: newLat,
          longitude: newLng,
          zoom: prev.zoom < 10 ? 12 : prev.zoom, // Zoom in if coordinates are set
        }));
      }
    }
  }, [latitude, longitude, isDragging, viewState.latitude, viewState.longitude]);

  // Reverse geocode to get address from coordinates
  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      if (!mapboxToken) return;

      // Track that we're attempting to reverse geocode these coordinates
      lastReverseGeocodedRef.current = { lat, lng };

      setIsReverseGeocoding(true);
      setReverseGeocodeError(null);

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&types=address`
        );

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Mapbox authentication failed. Please check your access token.');
          } else if (response.status === 429) {
            throw new Error('Too many requests. Please try again in a moment.');
          } else if (response.status >= 500) {
            throw new Error('Mapbox service is temporarily unavailable. Please try again later.');
          } else {
            throw new Error('Unable to retrieve address for this location. You can still use the coordinates.');
          }
        }

        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const feature = data.features[0];
          setPopupInfo({
            place_name: feature.place_name,
            address: feature.properties?.address_line1 || feature.place_name,
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
    },
    [mapboxToken]
  );

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(
    (event: { lngLat: { lat: number; lng: number } }) => {
      const { lat, lng } = event.lngLat;
      setIsDragging(false);

      // Update form coordinates
      setValue('latitude', lat, { shouldValidate: true });
      setValue('longitude', lng, { shouldValidate: true });

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
      setValue('latitude', lat, { shouldValidate: true });
      setValue('longitude', lng, { shouldValidate: true });

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
      Math.abs(lastCoords.lat - latitude) > 0.0001 ||
      Math.abs(lastCoords.lng - longitude) > 0.0001;

    if (!isReverseGeocoding && coordsChanged) {
      reverseGeocode(latitude, longitude);
    }
    // Note: reverseGeocode is included in dependencies to satisfy exhaustive-deps.
    // It's stable because mapboxToken (its only dependency) is stable (computed once on mount).
    // This won't cause unnecessary re-renders since mapboxToken doesn't change after initial mount.
  }, [latitude, longitude, addressString, isReverseGeocoding, reverseGeocode]);

  if (!mapboxToken) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Mapbox access token is not configured. Please set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN in your environment variables.
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
            mapboxAccessToken={mapboxToken}
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

