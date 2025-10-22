import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { fetchWeatherByCoords } from '@/lib/openweather.server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const pathname = new URL(req.url).pathname
    const match = pathname.match(/\/api\/locations\/([^/]+)\/weather$/)
    const id = match?.[1]
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const { data: location, error } = await supabase
      .from('locations')
      .select('id, latitude, longitude')
      .eq('id', id)
      .single()
    if (error || !location) return NextResponse.json({ error: 'Location not found' }, { status: 404 })

    const { latitude, longitude } = location as { latitude: number | null; longitude: number | null }
    if (latitude == null || longitude == null) {
      return NextResponse.json({ error: 'Location coordinates are missing' }, { status: 400 })
    }

    const weather = await fetchWeatherByCoords(latitude, longitude, { units: 'imperial' })

    return NextResponse.json(weather, { status: 200 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


