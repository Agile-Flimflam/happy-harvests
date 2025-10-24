'use client'

import * as React from 'react'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Droplet, Sprout, Wrench, Bug, FlaskConical } from 'lucide-react'
import { hawaiianMoonForDate, lunarPhaseFraction, hawaiianMoonRecommendationByName } from '@/lib/hawaiian-moon'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export type CalendarEvent = {
  id: string
  type: 'activity' | 'planting'
  title: string
  start: string
  end?: string | null
  meta?: Record<string, unknown>
}

type CalendarFilter = 'all' | 'activity' | 'planting'

function moonEmojiForDate(d: Date): string {
  const f = lunarPhaseFraction(d)
  if (f < 0.0625 || f >= 0.9375) return '🌑'
  if (f < 0.1875) return '🌒'
  if (f < 0.3125) return '🌓'
  if (f < 0.4375) return '🌔'
  if (f < 0.5625) return '🌕'
  if (f < 0.6875) return '🌖'
  if (f < 0.8125) return '🌗'
  return '🌘'
}

export default function CalendarClient({ events, locations = [] }: { events: CalendarEvent[]; locations?: Array<{ id: string; name: string; latitude: number | null; longitude: number | null }> }) {
  const today = new Date()
  const [current, setCurrent] = React.useState<{ y: number; m: number }>({ y: today.getFullYear(), m: today.getMonth() })
  const [filter, setFilter] = React.useState<CalendarFilter>('all')
  const [detail, setDetail] = React.useState<{ open: boolean; date: string | null }>({ open: false, date: null })

  function startOfMonth(y: number, m: number) { return new Date(y, m, 1) }

  const first = startOfMonth(current.y, current.m)
  const firstDay = new Date(first)
  firstDay.setDate(first.getDate() - first.getDay())

  const cells: Date[] = []
  for (let i = 0; i < 42; i++) { // 6 weeks
    const d = new Date(firstDay)
    d.setDate(firstDay.getDate() + i)
    cells.push(d)
  }

  const filtered = filter === 'all' ? events : events.filter((e) => e.type === filter)
  const byDay = new Map<string, CalendarEvent[]>()
  for (const e of filtered) {
    const day = e.start.slice(0,10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(e)
  }

  function fmt(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  }

  function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  }

  function activityTypeOf(e: CalendarEvent): string | undefined {
    const meta = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : undefined
    const t = meta?.activity_type
    return typeof t === 'string' ? t : undefined
  }

  function plantingStatusOf(e: CalendarEvent): string | undefined {
    const meta = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : undefined
    const s = meta?.status
    return typeof s === 'string' ? s : undefined
  }

  function eventColorClasses(e: CalendarEvent): string {
    if (e.type === 'activity') {
      switch (activityTypeOf(e)) {
        case 'irrigation':
          return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100'
        case 'soil_amendment':
          return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100'
        case 'pest_management':
          return 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-100'
        case 'asset_maintenance':
          return 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-100'
        default:
          return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-100'
      }
    }
    switch (plantingStatusOf(e)) {
      case 'nursery':
        return 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100'
      case 'planted':
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100'
      case 'harvested':
        return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
      case 'removed':
        return 'bg-slate-200 text-slate-900 dark:bg-slate-700/60 dark:text-slate-100'
      default:
        return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-100'
    }
  }

  function EventChip({ e }: { e: CalendarEvent }) {
    const cls = eventColorClasses(e)
    function Icon() {
      if (e.type === 'activity') {
        switch (activityTypeOf(e)) {
          case 'irrigation':
            return <Droplet className="size-3 opacity-80" aria-hidden="true" />
          case 'soil_amendment':
            return <FlaskConical className="size-3 opacity-80" aria-hidden="true" />
          case 'pest_management':
            return <Bug className="size-3 opacity-80" aria-hidden="true" />
          case 'asset_maintenance':
            return <Wrench className="size-3 opacity-80" aria-hidden="true" />
          default:
            return <Droplet className="size-3 opacity-80" aria-hidden="true" />
        }
      }
      return <Sprout className="size-3 opacity-80" aria-hidden="true" />
    }
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] sm:text-xs ${cls} transition-colors transition-shadow hover:shadow-sm active:shadow-md`} title={e.title}>
        <Icon />
        <span className="truncate max-w-[9rem] sm:max-w-[12rem]">{e.title}</span>
      </span>
    )
  }



  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button className="border rounded px-2 py-1 transition-colors active:scale-95 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40" onClick={() => setCurrent(({ y, m }) => (m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 }))}>Prev</button>
          <div className="font-semibold">{new Date(current.y, current.m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
          <button className="border rounded px-2 py-1 transition-colors active:scale-95 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40" onClick={() => setCurrent(({ y, m }) => (m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 }))}>Next</button>
          <button className="ml-2 border rounded px-2 py-1 transition-colors active:scale-95 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40" onClick={() => setCurrent({ y: today.getFullYear(), m: today.getMonth() })}>Today</button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2" role="tablist" aria-label="Filter">
          {(['all','activity','planting'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={filter===v} className={`rounded px-2 py-1 text-xs sm:text-sm border transition-colors active:scale-95 ${filter===v ? 'bg-accent text-accent-foreground' : 'bg-background hover:bg-accent/40'} focus-visible:ring-2 focus-visible:ring-ring/40`} onClick={() => setFilter(v)}>
              {v === 'all' ? 'All' : v === 'activity' ? 'Activities' : 'Plantings'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium mr-1">Legend</span>
        <div className="inline-flex items-center gap-1"><Droplet className="size-3 text-blue-600" aria-hidden="true" /> Irrigation</div>
        <div className="inline-flex items-center gap-1"><FlaskConical className="size-3 text-amber-700" aria-hidden="true" /> Soil amend.</div>
        <div className="inline-flex items-center gap-1"><Bug className="size-3 text-rose-700" aria-hidden="true" /> Pest mgmt.</div>
        <div className="inline-flex items-center gap-1"><Wrench className="size-3 text-violet-700" aria-hidden="true" /> Maintenance</div>
        <div className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-yellow-500" /> Nursery</div>
        <div className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-green-600" /> Planted</div>
        <div className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-emerald-600" /> Harvested</div>
        <div className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-slate-500" /> Removed</div>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
          <div key={d} className="text-xs text-muted-foreground px-1">{d}</div>
        ))}
        {cells.map((d) => {
          const key = fmt(d)
          const dayEvents = byDay.get(key) || []
          const isOtherMonth = d.getMonth() !== current.m
          const isToday = isSameDay(d, today)
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          const moon = hawaiianMoonForDate(d)
          return (
            <div key={key} className={`min-h-28 rounded-lg p-1 border border-border/30 transition-colors transition-shadow hover:border-border/70 hover:shadow-md active:shadow-lg active:bg-accent/10 focus-within:ring-2 focus-within:ring-ring/40 ${isOtherMonth ? 'bg-muted/30 text-muted-foreground' : 'bg-background'} ${isWeekend && !isOtherMonth ? 'bg-muted/20' : ''} ${isToday ? 'ring-2 ring-primary/50' : ''}`} onClick={() => setDetail({ open: true, date: key })} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDetail({ open: true, date: key }) }}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className={`font-semibold flex items-center gap-2 ${isToday ? 'text-primary' : ''}`}>
                  {d.getDate()}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span aria-hidden="true">{moonEmojiForDate(d)}</span>
                        <span>{moon?.name ?? ''}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{moon?.recommendation ?? ''}</TooltipContent>
                  </Tooltip>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="border rounded-md h-8 px-2 text-xs sm:h-7 sm:px-2 touch-manipulation select-none transition-colors active:scale-95 hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-ring/40" aria-label="Add to this day" onClick={(e) => { e.stopPropagation() }}>Add</button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={{ pathname: '/activities/new', query: { start: key + 'T09:00' } }}>Schedule Activity</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={{ pathname: '/plantings', query: { schedule: key, mode: 'nursery' } }}>Nursery sow</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={{ pathname: '/plantings', query: { schedule: key, mode: 'direct' } }}>Direct seed</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <ul className="space-y-1">
                {dayEvents.slice(0,4).map((e) => (
                  <li key={e.id} className="truncate">
                    <EventChip e={e} />
                  </li>
                ))}
                {dayEvents.length > 4 ? (
                  <li className="text-xs text-muted-foreground">+{dayEvents.length - 4} more</li>
                ) : null}
              </ul>
            </div>
          )
        })}
      </div>
      <Dialog open={detail.open} onOpenChange={(open) => setDetail((d) => ({ open, date: open ? d.date : null }))}>
        <DayDetailDialog dateISO={detail.date ?? ''} events={detail.date ? byDay.get(detail.date) || [] : []} locations={locations.filter((l) => l.latitude != null && l.longitude != null)} />
      </Dialog>
    </div>
  )
}

function DayDetailDialog({ dateISO, events, locations }: { dateISO: string; events: CalendarEvent[]; locations: Array<{ id: string; name: string; latitude: number | null; longitude: number | null }> }) {
  const [state, setState] = React.useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; data: { moonPhaseLabel?: string; current?: { temp?: number; weather?: { description?: string; icon?: string } | null } } }
    | { status: 'error'; message: string }
  >({ status: 'idle' })
  const [selectedLocationId, setSelectedLocationId] = React.useState<string | null>(locations[0]?.id ?? null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setState({ status: 'loading' })
        let data = {}
        if (selectedLocationId) {
          const res = await fetch('/api/locations/' + encodeURIComponent(selectedLocationId) + '/weather', { cache: 'no-store' })
          if (res.ok) {
            try {
              data = await res.json()
            } catch (e) {
              if (!cancelled) {
                setState({ status: 'error', message: e instanceof Error ? e.message : 'Failed to parse weather response' })
              }
              return
            }
          } else {
            data = {}
          }
        }
        if (!cancelled) setState({ status: 'ready', data })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : 'Failed to load' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [dateISO, selectedLocationId])

  const d = new Date(dateISO + 'T00:00:00')
  const moonLocal = hawaiianMoonForDate(d)
  const moonRec = moonLocal?.recommendation ?? (state.status === 'ready' ? (hawaiianMoonRecommendationByName(state.data.moonPhaseLabel) ?? null) : null)

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{d.toLocaleDateString()}</DialogTitle>
        <DialogDescription>Day overview with events, weather, and Hawaiian moon</DialogDescription>
      </DialogHeader>
      {locations.length > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">Location</label>
          <select className="border rounded px-2 py-1" value={selectedLocationId ?? ''} onChange={(e) => setSelectedLocationId(e.currentTarget.value || null)}>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="text-sm text-muted-foreground">
        <div>Hawaiian moon: <span className="mr-1" aria-hidden="true">{moonEmojiForDate(d)}</span><span className="font-medium">{moonLocal?.name ?? (state.status === 'ready' ? state.data.moonPhaseLabel ?? '—' : '—')}</span></div>
        {moonRec ? (
          <div className="mt-1 text-xs text-foreground bg-emerald-500/90 dark:bg-emerald-600/80 text-white inline-block rounded px-2 py-1 max-w-full">
            {moonRec}
          </div>
        ) : null}
      </div>
      <div className="space-y-3">
        <div className="text-base font-semibold">Events</div>
        {events.length === 0 ? (
          <div className="text-sm text-muted-foreground">No events</div>
        ) : (
          <div className="space-y-4">
            {events.filter((e) => e.type === 'activity').length > 0 ? (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                <div className="text-sm font-medium text-foreground">Activities</div>
                <ul className="space-y-2">
                  {events.filter((e) => e.type === 'activity').map((e) => (
                    <li key={e.id} className="text-sm">
                      <ActivityLineDetailed e={e} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {events.filter((e) => e.type === 'planting').length > 0 ? (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                <div className="text-sm font-medium text-foreground">Plantings</div>
                <ul className="space-y-2">
                  {events.filter((e) => e.type === 'planting').map((e) => (
                    <li key={e.id} className="text-sm">
                      <PlantingLineDetailed e={e} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
      <div className="text-sm rounded-md border bg-muted/40 p-3">
        <div className="text-base font-semibold mb-1">Weather</div>
        {state.status === 'loading' ? <div className="text-muted-foreground">Loading…</div> : (
          <div className="text-muted-foreground">{state.status === 'ready' && state.data.current?.temp != null ? `${Math.round(state.data.current.temp)}°` : '—'} {state.status === 'ready' && state.data.current?.weather?.description ? `· ${state.data.current.weather.description}` : ''}</div>
        )}
      </div>
    </DialogContent>
  )
}

function PlantingLine({ e }: { e: CalendarEvent }) {
  const meta = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : undefined
  const crop = typeof meta?.crop === 'string' ? meta.crop : undefined
  const variety = typeof meta?.variety === 'string' ? meta.variety : undefined
  const qty = typeof meta?.qty === 'number' ? meta.qty : undefined
  const weight = typeof meta?.weight_grams === 'number' ? meta.weight_grams : undefined
  const plantingId = typeof meta?.planting_id === 'number' ? meta.planting_id : undefined
  const href = plantingId ? `/plantings#p${plantingId}` : '/plantings'
  const detail = [crop, variety].filter(Boolean).join(' — ')
  const metrics = qty != null ? `${qty}` : (weight != null ? `${weight}g` : '')
  return (
    <Link href={href} className="underline-offset-2 hover:underline">
      {detail ? `${detail}${metrics ? ` · ${metrics}` : ''}` : e.title}
    </Link>
  )
}

