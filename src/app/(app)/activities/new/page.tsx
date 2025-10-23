import { createActivity } from '../_actions'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActivityForm } from '@/components/activities/ActivityForm'

type LocationOption = { id: string; name: string }
type PlotOption = { plot_id: number; name: string; location_id: string }
type BedOption = { id: number; plot_id: number; name?: string | null }
type NurseryOption = { id: string; name: string; location_id: string }

export default async function NewActivityPage({ searchParams }: { searchParams?: Promise<{ start?: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: locations } = await supabase.from('locations').select('id,name').order('name', { ascending: true })
  const { data: plots } = await supabase.from('plots').select('plot_id,name,location_id').order('name', { ascending: true })
  const { data: beds } = await supabase.from('beds').select('id,plot_id,name').order('id', { ascending: true })
  const { data: nurseries } = await supabase.from('nurseries').select('id,name,location_id').order('name', { ascending: true })
  const sp = searchParams ? await searchParams : undefined
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Track an Activity</h1>
      <Card>
        <CardHeader>
          <CardTitle>New Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityForm action={createActivity} locations={(locations ?? []) as LocationOption[]} plots={(plots ?? []) as PlotOption[]} beds={(beds ?? []) as BedOption[]} nurseries={(nurseries ?? []) as NurseryOption[]} defaultStart={sp?.start} />
          <div className="mt-2 text-xs text-muted-foreground">Hawaiian moon phase for selected date is shown in weather tooltips wherever current weather is displayed.</div>
        </CardContent>
      </Card>
    </div>
  )
}


