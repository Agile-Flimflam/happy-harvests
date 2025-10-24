"use server";

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { DeliverySchema, type DeliveryFormValues } from '@/lib/validation/deliveries'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import { isWeightUnit, isCountUnit, toGrams } from '@/lib/units'

type DeliveryWithCustomer = Tables<'deliveries'> & { customers?: { name?: string | null } | null }

export async function listDeliveries(): Promise<{ deliveries?: DeliveryWithCustomer[]; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, customers(name)')
    .order('delivery_date', { ascending: false })
  if (error) return { error: error.message }
  return { deliveries: (data as DeliveryWithCustomer[]) || [] }
}

export type DeliveryFormState = { message: string; errors?: Record<string, string[] | undefined> }

export async function createDelivery(prev: DeliveryFormState, formData: FormData): Promise<DeliveryFormState> {
  const supabase = await createSupabaseServerClient()

  const itemsRaw = formData.get('items_json') as string
  let items: DeliveryFormValues['items'] = []
  try { items = JSON.parse(itemsRaw || '[]') } catch { items = [] }

  const parsed = DeliverySchema.safeParse({
    customer_id: formData.get('customer_id'),
    delivery_date: formData.get('delivery_date'),
    status: formData.get('status'),
    payment_terms: formData.get('payment_terms'),
    payment_status: formData.get('payment_status'),
    notes: formData.get('notes'),
    items,
  })
  if (!parsed.success) return { message: 'Validation failed', errors: parsed.error.flatten().fieldErrors }

  const payload: DeliveryFormValues = parsed.data
  // Inventory enforcement: ensure requested items do not exceed available inventory (by crop_variety_id)
  if (payload.items.length) {
    const varietyIds = payload.items.map((i) => i.crop_variety_id).filter((v): v is number => typeof v === 'number')
    if (varietyIds.length) {
      // Map variety id -> human-readable label (e.g., "Crop — Variety")
      const varietyIdToLabel = new Map<number, string>()
      {
        type VarietyRow = { id: number; name: string | null; crops?: { name?: string | null } | null }
        const { data: vrows } = await supabase
          .from('crop_varieties')
          .select('id, name, crops(name)')
          .in('id', varietyIds)
        for (const v of (vrows as unknown as VarietyRow[]) || []) {
          const cropName = v?.crops?.name ?? null
          const varietyName = v?.name ?? null
          const label = cropName ? `${cropName} — ${varietyName ?? ''}`.trim() : (varietyName ?? null)
          if (typeof v.id === 'number') varietyIdToLabel.set(v.id, label && label.length ? label : `Variety #${v.id}`)
        }
      }

      // Build map of planting_id -> crop_variety_id
      const { data: plantings, error: pErr } = await supabase
        .from('plantings')
        .select('id,crop_variety_id')
        .in('crop_variety_id', varietyIds)
      if (pErr) return { message: `Database Error: ${pErr.message}` }
      const plantingIdToVariety = new Map<number, number>()
      for (const p of (plantings || [])) {
        if (typeof p.id === 'number' && typeof p.crop_variety_id === 'number') {
          plantingIdToVariety.set(p.id, p.crop_variety_id)
        }
      }
      const plantingIds = Array.from(plantingIdToVariety.keys())

      // Sum harvested per variety (counts)
      const harvestedByVariety = new Map<number, number>()
      // Also keep rows for later grams computation to avoid a second query
      let peRows: Array<{ planting_id: number | null; qty: number | null; weight_grams: number | null }> = []
      if (plantingIds.length) {
        const { data: peRowsData, error: peErr } = await supabase
          .from('planting_events')
          .select('planting_id, qty, weight_grams')
          .eq('event_type', 'harvested')
          .in('planting_id', plantingIds)
        if (peErr) return { message: `Database Error: ${peErr.message}` }
        peRows = (peRowsData || []) as Array<{ planting_id: number | null; qty: number | null; weight_grams: number | null }>
        for (const e of peRows) {
          const vId = e.planting_id != null ? plantingIdToVariety.get(e.planting_id) : undefined
          if (typeof vId === 'number') {
            const q = typeof e.qty === 'number' ? e.qty : 0
            harvestedByVariety.set(vId, (harvestedByVariety.get(vId) || 0) + q)
          }
        }
      }

      // Fetch delivery items once (used for both count- and weight-based validations)
      type DeliveryItemRow = { crop_variety_id: number | null; qty: number | null; unit: string | null }
      const { data: diRows, error: diErr } = await supabase
        .from('delivery_items')
        .select('crop_variety_id, qty, unit')
        .in('crop_variety_id', varietyIds)
      if (diErr) return { message: `Database Error: ${diErr.message}` }
      const deliveryItemsRows: DeliveryItemRow[] = (diRows as unknown as DeliveryItemRow[]) || []

      // Sum delivered per variety (counts only include 'count' or missing unit)
      const deliveredByVariety = new Map<number, number>()
      for (const r of deliveryItemsRows) {
        if (typeof r.crop_variety_id === 'number') {
          if (isCountUnit(r.unit)) {
            const q = typeof r.qty === 'number' ? r.qty : 0
            deliveredByVariety.set(r.crop_variety_id, (deliveredByVariety.get(r.crop_variety_id) || 0) + q)
          }
        }
      }

      const availableByVariety = new Map<number, number>()
      for (const vId of varietyIds) {
        const harvested = harvestedByVariety.get(vId) || 0
        const delivered = deliveredByVariety.get(vId) || 0
        availableByVariety.set(vId, harvested - delivered)
      }
      const requestedCountByVariety = new Map<number, number>()
      const requestedGramsByVariety = new Map<number, number>()
      for (const it of payload.items) {
        if (typeof it.crop_variety_id === 'number' && typeof it.qty === 'number') {
          if (isWeightUnit(it.unit)) {
            requestedGramsByVariety.set(it.crop_variety_id, (requestedGramsByVariety.get(it.crop_variety_id) || 0) + toGrams(it.qty, it.unit ?? null))
          } else {
            requestedCountByVariety.set(it.crop_variety_id, (requestedCountByVariety.get(it.crop_variety_id) || 0) + it.qty)
          }
        }
      }
      // Compare requested vs available; here availableByVariety reflects count. For grams, compute delivered/harvested grams similarly if needed.
      for (const [vid, reqCount] of requestedCountByVariety) {
        const availCount = availableByVariety.get(vid) || 0
        if (reqCount > availCount) {
          return { message: `Validation failed`, errors: { items: [
            `Requested count (${reqCount}) exceeds available count (${availCount}) for ${varietyIdToLabel.get(vid) ?? `Variety #${vid}`}`
          ] } }
        }
      }
      // For weight-based lines, approximate by using grams harvested via planting_events.weight_grams and grams delivered by converting units in delivery_items
      const harvestedGramsByVariety = new Map<number, number>()
      const deliveredGramsByVariety = new Map<number, number>()
      // reuse peRows captured above to compute harvested grams; only query delivery_items (with units) once here
      for (const e of peRows) {
        const vId = e.planting_id != null ? plantingIdToVariety.get(e.planting_id) : undefined
        if (typeof vId === 'number') harvestedGramsByVariety.set(vId, (harvestedGramsByVariety.get(vId) || 0) + (typeof e.weight_grams === 'number' ? e.weight_grams : 0))
      }
      {
        for (const r of deliveryItemsRows) {
          if (typeof r.crop_variety_id === 'number' && typeof r.qty === 'number') {
            deliveredGramsByVariety.set(r.crop_variety_id, (deliveredGramsByVariety.get(r.crop_variety_id) || 0) + toGrams(r.qty, r.unit))
          }
        }
      }
      for (const [vid, reqGrams] of requestedGramsByVariety) {
        const availGrams = (harvestedGramsByVariety.get(vid) || 0) - (deliveredGramsByVariety.get(vid) || 0)
        if (reqGrams > availGrams) {
          return { message: `Validation failed`, errors: { items: [
            `Requested weight (${Math.round(reqGrams)}g) exceeds available weight (${Math.round(availGrams)}g) for ${varietyIdToLabel.get(vid) ?? `Variety #${vid}`}`
          ] } }
        }
      }
    }
  }
  const { data: inserted, error } = await supabase
    .from('deliveries')
    .insert({
      customer_id: payload.customer_id,
      delivery_date: payload.delivery_date,
      status: payload.status ?? null,
      payment_terms: payload.payment_terms ?? null,
      payment_status: payload.payment_status ?? null,
      notes: payload.notes ?? null,
    })
    .select('id')
    .single()
  if (error) return { message: `Database Error: ${error.message}` }
  const deliveryId = inserted?.id as string

  const lines = payload.items.map((it) => ({
    delivery_id: deliveryId,
    crop_variety_id: it.crop_variety_id ?? null,
    planting_id: it.planting_id ?? null,
    qty: it.qty,
    unit: it.unit,
    price_per: it.price_per ?? null,
    total_price: it.total_price ?? null,
    notes: it.notes ?? null,
  }))
  if (lines.length) {
    const { error: liErr } = await supabase.from('delivery_items').insert(lines as TablesInsert<'delivery_items'>[])
    if (liErr) return { message: `Database Error: ${liErr.message}` }
  }

  revalidatePath('/deliveries')
  return { message: 'Delivery created' }
}

export async function updateDelivery(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const id = String(formData.get('id') || '')
  if (!id) return
  const updates = {
    status: (formData.get('status') as string) || null,
    payment_terms: (formData.get('payment_terms') as string) || null,
    payment_status: (formData.get('payment_status') as string) || null,
    notes: (formData.get('notes') as string) || null,
  }
  const { error } = await supabase.from('deliveries').update(updates as TablesUpdate<'deliveries'>).eq('id', id)
  if (error) return
  revalidatePath('/deliveries')
}


