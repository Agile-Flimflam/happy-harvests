/**
 * Server-side Mapbox utilities.
 * These functions run on the server and keep the Mapbox access token secure.
 */

import { isValidCoordinatePair } from '@/lib/validation/locations';

/**
 * Gets the Mapbox access token from server-side environment variables.
 * For server-side use, prefer MAPBOX_ACCESS_TOKEN (without NEXT_PUBLIC_ prefix)
 * to keep the token secure. Falls back to NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN if needed.
 *
 * @returns The validated token string
 * @throws Error if no valid token is configured
 */
function getServerMapboxToken(): string {
  // Prefer server-only token (more secure)
  const serverToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (serverToken && typeof serverToken === 'string' && serverToken.trim().length > 0) {
    return serverToken.trim();
  }

  // Fallback to public token (still works, but less secure)
  const publicToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (publicToken && typeof publicToken === 'string' && publicToken.trim().length > 0) {
    return publicToken.trim();
  }

  throw new Error('Mapbox access token is not configured');
}

export class MapboxReverseGeocodeError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'MapboxReverseGeocodeError';
  }
}

export type ReverseGeocodeResult = {
  place_name?: string;
  address?: string;
};

export type ReverseGeocodeResponse = {
  features?: Array<{
    place_name?: string;
    properties?: {
      address_line1?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

/**
 * Reverse geocodes coordinates to get address information.
 * This function runs on the server to keep the Mapbox access token secure.
 *
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param options - Optional configuration
 * @returns Address information or null if not found
 * @throws Error if the request fails or token is invalid
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  options: { types?: string } = {}
): Promise<ReverseGeocodeResult | null> {
  const token = getServerMapboxToken();

  // Validate coordinates using shared validation function
  if (!isValidCoordinatePair(latitude, longitude)) {
    throw new MapboxReverseGeocodeError(400, 'Invalid coordinates provided');
  }

  const types = options.types || 'address';
  const url = new URL(
    'https://api.mapbox.com/geocoding/v5/mapbox.places/' + `${longitude},${latitude}.json`
  );
  url.searchParams.set('access_token', token);
  url.searchParams.set('types', types);

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'User-Agent': 'happy-harvests/1.0',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new MapboxReverseGeocodeError(
        401,
        'Mapbox authentication failed. Please check your access token.'
      );
    } else if (response.status === 429) {
      throw new MapboxReverseGeocodeError(429, 'Too many requests. Please try again in a moment.');
    } else if (response.status >= 500) {
      throw new MapboxReverseGeocodeError(
        503,
        'Mapbox service is temporarily unavailable. Please try again later.'
      );
    } else {
      throw new MapboxReverseGeocodeError(
        response.status,
        'Unable to retrieve address for this location.'
      );
    }
  }

  const data = (await response.json()) as ReverseGeocodeResponse;

  if (data.features && data.features.length > 0) {
    const feature = data.features[0];
    return {
      place_name: feature.place_name,
      address: feature.properties?.address_line1 || feature.place_name,
    };
  }

  return null;
}
