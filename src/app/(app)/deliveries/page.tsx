import { DeliveriesPageContent } from './_components/DeliveriesPageContent'
import { listDeliveries } from './_actions'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export default async function DeliveriesPage() {
  const [{ deliveries = [] }, customers, varieties] = await Promise.all([
    listDeliveries(),
    (async () => {
      const supabase = await createSupabaseServerClient()
      const { data } = await supabase.from('customers').select('id, name').order('name', { ascending: true })
      return (data as any[]) || []
    })(),
    (async () => {
      const supabase = await createSupabaseServerClient()
      const { data } = await supabase.from('crop_varieties').select('id, name, crops(name)').order('name', { ascending: true })
      return (data as any[]) || []
    })(),
  ])
  return <DeliveriesPageContent deliveries={deliveries as any[]} customers={customers as any[]} varieties={varieties as any[]} />
}


