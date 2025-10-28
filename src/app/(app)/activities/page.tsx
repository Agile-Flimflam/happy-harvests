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
import { ActivitiesFilters } from '@/components/activities/ActivitiesFilters'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Download } from 'lucide-react'
import { isActivityType, prettyActivityType, type ActivityType } from '@/lib/activities/types'
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
  const types: ActivityType[] = Object.keys(grouped || {}).filter(isActivityType)
  const allRows = Object.values(grouped || {}).flat().sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))
  const typeToCount = Object.fromEntries(types.map((t) => [t, (grouped?.[t] || []).length])) as Record<ActivityType, number>
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
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Activities</h1>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" asChild>
                <Link href={exportHref} aria-label="Export to CSV">
                  <Download className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export to CSV</TooltipContent>
          </Tooltip>
          <Button asChild size="sm">
            <Link href="/activities/new">Track an Activity</Link>
          </Button>
        </div>
      </div>
      <ActivitiesFilters
        locations={(locations || []) as { id: string; name: string | null }[]}
        initial={{
          type: type || '',
          location_id: sp?.location_id ?? '',
          from: sp?.from ?? '',
          to: sp?.to ?? '',
        }}
      />
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
                <TabsTrigger key={t} value={t}>{prettyActivityType(t)} <Badge className="ml-2" variant="secondary">{typeToCount[t] || 0}</Badge></TabsTrigger>
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
                              <Badge variant="secondary" className="capitalize">{String(a.activity_type).replace('_',' ')}</Badge>
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
                    <CardTitle className="text-base capitalize">{prettyActivityType(t)}</CardTitle>
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
