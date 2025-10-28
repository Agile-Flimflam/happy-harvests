import { createSupabaseServerClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateActivity } from '../../_actions'
import { EditActivityContent } from '@/components/activities/EditActivityContent'
import { notFound } from 'next/navigation'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { id: idParam } = await params
  const id = Number(idParam)
  const { data: activity } = await supabase.from('activities').select('*').eq('id', id).single()
  if (!activity) return notFound()
  const { data: locations } = await supabase.from('locations').select('*').order('name', { ascending: true })
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Edit Activity</h1>
      <Card>
        <CardHeader>
          <CardTitle>Activity #{id}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateActivity}>
            <input type="hidden" name="id" value={id} />
            <EditActivityContent activity={activity} locations={locations || []} />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}