import { createSupabaseServerClient } from '@/lib/supabase-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { updateActivity } from '../../_actions'

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { id: idParam } = await params
  const id = Number(idParam)
  const { data: activity } = await supabase.from('activities').select('*').eq('id', id).single()
  const { data: locations } = await supabase.from('locations').select('id,name').order('name', { ascending: true })
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
            {/* Reuse client form for fields, but it expects to control action; here we inline inputs with defaults */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select name="activity_type" defaultValue={activity?.activity_type} className="border rounded px-2 py-1 w-full" required>
                  <option value="irrigation">Irrigation</option>
                  <option value="soil_amendment">Soil Amendment</option>
                  <option value="pest_management">Pest Management</option>
                  <option value="asset_maintenance">Asset Maintenance</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Start</label>
                <input type="datetime-local" name="started_at" defaultValue={activity?.started_at?.slice(0,16)} className="border rounded px-2 py-1 w-full" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End</label>
                <input type="datetime-local" name="ended_at" defaultValue={activity?.ended_at?.slice(0,16) ?? ''} className="border rounded px-2 py-1 w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (minutes)</label>
                <input type="number" name="duration_minutes" defaultValue={activity?.duration_minutes ?? ''} min={0} className="border rounded px-2 py-1 w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Labor Hours</label>
                <input type="number" step="0.1" name="labor_hours" defaultValue={activity?.labor_hours ?? ''} min={0} className="border rounded px-2 py-1 w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <select name="location_id" defaultValue={activity?.location_id ?? ''} className="border rounded px-2 py-1 w-full">
                  <option value="">—</option>
                  {(locations || []).map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Crop</label>
                <input type="text" name="crop" defaultValue={activity?.crop ?? ''} className="border rounded px-2 py-1 w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Asset Name</label>
                <input type="text" name="asset_name" defaultValue={activity?.asset_name ?? ''} className="border rounded px-2 py-1 w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Asset ID</label>
                <input type="text" name="asset_id" defaultValue={activity?.asset_id ?? ''} className="border rounded px-2 py-1 w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Quantity</label>
                <input type="number" step="0.01" name="quantity" defaultValue={activity?.quantity ?? ''} min={0} className="border rounded px-2 py-1 w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Unit</label>
                <input type="text" name="unit" defaultValue={activity?.unit ?? ''} className="border rounded px-2 py-1 w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cost</label>
                <input type="number" step="0.01" name="cost" defaultValue={activity?.cost ?? ''} min={0} className="border rounded px-2 py-1 w-full" />
              </div>
              <div className="col-span-full space-y-2">
                <label className="text-sm font-medium">Notes</label>
                <textarea name="notes" defaultValue={activity?.notes ?? ''} className="border rounded px-2 py-1 w-full" />
              </div>
              <div className="col-span-full">
                <button type="submit" className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Save Changes</button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}





