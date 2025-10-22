import Link from 'next/link'
import { getActivitiesGrouped } from './_actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WeatherBadge } from '@/components/weather/WeatherBadge'
import { createSupabaseServerClient } from '@/lib/supabase-server'
//

function parseWeather(a: any) {
  const w = a?.weather
  const icon = w?.current?.weather?.icon ?? null
  const tempF = typeof w?.current?.temp === 'number' ? w.current.temp : null
  const description = w?.current?.weather?.description ?? null
  return { icon, tempF, description }
}

export default async function ActivitiesPage({ searchParams }: { searchParams?: { type?: string; from?: string; to?: string; location_id?: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: locations } = await supabase.from('locations').select('id,name').order('name', { ascending: true })
  const { grouped, error } = await getActivitiesGrouped({ type: searchParams?.type as any, from: searchParams?.from, to: searchParams?.to, location_id: searchParams?.location_id })
  if (error) {
    return <div className="text-red-500">{error}</div>
  }
  const types = Object.keys(grouped || {}).sort()
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Activities</h1>
        <Button asChild>
          <Link href="/activities/new">Track an Activity</Link>
        </Button>
      </div>
      <form className="mb-6 grid gap-4 md:grid-cols-5">
        <div className="space-y-1">
          <label className="text-sm font-medium">Type</label>
          <select name="type" defaultValue={searchParams?.type ?? ''} className="border rounded px-2 py-1 w-full">
            <option value="">All</option>
            <option value="irrigation">Irrigation</option>
            <option value="soil_amendment">Soil Amendment</option>
            <option value="pest_management">Pest Management</option>
            <option value="asset_maintenance">Asset Maintenance</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Location</label>
          <select name="location_id" defaultValue={searchParams?.location_id ?? ''} className="border rounded px-2 py-1 w-full">
            <option value="">All</option>
            {(locations || []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">From</label>
          <input type="date" name="from" defaultValue={searchParams?.from ?? ''} className="border rounded px-2 py-1 w-full" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">To</label>
          <input type="date" name="to" defaultValue={searchParams?.to ?? ''} className="border rounded px-2 py-1 w-full" />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit">Apply</Button>
          <Button variant="outline" asChild>
            <Link href="/activities">Reset</Link>
          </Button>
        </div>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        {types.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No activities yet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Click "Track an Activity" to get started.</p>
            </CardContent>
          </Card>
        ) : (
          types.map((t) => (
            <Card key={t}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="capitalize">{t.replace('_', ' ')}</CardTitle>
                <Button asChild size="sm" variant="outline">
                  <Link href={{ pathname: '/api/activities/export', query: { type: searchParams?.type, from: searchParams?.from, to: searchParams?.to, location_id: searchParams?.location_id } as any }}>Export CSV</Link>
                </Button>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {(grouped?.[t] || []).map((a) => (
                    <li key={a.id} className="text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{a.started_at?.slice(0,16).replace('T',' ')}</div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <WeatherBadge {...parseWeather(a)} size="sm" inlineDescription />
                          {a.locations?.name ? `Location: ${a.locations.name}` : ''}
                          {a.crop ? ` • Crop: ${a.crop}` : ''}
                          {a.asset_name ? ` • Asset: ${a.asset_name}` : ''}
                          {a.labor_hours ? ` • Hours: ${a.labor_hours}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        {a.notes ? (
                          <div className="text-xs text-muted-foreground">{a.notes}</div>
                        ) : <span />}
                        <div className="flex items-center gap-2">
                          <Button asChild size="sm" variant="outline"><Link href={`/activities/${a.id}/edit`}>Edit</Link></Button>
                          <form action={async (fd) => { 'use server'; const { deleteActivity } = await import('./_actions'); await deleteActivity(fd) }}>
                            <input type="hidden" name="id" value={a.id} />
                            <Button type="submit" size="sm" variant="destructive">Delete</Button>
                          </form>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}


