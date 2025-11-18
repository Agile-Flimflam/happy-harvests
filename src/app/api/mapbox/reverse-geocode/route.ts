import { NextRequest, NextResponse } from 'next/server';
import { reverseGeocode } from '@/lib/mapbox.server';

export const dynamic = 'force-dynamic';

/**
 * API route for Mapbox reverse geocoding.
 * This endpoint proxies reverse geocoding requests to keep the Mapbox access token secure.
 * 
 * Query parameters:
 * - latitude: number (required)
 * - longitude: number (required)
 * - types: string (optional, defaults to 'address')
 * 
 * Security benefits:
 * - Mapbox access token is kept server-side
 * - Can add rate limiting and request validation
 * - Prevents token exposure in browser network requests
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latitudeParam = searchParams.get('latitude');
    const longitudeParam = searchParams.get('longitude');
    const types = searchParams.get('types') || 'address';

    // Validate required parameters
    if (!latitudeParam || !longitudeParam) {
      return NextResponse.json(
        { error: 'Missing required parameters: latitude and longitude' },
        { status: 400 }
      );
    }

    // Parse and validate coordinates
    const latitude = Number.parseFloat(latitudeParam);
    const longitude = Number.parseFloat(longitudeParam);

    if (
      Number.isNaN(latitude) ||
      Number.isNaN(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: 'Invalid coordinates provided' },
        { status: 400 }
      );
    }

    // Call server-side reverse geocoding function
    const result = await reverseGeocode(latitude, longitude, { types });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('authentication') ? 401 : 
                   message.includes('Too many requests') ? 429 :
                   message.includes('temporarily unavailable') ? 503 : 500;
    
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

