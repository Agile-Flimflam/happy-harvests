import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { fetchWeatherByCoords } from '@/lib/openweather.server';
import type { Tables } from '@/lib/database.types';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createSupabaseServerClient();
    const resolvedParams = params ? await params : undefined;
    const id = resolvedParams?.id;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    // Server-side guard against malformed ids (mirrors client sanitization)
    const SAFE_LOCATION_ID_REGEX = /^[A-Za-z0-9_-]{1,64}$/;
    const UUID_REGEX =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!UUID_REGEX.test(id) && !SAFE_LOCATION_ID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid location id' }, { status: 400 });
    }

    const { data: location, error } = await supabase
      .from('locations')
      .select('id, latitude, longitude')
      .eq('id', id)
      .single<Pick<Tables<'locations'>, 'id' | 'latitude' | 'longitude'>>();
    if (error || !location)
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });

    const { latitude, longitude } = location;
    if (latitude == null || longitude == null) {
      return NextResponse.json({ error: 'Location coordinates are missing' }, { status: 400 });
    }

    const weather = await fetchWeatherByCoords(latitude, longitude, { units: 'imperial' });

    return NextResponse.json(weather, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
