import { DeliveriesPageContent } from './_components/DeliveriesPageContent'
import { listDeliveries } from './_actions'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Tables } from '@/lib/database.types'

type Customer = { id: string; name: string }
type Variety = { id: number; name: string; crops?: { name: string } | null }
type DeliveryWithCustomer = Tables<'deliveries'> & { customers?: { name?: string | null } | null }

export default async function DeliveriesPage() {
  const [{ deliveries = [] as DeliveryWithCustomer[] }, customers, varieties] = await Promise.all([
    listDeliveries(),
    (async () => {
      const supabase = await createSupabaseServerClient()
      const { data } = await supabase.from('customers').select('id, name').order('name', { ascending: true })
      return (data ?? []) as Customer[]
    })(),
    (async () => {
      const supabase = await createSupabaseServerClient()
      const { data } = await supabase.from('crop_varieties').select('id, name, crops(name)').order('name', { ascending: true })
      return (data ?? []) as Variety[]
    })(),
  ])
  return <DeliveriesPageContent deliveries={deliveries} customers={customers} varieties={varieties} />
}


