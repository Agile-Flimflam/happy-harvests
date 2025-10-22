"use server";

import { createSupabaseServerClient } from '@/lib/supabase-server'
// Validation is kept simple here to avoid UX friction; we only require crop & variety names
import { revalidatePath } from 'next/cache'

export async function getSeeds(): Promise<{ seeds?: any[]; error?: string }> {
  const supabase = await createSupabaseServerClient()
  // Self-heal: ensure seeds without a variety create one so they appear elsewhere
  try {
    const { data: loose } = await supabase.from('seeds').select('id, crop_name, variety_name, crop_variety_id').is('crop_variety_id', null)
    for (const s of (loose || [])) {
      const cropName = String(s.crop_name || '').trim()
      const varietyName = String((s.variety_name || s.crop_name || '')).trim()
      if (!cropName) continue
      let cropId: number | null = null
      const { data: crop } = await supabase.from('crops').select('id').ilike('name', cropName).maybeSingle()
      if (crop?.id) {
        cropId = crop.id as number
      } else {
        const { data: inserted } = await supabase.from('crops').insert({ name: cropName, crop_type: 'Vegetable' as any }).select('id').single()
        if (inserted?.id) cropId = inserted.id as number
      }
      if (cropId != null && varietyName) {
        const { data: v } = await supabase.from('crop_varieties').select('id').eq('name', varietyName).eq('crop_id', cropId).maybeSingle()
        let vId = v?.id as number | undefined
        if (!vId) {
          const { data: inserted } = await supabase.from('crop_varieties').insert({
            name: varietyName, crop_id: cropId, latin_name: '', dtm_direct_seed_min: 0, dtm_direct_seed_max: 0, dtm_transplant_min: 0, dtm_transplant_max: 0, is_organic: false,
          }).select('id').single()
          vId = inserted?.id as number | undefined
        }
        if (vId) {
          await supabase.from('seeds').update({ crop_variety_id: vId }).eq('id', s.id)
        }
      }
    }
  } catch {}

  const { data, error } = await supabase
    .from('seeds')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return { seeds: (data as any[]) || [] }
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
        const { data: inserted } = await supabase.from('crops').insert({ name: cropName, crop_type: 'Vegetable' as any }).select('id').single()
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
  return { varieties: (data as any[]) || [] }
}

export type SeedFormState = { message: string; errors?: Record<string, string[] | undefined> }

export async function upsertSeed(prev: SeedFormState, formData: FormData): Promise<SeedFormState> {
  const supabase = await createSupabaseServerClient()
  const idRaw = formData.get('id')
  const cropVarietyIdRaw = formData.get('crop_variety_id')
  const cropName = String(formData.get('crop_name') || '').trim()
  const varietyName = String(formData.get('variety_name') || '').trim()
  if (!cropName) {
    return { message: 'Validation failed', errors: { crop_name: ['Crop is required'] } }
  }
  const toISODate = (v: string | null): string | null => {
    if (!v) return null
    const s = v.trim()
    if (s === '') return null
    // Normalize MM/DD/YYYY → YYYY-MM-DD
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (m) {
      const [_, mm, dd, yyyy] = m
      const m2 = mm.padStart(2, '0')
      const d2 = dd.padStart(2, '0')
      return `${yyyy}-${m2}-${d2}`
    }
    return s
  }

  const payload: any = {
    id: typeof idRaw === 'string' && idRaw ? Number(idRaw) : undefined,
    crop_variety_id: typeof cropVarietyIdRaw === 'string' && cropVarietyIdRaw ? Number(cropVarietyIdRaw) : undefined,
    crop_name: cropName,
    variety_name: varietyName,
    vendor: (formData.get('vendor') as string) || null,
    lot_number: (formData.get('lot_number') as string) || null,
    date_received: toISODate((formData.get('date_received') as string) || null),
    quantity: (() => { const v = formData.get('quantity'); const s = v == null ? '' : String(v).trim(); return s === '' ? null : Number(s) })(),
    quantity_units: (formData.get('quantity_units') as string) || null,
    notes: (formData.get('notes') as string) || null,
  }

  // If crop_variety_id not provided, ensure crop + variety exist (create if missing) and fill ids/names
  if (!payload.crop_variety_id || String(payload.crop_variety_id).trim() === '') {
    // Find or create crop
    const cropName = String(payload.crop_name).trim()
    // If user didn't provide a variety, use crop name as variety for availability in plantings
    const varietyName = String(payload.variety_name || payload.crop_name || '').trim()
    let cropId: number | null = null
    {
      const { data: crop } = await supabase.from('crops').select('id').eq('name', cropName).maybeSingle()
      if (crop?.id) {
        cropId = crop.id as number
      } else {
        const { data: inserted, error: ciErr } = await supabase.from('crops').insert({ name: cropName, crop_type: 'Vegetable' as any }).select('id').single()
        if (ciErr) {
          return { message: `Database Error: ${ciErr.message}` }
        }
        if (inserted?.id) cropId = inserted.id as number
      }
    }
    // Find or create crop variety
    if (cropId != null && varietyName) {
      const { data: variety } = await supabase
        .from('crop_varieties')
        .select('id')
        .eq('crop_id', cropId)
        .ilike('name', varietyName)
        .maybeSingle()
      if (variety?.id) {
        payload.crop_variety_id = variety.id
      } else {
        // Minimal defaults for required fields
        const { data: inserted, error: vErr } = await supabase.from('crop_varieties').insert({
          name: varietyName,
          crop_id: cropId,
          latin_name: '',
          dtm_direct_seed_min: 0,
          dtm_direct_seed_max: 0,
          dtm_transplant_min: 0,
          dtm_transplant_max: 0,
          is_organic: false,
        }).select('id').single()
        if (vErr) {
          return { message: `Database Error: ${vErr.message}` }
        }
        if (inserted?.id) payload.crop_variety_id = inserted.id
      }
    }
  }

  const { error } = await supabase.from('seeds').upsert(payload as any)
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


