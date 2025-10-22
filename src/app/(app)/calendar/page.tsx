import { createSupabaseServerClient } from '@/lib/supabase-server'
import CalendarClient, { type CalendarEvent } from './CalendarClient'
import CalendarHeaderWeather from './CalendarHeaderWeather'
import Link from 'next/link'

async function getCalendarEvents(): Promise<CalendarEvent[]> {
  const supabase = await createSupabaseServerClient()
  const events: CalendarEvent[] = []
  // Activities (historical + future)
  const { data: acts } = await supabase
    .from('activities')
    .select('id, activity_type, started_at, ended_at, location_id, crop, asset_name, notes')
    .order('started_at', { ascending: true })
  for (const a of acts || []) {
    events.push({
      id: `a:${a.id}`,
      type: 'activity',
      title: `${a.activity_type.replace('_',' ')}` + (a.crop ? ` · ${a.crop}` : '') + (a.asset_name ? ` · ${a.asset_name}` : ''),
      start: a.started_at,
      end: a.ended_at,
      meta: a as any,
    })
  }
  // Plantings (use planted_date or nursery_started_date as events)
  const { data: pls } = await supabase
    .from('plantings')
    .select('id, planted_date, nursery_started_date, status')
    .order('planted_date', { ascending: true })
  for (const p of pls || []) {
    const when = p.planted_date || p.nursery_started_date
    if (!when) continue
    events.push({
      id: `p:${p.id}`,
      type: 'planting',
      title: `Planting · ${p.status}`,
      start: when,
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
    .select('id, latitude, longitude')
    .order('created_at', { ascending: true })
    .limit(10)
  const primary = (locations || []).find((l) => l.latitude != null && l.longitude != null) as
    | { id: string; latitude: number | null; longitude: number | null }
    | undefined
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendar</h1>
        <div className="flex gap-2">
          <Link className="border px-3 py-2 rounded" href="/activities/new">Schedule Activity</Link>
          <Link className="border px-3 py-2 rounded" href="/plantings">Manage Plantings</Link>
        </div>
      </div>
      <div>
        <CalendarHeaderWeather id={primary?.id ?? null} latitude={primary?.latitude ?? null} longitude={primary?.longitude ?? null} />
      </div>
      <CalendarClient events={events} />
    </div>
  )
}


