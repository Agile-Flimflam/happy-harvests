"use server";

import { createSupabaseServerClient } from '@/lib/supabase-server'
// Policy: seeds are link-only. Names are inferred from crop_variety_id.
import { revalidatePath } from 'next/cache'
import type { Tables, TablesInsert, Enums } from '@/lib/database.types'

export async function getSeeds(): Promise<{ seeds?: Tables<'seeds'>[]; error?: string }> {
  const supabase = await createSupabaseServerClient()
  // Link-only self-heal: attempt to link seeds that have names but no crop_variety_id.
  try {
    const { data: loose } = await supabase.from('seeds').select('id, crop_name, variety_name, crop_variety_id').is('crop_variety_id', null)
    for (const s of (loose || [])) {
      const cropName = String(s.crop_name || '').trim()
      const varietyName = String(s.variety_name || '').trim()
      if (!cropName || !varietyName) continue
      const { data: crop } = await supabase.from('crops').select('id').ilike('name', cropName).maybeSingle()
      const cropId = crop?.id as number | undefined
      if (!cropId) continue
      const { data: v } = await supabase.from('crop_varieties').select('id').eq('crop_id', cropId).ilike('name', varietyName).maybeSingle()
      const vId = v?.id as number | undefined
      if (vId) await supabase.from('seeds').update({ crop_variety_id: vId }).eq('id', s.id)
    }
  } catch {}

  const { data, error } = await supabase
    .from('seeds')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return { seeds: (data ?? []) as Tables<'seeds'>[] }
}

export async function syncSeedsToVarieties(): Promise<{ ok: boolean; created: number; linked: number; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: seeds, error } = await supabase.from('seeds').select('id, crop_name, variety_name, crop_variety_id')
    if (error) return { ok: false, created: 0, linked: 0, error: error.message }
    let created = 0
    let linked = 0
    for (const s of seeds || []) {
      const cropName = String(s.crop_name || '').trim()
      const varietyName = String((s.variety_name || s.crop_name || '')).trim()
      if (!cropName) continue
      let cropId: number | null = null
      const { data: crop } = await supabase.from('crops').select('id').ilike('name', cropName).maybeSingle()
      if (crop?.id) cropId = crop.id as number
      else {
        const { data: inserted } = await supabase.from('crops').insert({ name: cropName, crop_type: 'Vegetable' as Enums<'crop_type'> }).select('id').single()
        if (inserted?.id) { cropId = inserted.id as number; created++ }
      }
      if (cropId != null) {
        const { data: v } = await supabase.from('crop_varieties').select('id').eq('crop_id', cropId).ilike('name', varietyName).maybeSingle()
        let vId = v?.id as number | undefined
        if (!vId) {
          const { data: inserted } = await supabase.from('crop_varieties').insert({
            name: varietyName || cropName,
            crop_id: cropId,
            latin_name: '',
            dtm_direct_seed_min: 0,
            dtm_direct_seed_max: 0,
            dtm_transplant_min: 0,
            dtm_transplant_max: 0,
            is_organic: false,
          }).select('id').single()
          if (inserted?.id) { vId = inserted.id as number; created++ }
        }
        if (vId && !s.crop_variety_id) {
          await supabase.from('seeds').update({ crop_variety_id: vId }).eq('id', s.id)
          linked++
        }
      }
    }
    revalidatePath('/seeds')
    revalidatePath('/plantings')
    revalidatePath('/crop-varieties')
    return { ok: true, created, linked }
  } catch (e) {
    return { ok: false, created: 0, linked: 0, error: e instanceof Error ? e.message : 'unknown error' }
  }
}

export async function getCropVarietiesForSelect(): Promise<{ varieties?: { id: number; name: string; latin_name: string; crops?: { name: string } | null }[]; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('crop_varieties')
    .select('id, name, latin_name, crops(name)')
    .order('name', { ascending: true })
  if (error) return { error: error.message }
  return { varieties: (data ?? []) as { id: number; name: string; latin_name: string; crops?: { name: string } | null }[] }
}

export type SeedFormState = { message: string; errors?: Record<string, string[] | undefined> }

export async function upsertSeed(prev: SeedFormState, formData: FormData): Promise<SeedFormState> {
  const supabase = await createSupabaseServerClient()
  const idRaw = formData.get('id')
  const cropVarietyIdRaw = formData.get('crop_variety_id')
  const cropVarietyId = typeof cropVarietyIdRaw === 'string' && cropVarietyIdRaw ? Number(cropVarietyIdRaw) : NaN
  if (!Number.isFinite(cropVarietyId)) {
    return { message: 'Validation failed', errors: { crop_variety_id: ['Crop variety is required'] } }
  }
  // variety_name is optional per schema and DB; allow empty here
  const toISODate = (v: string | null): string | null => {
    if (!v) return null
    const s = v.trim()
    if (s === '') return null
    // Normalize MM/DD/YYYY → YYYY-MM-DD
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) {
      const [, mm, dd, yyyy] = m
      const m2 = mm.padStart(2, '0')
      const d2 = dd.padStart(2, '0')
      return `${yyyy}-${m2}-${d2}`
    }
    return s
  }

  // Infer names from crop_variety_id (do not accept free-text names)
  const { data: varietyRow, error: vErr } = await supabase
    .from('crop_varieties')
    .select('name, crops(name)')
    .eq('id', cropVarietyId)
    .single()
  if (vErr) return { message: `Database Error: ${vErr.message}` }
  const inferredCropName = ((varietyRow as unknown as { crops?: { name?: string | null } | null })?.crops?.name ?? '')
  const inferredVarietyName = ((varietyRow as unknown as { name?: string | null })?.name ?? '')

  const payload = {
    id: typeof idRaw === 'string' && idRaw ? Number(idRaw) : undefined,
    crop_variety_id: cropVarietyId,
    crop_name: inferredCropName,
    variety_name: inferredVarietyName,
    vendor: (formData.get('vendor') as string) || null,
    lot_number: (formData.get('lot_number') as string) || null,
    date_received: toISODate((formData.get('date_received') as string) || null),
    quantity: (() => { const v = formData.get('quantity'); const s = v == null ? '' : String(v).trim(); return s === '' ? null : Number(s) })(),
    quantity_units: (formData.get('quantity_units') as string) || null,
    notes: (formData.get('notes') as string) || null,
  }

  // Do not create crops/varieties here; caller must provide crop_variety_id

  const { error } = await supabase.from('seeds').upsert(payload as unknown as TablesInsert<'seeds'>)
  if (error) return { message: `Database Error: ${error.message}` }
  revalidatePath('/seeds')
  // Make the new variety immediately available across the app
  revalidatePath('/plantings')
  revalidatePath('/crop-varieties')
  return { message: 'Saved' }
}

export async function deleteSeed(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const id = Number(formData.get('id'))
  if (!Number.isFinite(id)) return
  await supabase.from('seeds').delete().eq('id', id)
  revalidatePath('/seeds')
}


