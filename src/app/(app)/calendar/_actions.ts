"use server";

import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Enums } from '@/lib/database.types'

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
  type ActivityRow = {
    id: number
    activity_type: Enums<'activity_type'>
    started_at: string
    ended_at: string | null
    duration_minutes: number | null
    location_id: string | null
    crop: string | null
    asset_name: string | null
    notes: string | null
    activities_soil_amendments?: Array<{ name: string; quantity: number | null; unit: string | null }>
  }
  const { data: acts } = await supabase
    .from('activities')
    .select('id, activity_type, started_at, ended_at, duration_minutes, location_id, crop, asset_name, notes, activities_soil_amendments(name,quantity,unit)')
    .order('started_at', { ascending: true })
  for (const a of ((acts as ActivityRow[]) || [])) {
    events.push({
      id: `a:${a.id}`,
      type: 'activity',
      title: `${a.activity_type.replace('_',' ')}` + (a.crop ? ` · ${a.crop}` : '') + (a.asset_name ? ` · ${a.asset_name}` : ''),
      start: a.started_at,
      end: a.ended_at,
      meta: a as unknown as Record<string, unknown>,
    })
  }
  // Plantings: derive from planting_events for seeded dates, include quantities
  type PlantingSeedRow = {
    id: number
    event_date: string
    event_type: string
    qty: number | null
    weight_grams: number | null
    planting_id: number
    plantings: {
      status: string | null
      crop_varieties: { name: string | null; crops: { name: string | null } | null } | null
    } | null
  }
  const { data: pes } = await supabase
    .from('planting_events')
    .select('id, event_date, event_type, qty, weight_grams, planting_id, plantings(status, crop_varieties(name, crops(name)))')
    .in('event_type', ['nursery_seeded', 'direct_seeded'])
    .order('event_date', { ascending: true })
  for (const pe of ((pes as PlantingSeedRow[]) || [])) {
    events.push({
      id: `p:${pe.planting_id}`,
      type: 'planting',
      title: `Planting · ${pe.plantings?.status ?? ''}`,
      start: pe.event_date,
      meta: {
        status: pe.plantings?.status ?? undefined,
        crop: pe.plantings?.crop_varieties?.crops?.name ?? undefined,
        variety: pe.plantings?.crop_varieties?.name ?? undefined,
        qty: pe.qty ?? undefined,
        weight_grams: pe.weight_grams ?? undefined,
        planting_id: pe.planting_id,
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


