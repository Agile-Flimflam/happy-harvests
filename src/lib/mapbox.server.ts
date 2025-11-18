/**
 * Server-side Mapbox utilities.
 * These functions run on the server and keep the Mapbox access token secure.
 */

/**
 * Gets the Mapbox access token from server-side environment variables.
 * For server-side use, prefer MAPBOX_ACCESS_TOKEN (without NEXT_PUBLIC_ prefix)
 * to keep the token secure. Falls back to NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN if needed.
 * 
 * @returns The validated token string, or null if invalid
 */
function getServerMapboxToken(): string | null {
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
  
  return null;
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
  if (!token) {
    throw new Error('Mapbox access token is not configured');
  }

  // Validate coordinates
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Invalid coordinates provided');
  }

  const types = options.types || 'address';
  const url = new URL('https://api.mapbox.com/geocoding/v5/mapbox.places/' + `${longitude},${latitude}.json`);
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
      throw new Error('Mapbox authentication failed. Please check your access token.');
    } else if (response.status === 429) {
      throw new Error('Too many requests. Please try again in a moment.');
    } else if (response.status >= 500) {
      throw new Error('Mapbox service is temporarily unavailable. Please try again later.');
    } else {
      throw new Error('Unable to retrieve address for this location.');
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

