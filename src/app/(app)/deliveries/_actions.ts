"use server";

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { DeliverySchema, type DeliveryFormValues } from '@/lib/validation/deliveries'

export async function listDeliveries(): Promise<{ deliveries?: any[]; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('deliveries')
    .select('*, customers(name)')
    .order('delivery_date', { ascending: false })
  if (error) return { error: error.message }
  return { deliveries: (data as any[]) || [] }
}

export type DeliveryFormState = { message: string; errors?: Record<string, string[] | undefined> }

export async function createDelivery(prev: DeliveryFormState, formData: FormData): Promise<DeliveryFormState> {
  const supabase = await createSupabaseServerClient()

  const itemsRaw = formData.get('items_json') as string
  let items: any[] = []
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
    const { error: liErr } = await supabase.from('delivery_items').insert(lines as any)
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
  const { error } = await supabase.from('deliveries').update(updates as any).eq('id', id)
  if (error) return
  revalidatePath('/deliveries')
}