function ActivityLineDetailed({ e }: { e: CalendarEvent }) {
  const meta = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : undefined
  const t = typeof meta?.activity_type === 'string' ? meta.activity_type : undefined
  const id = typeof meta?.id === 'number' ? meta.id : undefined
  const href = typeof id === 'number' ? `/activities/${id}/edit` : '/activities'
  if (t === 'irrigation') {
    const mins = typeof meta?.duration_minutes === 'number' ? meta.duration_minutes : undefined
    return (
      <Link href={href} className="inline-flex items-center gap-2 underline-offset-2 hover:underline">
        <Droplet className="size-3 text-blue-600" />
        <span>Irrigation{mins != null ? ` · ${mins}m` : ''}</span>
      </Link>
    )
  }
  if (t === 'soil_amendment') {
    const amRaw = meta ? (meta['activities_soil_amendments'] as unknown) : undefined
    const list = Array.isArray(amRaw) ? amRaw : []
    const parts = list
      .filter((a) => a && a.name)
      .map((a) => {
        const rec = a as Record<string, unknown>
        const name = typeof rec.name === 'string' ? rec.name : ''
        const quantity = typeof rec.quantity === 'number' ? rec.quantity : null
        const unit = typeof rec.unit === 'string' ? rec.unit : ''
        return `${quantity != null ? quantity : ''}${unit ? unit : ''}${quantity != null || unit ? ' ' : ''}${name}`
      })
    return (
      <Link href={href} className="inline-flex items-center gap-2 underline-offset-2 hover:underline">
        <FlaskConical className="size-3 text-amber-700" />
        <span>Soil amendment{parts.length ? ` · ${parts.join(', ')}` : ''}</span>
      </Link>
    )
  }
  if (t === 'pest_management') {
    return (
      <Link href={href} className="inline-flex items-center gap-2 underline-offset-2 hover:underline">
        <Bug className="size-3 text-rose-700" />
        <span>Pest management</span>
      </Link>
    )
  }
  if (t === 'asset_maintenance') {
    return (
      <Link href={href} className="inline-flex items-center gap-2 underline-offset-2 hover:underline">
        <Wrench className="size-3 text-violet-700" />
        <span>Asset maintenance</span>
      </Link>
    )
  }
  return (
    <Link href={href} className="inline-flex items-center gap-2 underline-offset-2 hover:underline">
      <Wrench className="size-3 text-violet-700" />
      <span>{e.title}</span>
    </Link>
  )
}

function PlantingLineDetailed({ e }: { e: CalendarEvent }) {
  const label = <PlantingLine e={e} />
  return (
    <div className="inline-flex items-center gap-2">
      <Sprout className="size-3 text-green-700" />
      {label}
    </div>
  )
}


