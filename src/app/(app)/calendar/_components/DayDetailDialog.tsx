'use client'

import * as React from 'react'
import Link from 'next/link'
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, CalendarPlus, Droplet, FlaskConical, Bug, Wrench, ShoppingBasket, Sprout } from 'lucide-react'
import type { CalendarEvent, CalendarLocation } from '../types'
import { hawaiianMoonForDate, hawaiianMoonRecommendationByName, moonEmojiForDate } from '@/lib/hawaiian-moon'
import { formatDateLocal } from '@/lib/date'

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
      .filter((a) => a && (a as Record<string, unknown>).name)
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

function HarvestLineDetailed({ e }: { e: CalendarEvent }) {
  const meta = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : undefined
  const crop = typeof meta?.crop === 'string' ? meta.crop : undefined
  const variety = typeof meta?.variety === 'string' ? meta.variety : undefined
  const plantingId = typeof meta?.planting_id === 'number' ? meta.planting_id : undefined
  const href = plantingId ? `/plantings#p${plantingId}` : '/plantings'
  const ws = typeof meta?.window_start === 'string' ? meta.window_start : undefined
  const we = typeof meta?.window_end === 'string' ? meta.window_end : undefined
  const toLocal = (s?: string) => (s ? formatDateLocal(s) : '')
  function formatRange(start?: string, end?: string): string | undefined {
    const startLocal = start ? toLocal(start) : undefined
    const endLocal = end ? toLocal(end) : undefined
    if (startLocal && endLocal) return `${startLocal} → ${endLocal}`
    return startLocal ?? endLocal
  }
  const range = formatRange(ws, we)
  const loc = typeof meta?.location_label === 'string' ? meta.location_label : undefined
  const pieces = [crop, variety, loc, range ? `(${range})` : undefined].filter(Boolean)
  const label = pieces.join(' — ')
  return (
    <Link href={href} className="inline-flex items-center gap-2 underline-offset-2 hover:underline">
      <ShoppingBasket className="size-3 text-emerald-700" />
      <span>{label || e.title}</span>
    </Link>
  )
}

export function DayDetailDialog({ dateISO, events, locations, onPrev, onNext }: { dateISO: string; events: CalendarEvent[]; locations: Array<CalendarLocation>; onPrev: () => void; onNext: () => void }) {
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
        <div className="flex items-center justify-between gap-2 pr-12 sm:pr-16">
          <DialogTitle>{d.toLocaleDateString()}</DialogTitle>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground" onClick={onPrev} aria-label="Previous day">
              <ChevronLeft className="h-3 w-3 mr-1" /> Prev
            </button>
            <button className="inline-flex items-center rounded-md border px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground" onClick={onNext} aria-label="Next day">
              Next <ChevronRight className="h-3 w-3 ml-1" />
            </button>
          </div>
        </div>
        <DialogDescription>Day overview with events, weather, and Hawaiian moon</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap gap-2 mb-3">
        <Link className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs sm:text-sm shadow hover:opacity-90 active:opacity-95" href={{ pathname: '/activities/new', query: { start: dateISO + 'T09:00' } }}>
          <CalendarPlus className="h-4 w-4" />
          <span>Schedule Activity</span>
        </Link>
        <Link className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground" href={{ pathname: '/plantings', query: { schedule: dateISO, mode: 'nursery' } }}>
          <FlaskConical className="h-4 w-4" />
          <span>Nursery sow</span>
        </Link>
        <Link className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground" href={{ pathname: '/plantings', query: { schedule: dateISO, mode: 'direct' } }}>
          <Sprout className="h-4 w-4" />
          <span>Direct seed</span>
        </Link>
      </div>
      {locations.length > 1 ? (
        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">Location</label>
          <select className="border rounded px-2 py-1 focus-visible:ring-2 focus-visible:ring-ring/40" value={selectedLocationId ?? ''} onChange={(e) => setSelectedLocationId(e.currentTarget.value || null)}>
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
            {events.filter((e) => e.type === 'harvest').length > 0 ? (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3">
                <div className="text-sm font-medium text-foreground">Harvests</div>
                <ul className="space-y-2">
                  {events.filter((e) => e.type === 'harvest').map((e) => (
                    <li key={e.id} className="text-sm">
                      <HarvestLineDetailed e={e} />
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


