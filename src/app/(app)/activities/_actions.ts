'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { ActivitySchema } from '@/lib/validation/activities'
import { fetchWeatherByCoords } from '@/lib/openweather.server'
import type { Json, Tables } from '@/lib/database.types'

export type ActivityFormState = {
  message: string
  errors?: Record<string, string[] | undefined>
}

type ErrorLike = {
  message?: string
  details?: string
  hint?: string
  code?: string
  status?: string
  error_description?: string
  error?: string
} & Record<string, unknown>

function errorToMessage(err: unknown): string {
  try {
    const e = err as ErrorLike
    const parts = [e?.message, e?.details, e?.hint, e?.code, e?.status, e?.error_description, e?.error]
      .filter((v) => typeof v === 'string' && v.trim().length > 0)
    if (parts.length > 0) return parts.join(' | ')
    try {
      return JSON.stringify(e)
    } catch {
      return JSON.stringify(e, Object.getOwnPropertyNames(e))
    }
  } catch {
    return 'Unknown error'
  }
}

export async function createActivity(prev: ActivityFormState, formData: FormData): Promise<ActivityFormState> {
  const supabase = await createSupabaseServerClient()
  const started_at = String(formData.get('started_at') || '')
  const validated = ActivitySchema.safeParse({
    activity_type: formData.get('activity_type'),
    started_at,
    ended_at: String(formData.get('ended_at') || '') || null,
    duration_minutes: formData.get('duration_minutes') || null,
    labor_hours: formData.get('labor_hours') || null,
    location_id: String(formData.get('location_id') || '') || null,
    plot_id: formData.get('plot_id') || null,
    bed_id: formData.get('bed_id') || null,
    nursery_id: formData.get('nursery_id') || null,
    crop: String(formData.get('crop') || '') || null,
    asset_id: String(formData.get('asset_id') || '') || null,
    asset_name: String(formData.get('asset_name') || '') || null,
    quantity: formData.get('quantity') || null,
    unit: String(formData.get('unit') || '') || null,
    cost: formData.get('cost') || null,
    notes: String(formData.get('notes') || '') || null,
    amendments: (() => {
      try {
        const raw = String(formData.get('amendments_json') || '')
        if (!raw) return null
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : null
      } catch { return null }
    })(),
  })
  if (!validated.success) {
    return { message: 'Validation failed', errors: validated.error.flatten().fieldErrors }
  }

  // Fetch weather if location has coordinates
  let weather: Json | null = null
  const locId = validated.data.location_id
  if (locId) {
    const { data: loc, error: locErr } = await supabase.from('locations').select('latitude, longitude').eq('id', locId).single()
    if (!locErr && loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
      try {
        const w = await fetchWeatherByCoords(loc.latitude, loc.longitude, { units: 'imperial' })
        weather = w as unknown as Json
      } catch (e) {
        console.error('Weather fetch failed:', e)
      }
    }
  }

  const { data: inserted, error } = await supabase.from('activities').insert({
    activity_type: validated.data.activity_type,
    started_at: validated.data.started_at,
    ended_at: validated.data.ended_at,
    duration_minutes: validated.data.duration_minutes,
    labor_hours: validated.data.labor_hours,
    location_id: validated.data.location_id,
    plot_id: validated.data.plot_id,
    bed_id: validated.data.bed_id,
    nursery_id: validated.data.nursery_id,
    crop: validated.data.crop,
    asset_id: validated.data.asset_id,
    asset_name: validated.data.asset_name,
    quantity: validated.data.quantity,
    unit: validated.data.unit,
    cost: validated.data.cost,
    notes: validated.data.notes,
    weather,
  }).select('id').single()
  if (error) {
    console.error('Activities insert error:', error)
    return { message: `Database Error: ${errorToMessage(error)}` }
  }

  // Insert soil amendments if provided and type matches
  if (validated.data.activity_type === 'soil_amendment' && Array.isArray(validated.data.amendments) && inserted?.id) {
    const rows = validated.data.amendments
      .filter((a) => a && typeof a.name === 'string' && a.name.trim().length > 0)
      .map((a) => ({ activity_id: inserted.id as number, name: a.name, quantity: a.quantity ?? null, unit: a.unit ?? null, notes: a.notes ?? null }))
    if (rows.length) {
      const { error: aerr } = await supabase.from('activities_soil_amendments').insert(rows)
      if (aerr) console.error('Insert amendments error:', aerr)
    }
  }

  revalidatePath('/activities')
  return { message: 'Activity created successfully', errors: {} }
}

