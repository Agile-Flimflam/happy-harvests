"use server";

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { DeliverySchema, type DeliveryFormValues } from '@/lib/validation/deliveries'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'

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

      // Sum harvested per variety
      const harvestedByVariety = new Map<number, number>()
      if (plantingIds.length) {
        const { data: peRows, error: peErr } = await supabase
          .from('planting_events')
          .select('planting_id, qty, event_type')
          .eq('event_type', 'harvested')
          .in('planting_id', plantingIds)
        if (peErr) return { message: `Database Error: ${peErr.message}` }
        for (const e of (peRows || [])) {
          const vId = e.planting_id != null ? plantingIdToVariety.get(e.planting_id) : undefined
          if (typeof vId === 'number') {
            const q = typeof e.qty === 'number' ? e.qty : 0
            harvestedByVariety.set(vId, (harvestedByVariety.get(vId) || 0) + q)
          }
        }
      }

      // Sum delivered per variety
      const deliveredByVariety = new Map<number, number>()
      {
        const { data: diRows, error: diErr } = await supabase
          .from('delivery_items')
          .select('crop_variety_id, qty')
          .in('crop_variety_id', varietyIds)
        if (diErr) return { message: `Database Error: ${diErr.message}` }
        for (const r of (diRows || [])) {
          if (typeof r.crop_variety_id === 'number') {
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
      const toGrams = (qty: number, unit?: string | null) => {
        if (!unit) return qty
        const s = unit.toLowerCase()
        if (s === 'g' || s === 'gram' || s === 'grams') return qty
        if (s === 'kg' || s === 'kilogram' || s === 'kilograms') return qty * 1000
        if (s === 'lb' || s === 'lbs' || s === 'pound' || s === 'pounds') return qty * 453.59237
        if (s === 'oz' || s === 'ounce' || s === 'ounces') return qty * 28.349523125
        return qty
      }
      for (const it of payload.items) {
        if (typeof it.crop_variety_id === 'number' && typeof it.qty === 'number') {
          const unit = it.unit?.toLowerCase()
          if (unit && unit !== 'count') {
            requestedGramsByVariety.set(it.crop_variety_id, (requestedGramsByVariety.get(it.crop_variety_id) || 0) + toGrams(it.qty, unit))
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
            `Requested count (${reqCount}) exceeds available count (${availCount}) for variety ${vid}`
          ] } }
        }
      }
      // For weight-based lines, approximate by using grams harvested via planting_events.weight_grams and grams delivered by converting units in delivery_items
      const harvestedGramsByVariety = new Map<number, number>()
      const deliveredGramsByVariety = new Map<number, number>()
      // reuse peRows and diRows above if available; otherwise query
      {
        // Already have peRows/diRows; recompute grams
        // peRows scope not available here; requery minimal
        const { data: peRows2 } = await supabase
          .from('planting_events')
          .select('planting_id, weight_grams, event_type')
          .eq('event_type', 'harvested')
          .in('planting_id', plantingIds)
        for (const e of (peRows2 || [])) {
          const vId = e.planting_id != null ? plantingIdToVariety.get(e.planting_id) : undefined
          if (typeof vId === 'number') harvestedGramsByVariety.set(vId, (harvestedGramsByVariety.get(vId) || 0) + (typeof e.weight_grams === 'number' ? e.weight_grams : 0))
        }
        const { data: diRows2 } = await supabase
          .from('delivery_items')
          .select('crop_variety_id, qty, unit')
          .in('crop_variety_id', varietyIds)
        for (const r of (diRows2 || [])) {
          if (typeof r.crop_variety_id === 'number' && typeof r.qty === 'number') {
            deliveredGramsByVariety.set(r.crop_variety_id, (deliveredGramsByVariety.get(r.crop_variety_id) || 0) + toGrams(r.qty, r.unit))
          }
        }
      }
      for (const [vid, reqGrams] of requestedGramsByVariety) {
        const availGrams = (harvestedGramsByVariety.get(vid) || 0) - (deliveredGramsByVariety.get(vid) || 0)
        if (reqGrams > availGrams) {
          return { message: `Validation failed`, errors: { items: [
            `Requested weight (${Math.round(reqGrams)}g) exceeds available weight (${Math.round(availGrams)}g) for variety ${vid}`
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


