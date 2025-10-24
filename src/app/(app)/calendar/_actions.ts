"use server";

import { createSupabaseServerClient } from '@/lib/supabase-server'

export type CalendarEvent = {
  id: string
  type: 'activity' | 'planting'
  title: string
  start: string
  end?: string | null
  meta?: Record<string, unknown>
}

export async function getCalendarEvents(): Promise<{ events: CalendarEvent[] }> {
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
      title: `${(a as any).activity_type.replace('_',' ')}` + (a.crop ? ` · ${a.crop}` : '') + (a.asset_name ? ` · ${a.asset_name}` : ''),
      start: (a as any).started_at,
      end: (a as any).ended_at,
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
      title: `Planting · ${(pe as any).plantings?.status ?? ''}`,
      start: (pe as any).event_date,
      meta: {
        status: (pe as any).plantings?.status,
        crop: (pe as any).plantings?.crop_varieties?.crops?.name,
        variety: (pe as any).plantings?.crop_varieties?.name,
        qty: (pe as any).qty,
        weight_grams: (pe as any).weight_grams,
        planting_id: (pe as any).planting_id,
      },
    })
  }
  return { events }
}

export async function getCalendarLocations(): Promise<{ locations: Array<{ id: string; name: string; latitude: number | null; longitude: number | null }> }> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('locations')
    .select('id, name, latitude, longitude')
    .order('created_at', { ascending: true })
    .limit(10)
  return { locations: (data as Array<{ id: string; name: string; latitude: number | null; longitude: number | null }>) || [] }
}