export async function updateActivity(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id)) return
  const started_at = String(formData.get('started_at') || '')
  const validated = ActivitySchema.safeParse({
    activity_type: formData.get('activity_type'),
    started_at,
    ended_at: String(formData.get('ended_at') || '') || null,
    duration_minutes: formData.get('duration_minutes') || null,
    labor_hours: formData.get('labor_hours') || null,
    location_id: String(formData.get('location_id') || '') || null,
    plot_id: formData.get('plot_id') || null,
    bed_id: formData.get('bed_id') || null,
    nursery_id: formData.get('nursery_id') || null,
    crop: String(formData.get('crop') || '') || null,
    asset_id: String(formData.get('asset_id') || '') || null,
    asset_name: String(formData.get('asset_name') || '') || null,
    quantity: formData.get('quantity') || null,
    unit: String(formData.get('unit') || '') || null,
    cost: formData.get('cost') || null,
    notes: String(formData.get('notes') || '') || null,
  })
  if (!validated.success) return

  // Weather recompute if location changed
  let weather: Json | null = null
  const locId = validated.data.location_id
  if (locId) {
    const { data: loc, error: locErr } = await supabase.from('locations').select('latitude, longitude').eq('id', locId).single()
    if (!locErr && loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
      try {
        const w = await fetchWeatherByCoords(loc.latitude, loc.longitude, { units: 'imperial' })
        weather = w as unknown as Json
      } catch (e) {
        console.error('Weather fetch failed:', e)
      }
    }
  }

  const { error } = await supabase.from('activities').update({
    activity_type: validated.data.activity_type,
    started_at: validated.data.started_at,
    ended_at: validated.data.ended_at,
    duration_minutes: validated.data.duration_minutes,
    labor_hours: validated.data.labor_hours,
    location_id: validated.data.location_id,
    plot_id: validated.data.plot_id,
    bed_id: validated.data.bed_id,
    nursery_id: validated.data.nursery_id,
    crop: validated.data.crop,
    asset_id: validated.data.asset_id,
    asset_name: validated.data.asset_name,
    quantity: validated.data.quantity,
    unit: validated.data.unit,
    cost: validated.data.cost,
    notes: validated.data.notes,
    weather,
  }).eq('id', id)
  if (error) return
  revalidatePath('/activities')
}

export async function deleteActivity(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id)) return
  await supabase.from('activities').delete().eq('id', id)
  revalidatePath('/activities')
}

export async function getActivitiesGrouped(filters?: { type?: 'irrigation' | 'soil_amendment' | 'pest_management' | 'asset_maintenance'; from?: string; to?: string; location_id?: string }) {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('activities')
    .select('*, locations(name)')
    .order('started_at', { ascending: false })
  if (filters?.type) {
    query = query.eq('activity_type', filters.type)
  }
  if (filters?.from) {
    query = query.gte('started_at', filters.from)
  }
  if (filters?.to) {
    query = query.lte('started_at', filters.to)
  }
  if (filters?.location_id) {
    query = query.eq('location_id', filters.location_id)
  }
  const { data, error } = await query
  if (error) return { error: `Database Error: ${error.message}` }
  const grouped: Record<string, Tables<'activities'>[]> = {}
  for (const row of data || []) {
    const k = row.activity_type as string
    grouped[k] ||= []
    grouped[k].push(row)
  }
  return { grouped }
}

export async function getActivitiesFlat(params?: { type?: 'irrigation' | 'soil_amendment' | 'pest_management' | 'asset_maintenance'; from?: string; to?: string; location_id?: string; sort?: 'started_at' | 'labor_hours' | 'cost'; dir?: 'asc' | 'desc' }) {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from('activities')
    .select('*, locations(name)')
  if (params?.type) query = query.eq('activity_type', params.type)
  if (params?.from) query = query.gte('started_at', params.from)
  if (params?.to) query = query.lte('started_at', params.to)
  if (params?.location_id) query = query.eq('location_id', params.location_id)
  const sort = params?.sort ?? 'started_at'
  const dir = params?.dir ?? 'desc'
  query = query.order(sort, { ascending: dir === 'asc' })
  const { data, error } = await query
  if (error) return { error: `Database Error: ${error.message}` }
  return { rows: data || [] }
}

export async function deleteActivitiesBulk(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const csv = String(formData.get('ids') || '')
  const ids = csv.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
  if (!ids.length) return
  await supabase.from('activities').delete().in('id', ids as number[])
  revalidatePath('/activities')
}

export async function renameBed(formData: FormData): Promise<{ message: string }> {
  const supabase = await createSupabaseServerClient()
  const id = Number(formData.get('bed_id'))
  const name = String(formData.get('name') || '').trim()
  if (!Number.isFinite(id) || !name) return { message: 'Missing bed id or name' }
  const { error } = await supabase.from('beds').update({ name }).eq('id', id)
  if (error) return { message: `Database Error: ${errorToMessage(error)}` }
  return { message: 'Bed renamed' }
}


