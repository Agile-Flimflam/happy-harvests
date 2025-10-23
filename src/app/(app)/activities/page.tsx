import Link from 'next/link'
import { getActivitiesGrouped, getActivitiesFlat, deleteActivitiesBulk } from './_actions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { WeatherBadge } from '@/components/weather/WeatherBadge'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { Tables } from '@/lib/database.types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActivitiesTable } from '@/components/activities/ActivitiesTable'
import { Badge } from '@/components/ui/badge'
//


function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function parseWeather(a: { weather?: unknown } | null | undefined) {
  let icon: string | null = null
  let tempF: number | null = null
  let description: string | null = null
  const w = a && isRecord(a) ? a.weather : undefined
  const wrec = isRecord(w) ? (w as Record<string, unknown>) : undefined
  const current = wrec && isRecord(wrec.current) ? (wrec.current as Record<string, unknown>) : undefined
  const temp = current?.temp
  if (typeof temp === 'number') tempF = temp
  const weather = current && isRecord(current.weather) ? (current.weather as Record<string, unknown>) : undefined
  const iconMaybe = weather?.icon
  if (typeof iconMaybe === 'string') icon = iconMaybe
  const descMaybe = weather?.description
  if (typeof descMaybe === 'string') description = descMaybe
  return { icon, tempF, description }
}

type ActivityType = 'irrigation' | 'soil_amendment' | 'pest_management' | 'asset_maintenance'
function isActivityType(v: string | undefined): v is ActivityType {
  return v === 'irrigation' || v === 'soil_amendment' || v === 'pest_management' || v === 'asset_maintenance'
}

type ActivityRow = Tables<'activities'> & { locations?: { name?: string | null } | null }

export default async function ActivitiesPage({ searchParams }: { searchParams?: Promise<{ type?: string; from?: string; to?: string; location_id?: string }> }) {
  const supabase = await createSupabaseServerClient()
  const { data: locations } = await supabase.from('locations').select('id,name').order('name', { ascending: true })
  const sp = searchParams ? await searchParams : undefined
  const type = isActivityType(sp?.type) ? sp?.type : undefined
  const { grouped, error } = await getActivitiesGrouped({ type, from: sp?.from, to: sp?.to, location_id: sp?.location_id })
  if (error) {
    return <div className="text-red-500">{error}</div>
  }
  const types = Object.keys(grouped || {}).sort()
  const allRows = Object.values(grouped || {}).flat().sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))
  const typeToCount = Object.fromEntries(types.map((t) => [t, (grouped?.[t] || []).length])) as Record<string, number>
  const { rows: flatRows = [], error: flatErr } = await getActivitiesFlat({
    type,
    from: sp?.from,
    to: sp?.to,
    location_id: sp?.location_id,
  })
  const exportParams = new URLSearchParams()
  if (type) exportParams.set('type', type)
  if (sp?.from) exportParams.set('from', sp.from)
  if (sp?.to) exportParams.set('to', sp.to)
  if (sp?.location_id) exportParams.set('location_id', sp.location_id)
  const exportHref = `/api/activities/export${exportParams.toString() ? `?${exportParams.toString()}` : ''}`
  const pretty = (t: string) => t.replace('_',' ')
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Activities</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={exportHref}>Export CSV</Link>
          </Button>
          <Button asChild>
            <Link href="/activities/new">Track an Activity</Link>
          </Button>
        </div>
      </div>
      <form className="mb-6 grid gap-4 md:grid-cols-5">
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
          <label className="text-sm font-medium">Location</label>
          <select name="location_id" defaultValue={sp?.location_id ?? ''} className="border rounded px-2 py-1 w-full">
            <option value="">All</option>
            {(locations || []).map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
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
        <div className="flex items-end gap-2">
          <Button type="submit">Apply</Button>
          <Button variant="outline" asChild>
            <Link href="/activities">Reset</Link>
          </Button>
        </div>
      </form>
      <div>
        {types.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No activities yet</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Click &quot;Track an Activity&quot; to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All <Badge className="ml-2" variant="secondary">{allRows.length}</Badge></TabsTrigger>
              {types.map((t) => (
                <TabsTrigger key={t} value={t}>{pretty(t)} <Badge className="ml-2" variant="secondary">{typeToCount[t] || 0}</Badge></TabsTrigger>
              ))}
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <Card>
                <CardHeader>
                  <CardTitle>All Activities (Table)</CardTitle>
                </CardHeader>
                <CardContent>
                  {flatErr ? (
                    <div className="text-red-500 text-sm">{flatErr}</div>
                  ) : (
                    <ActivitiesTable rows={flatRows as ActivityRow[]} bulkDeleteAction={deleteActivitiesBulk} />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">All Activities</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {allRows.map((a: ActivityRow) => (
                      <li key={a.id} className="py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 text-xs rounded bg-muted capitalize">{String(a.activity_type).replace('_',' ')}</span>
                              <span className="font-medium">{a.started_at?.slice(0,16).replace('T',' ')}</span>
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <WeatherBadge {...parseWeather(a)} size="sm" inlineDescription />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {a.locations?.name ? <span>Location: {a.locations.name}</span> : null}
                              {a.crop ? <span>Crop: {a.crop}</span> : null}
                              {a.asset_name ? <span>Asset: {a.asset_name}</span> : null}
                              {a.labor_hours ? <span>Hours: {a.labor_hours}</span> : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button asChild size="sm" variant="outline"><Link href={`/activities/${a.id}/edit`}>Edit</Link></Button>
                              <form action={async (fd) => { 'use server'; const { deleteActivity } = await import('./_actions'); await deleteActivity(fd) }}>
                                <input type="hidden" name="id" value={a.id} />
                                <Button type="submit" size="sm" variant="destructive">Delete</Button>
                              </form>
                            </div>
                          </div>
                          {a.notes ? <div className="text-xs text-muted-foreground mt-1">{a.notes}</div> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {types.map((t) => (
              <TabsContent key={t} value={t}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base capitalize">{pretty(t)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y">
                      {(grouped?.[t] || []).map((a: ActivityRow) => (
                        <li key={a.id} className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{a.started_at?.slice(0,16).replace('T',' ')}</span>
                              {a.labor_hours ? <Badge variant="secondary">{a.labor_hours}h</Badge> : null}
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <WeatherBadge {...parseWeather(a)} size="sm" inlineDescription />
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {a.locations?.name ? <span>Location: {a.locations.name}</span> : null}
                              {a.crop ? <span>Crop: {a.crop}</span> : null}
                              {a.asset_name ? <span>Asset: {a.asset_name}</span> : null}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button asChild size="sm" variant="outline"><Link href={`/activities/${a.id}/edit`}>Edit</Link></Button>
                              <form action={async (fd) => { 'use server'; const { deleteActivity } = await import('./_actions'); await deleteActivity(fd) }}>
                                <input type="hidden" name="id" value={a.id} />
                                <Button type="submit" size="sm" variant="destructive">Delete</Button>
                              </form>
                            </div>
                          </div>
                          {a.notes ? <div className="text-xs text-muted-foreground mt-1">{a.notes}</div> : null}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  )
}


