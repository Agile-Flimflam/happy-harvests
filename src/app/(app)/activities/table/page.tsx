import { getActivitiesFlat } from '../_actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ActivitiesTable } from '@/components/activities/ActivitiesTable'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { deleteActivitiesBulk } from '../_actions'

export default async function ActivitiesTablePage({ searchParams }: { searchParams?: Promise<{ type?: 'irrigation' | 'soil_amendment' | 'pest_management' | 'asset_maintenance'; from?: string; to?: string; location_id?: string; sort?: 'started_at' | 'labor_hours' | 'cost'; dir?: 'asc' | 'desc' }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: locations } = await supabase.from('locations').select('id,name').order('name', { ascending: true })
  const sp = searchParams ? await searchParams : undefined
  const { rows, error } = await getActivitiesFlat(sp)
  if (error) return <div className="text-red-500">{error}</div>
  const exportParams = new URLSearchParams()
  if (sp?.type) exportParams.set('type', sp.type)
  if (sp?.from) exportParams.set('from', sp.from)
  if (sp?.to) exportParams.set('to', sp.to)
  if (sp?.location_id) exportParams.set('location_id', sp.location_id)
  if (sp?.sort) exportParams.set('sort', sp.sort)
  if (sp?.dir) exportParams.set('dir', sp.dir)
  const exportHref = `/api/activities/export${exportParams.toString() ? `?${exportParams.toString()}` : ''}`
  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-3xl font-bold">Activities (Table)</h1>
          <Button asChild>
            <Link href={exportHref}>Export CSV</Link>
          </Button>
        </div>
        <form className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1">
            <label className="text-sm font-medium">Type</label>
            <select name="type" defaultValue={sp?.type ?? ''} className="border rounded px-2 py-1 w-full">
              <option value="">All</option>
              <option value="irrigation">Irrigation</option>
              <option value="soil_amendment">Soil Amendment</option>
              <option value="pest_management">Pest Management</option>
              <option value="asset_maintenance">Asset Maintenance</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">From</label>
            <input type="date" name="from" defaultValue={sp?.from ?? ''} className="border rounded px-2 py-1 w-full" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">To</label>
            <input type="date" name="to" defaultValue={sp?.to ?? ''} className="border rounded px-2 py-1 w-full" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Location</label>
            <select name="location_id" defaultValue={sp?.location_id ?? ''} className="border rounded px-2 py-1 w-full">
              <option value="">All</option>
              {(locations || []).map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Sort</label>
            <div className="flex gap-2">
              <select name="sort" defaultValue={sp?.sort ?? 'started_at'} className="border rounded px-2 py-1 w-full">
                <option value="started_at">Date</option>
                <option value="labor_hours">Hours</option>
                <option value="cost">Cost</option>
              </select>
              <select name="dir" defaultValue={sp?.dir ?? 'desc'} className="border rounded px-2 py-1 w-full">
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
              <Button type="submit" className="whitespace-nowrap">Apply</Button>
            </div>
          </div>
        </form>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Activities</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivitiesTable rows={rows || []} bulkDeleteAction={deleteActivitiesBulk} />
        </CardContent>
      </Card>
    </div>
  )
}


