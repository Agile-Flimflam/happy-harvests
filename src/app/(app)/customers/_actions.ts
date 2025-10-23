"use server";

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { revalidatePath } from 'next/cache'
import { CustomerSchema, type CustomerFormValues } from '@/lib/validation/customers'
import type { Tables, TablesInsert } from '@/lib/database.types'

export async function listCustomers(): Promise<{ customers?: Tables<'customers'>[]; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return { customers: (data ?? []) as Tables<'customers'>[] }
}

export type CustomerFormState = { message: string; errors?: Record<string, string[] | undefined> }

export async function upsertCustomer(prev: CustomerFormState, formData: FormData): Promise<CustomerFormState> {
  const supabase = await createSupabaseServerClient()
  const parsed = CustomerSchema.safeParse({
    id: (() => { const v = formData.get('id'); return v == null || String(v).trim() === '' ? undefined : String(v); })(),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    fax: formData.get('fax'),
    website: formData.get('website'),
    billing_street: formData.get('billing_street'),
    billing_city: formData.get('billing_city'),
    billing_state: formData.get('billing_state'),
    billing_zip: formData.get('billing_zip'),
    shipping_street: formData.get('shipping_street'),
    shipping_city: formData.get('shipping_city'),
    shipping_state: formData.get('shipping_state'),
    shipping_zip: formData.get('shipping_zip'),
    notes: formData.get('notes'),
  })
  if (!parsed.success) {
    return { message: 'Validation failed', errors: parsed.error.flatten().fieldErrors }
  }
  const payload: CustomerFormValues = parsed.data
  const { error } = await supabase.from('customers').upsert(payload as TablesInsert<'customers'>)
  if (error) return { message: `Database Error: ${error.message}` }
  revalidatePath('/customers')
  return { message: 'Saved' }
}

export async function deleteCustomer(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const id = String(formData.get('id') || '')
  if (!id) return
  await supabase.from('customers').delete().eq('id', id)
  revalidatePath('/customers')
}


