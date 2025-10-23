import { createSupabaseServerClient } from '@/lib/supabase-server'
import CalendarClient, { type CalendarEvent } from './CalendarClient'
import CalendarHeaderWeather from './CalendarHeaderWeather'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = await createSupabaseServerClient()
  const events: CalendarEvent[] = []
  // Activities (historical + future)
  const { data: acts } = await supabase
    .from('activities')
    .select('id, activity_type, started_at, ended_at, duration_minutes, location_id, crop, asset_name, notes, activities_soil_amendments(name,quantity,unit)')
    .order('started_at', { ascending: true })
  for (const a of acts || []) {
    events.push({
      id: `a:${a.id}`,
      type: 'activity',
      title: `${a.activity_type.replace('_',' ')}` + (a.crop ? ` · ${a.crop}` : '') + (a.asset_name ? ` · ${a.asset_name}` : ''),
      start: a.started_at,
      end: a.ended_at,
      meta: a as Record<string, unknown>,
    })
  }
  // Plantings: derive from planting_events for seeded dates, include quantities
  const { data: pes } = await supabase
    .from('planting_events')
    .select('id, event_date, event_type, qty, weight_grams, planting_id, plantings(status, crop_varieties(name, crops(name)))')
    .in('event_type', ['nursery_seeded', 'direct_seeded'])
    .order('event_date', { ascending: true })
  for (const pe of pes || []) {
    events.push({
      id: `p:${pe.planting_id}`,
      type: 'planting',
      title: `Planting · ${pe.plantings?.status ?? ''}`,
      start: pe.event_date,
      meta: {
        status: pe.plantings?.status,
        crop: pe.plantings?.crop_varieties?.crops?.name,
        variety: pe.plantings?.crop_varieties?.name,
        qty: pe.qty,
        weight_grams: pe.weight_grams,
        planting_id: pe.planting_id,
      },
    })
  }
  return events
}

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient()
  const events = await getCalendarEvents()
  // Find the first location with coordinates for weather display
  const { data: locations } = await supabase
    .from('locations')
    .select('id, name, latitude, longitude')
    .order('created_at', { ascending: true })
    .limit(10)
  const primary = (locations || []).find((l) => l.latitude != null && l.longitude != null) as
    | { id: string; name: string; latitude: number | null; longitude: number | null }
    | undefined
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <div className="flex gap-2">
          <Link className="border px-3 py-2 rounded transition-colors active:scale-95 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40" href="/activities/new">Schedule Activity</Link>
          <Link className="border px-3 py-2 rounded transition-colors active:scale-95 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40" href="/plantings">Manage Plantings</Link>
        </div>
      </div>
      <div>
        <CalendarHeaderWeather id={primary?.id ?? null} latitude={primary?.latitude ?? null} longitude={primary?.longitude ?? null} />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="rounded-xl bg-gradient-to-b from-muted/20 via-muted/10 to-transparent p-3 sm:p-4">
            <CalendarClient events={events} locations={(locations || []) as Array<{ id: string; name: string; latitude: number | null; longitude: number | null }>} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


