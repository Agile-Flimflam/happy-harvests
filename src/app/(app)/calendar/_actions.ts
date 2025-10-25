"use server";

import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Enums } from '@/lib/database.types'

export type CalendarEvent = {
  id: string
  type: 'activity' | 'planting' | 'harvest'
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
  // Harvests: use actual harvested event date if present; else predict from planted/nursery dates and DTM
  function addDays(dateISO: string, days: number): string {
    const dt = new Date(dateISO + 'T00:00:00Z')
    dt.setUTCDate(dt.getUTCDate() + days)
    return dt.toISOString().slice(0, 10)
  }
  type HarvestEventRow = { planting_id: number; event_date: string }
  const { data: harvestedRows } = await supabase
    .from('planting_events')
    .select('planting_id, event_date')
    .eq('event_type', 'harvested')
  const actualHarvestMap = new Map<number, string>()
  for (const hr of ((harvestedRows as HarvestEventRow[]) || [])) {
    if (!actualHarvestMap.has(hr.planting_id)) actualHarvestMap.set(hr.planting_id, hr.event_date)
  }
  type PlantingRow = {
    id: number
    status: string | null
    nursery_started_date: string | null
    planted_date: string | null
    propagation_method: string
    crop_varieties: {
      name: string | null
      crops: { name: string | null } | null
      dtm_direct_seed_min: number
      dtm_transplant_min: number
    } | null
  }
  const { data: plantings } = await supabase
    .from('plantings')
    .select('id, status, nursery_started_date, planted_date, propagation_method, crop_varieties(name, crops(name), dtm_direct_seed_min, dtm_transplant_min)')
  for (const p of ((plantings as PlantingRow[]) || [])) {
    const crop = p.crop_varieties?.crops?.name ?? undefined
    const variety = p.crop_varieties?.name ?? undefined
    const plantedDate = p.planted_date
    const nurseryStart = p.nursery_started_date
    const dsMin = p.crop_varieties?.dtm_direct_seed_min ?? 0
    const tpMin = p.crop_varieties?.dtm_transplant_min ?? 0
    let harvestDate: string | null = actualHarvestMap.get(p.id) ?? null
    let source: 'actual' | 'predicted' | null = harvestDate ? 'actual' : null
    if (!harvestDate) {
      if (plantedDate && (!nurseryStart || p.propagation_method === 'Direct Seed')) {
        if (dsMin > 0) {
          harvestDate = addDays(plantedDate, dsMin)
          source = 'predicted'
        }
      } else if (plantedDate && nurseryStart) {
        if (tpMin > 0) {
          harvestDate = addDays(plantedDate, tpMin)
          source = 'predicted'
        }
      }
    }
    if (harvestDate) {
      const titleParts = ['Harvest']
      if (crop) titleParts.push(String(crop))
      if (variety) titleParts.push(String(variety))
      events.push({
        id: `h:${p.id}`,
        type: 'harvest',
        title: titleParts.join(' · '),
        start: harvestDate,
        meta: {
          planting_id: p.id,
          crop,
          variety,
          status: p.status ?? undefined,
          source,
        },
      })
    }
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


