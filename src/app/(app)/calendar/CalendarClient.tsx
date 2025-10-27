'use client'

import * as React from 'react'
import Link from 'next/link'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Droplet, Sprout, Wrench, Bug, FlaskConical, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, ShoppingBasket, Calendar, CalendarRange, CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { hawaiianMoonForDate, lunarPhaseFraction, hawaiianMoonRecommendationByName } from '@/lib/hawaiian-moon'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'

export type CalendarEvent = {
  id: string
  type: 'activity' | 'planting' | 'harvest'
  title: string
  start: string
  end?: string | null
  meta?: Record<string, unknown>
}

type CalendarFilter = 'all' | 'activity' | 'planting' | 'harvest'

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
  const [range, setRange] = React.useState<'month' | 'week' | 'today'>('month')

  React.useEffect(() => {
    try { window.localStorage.setItem('calendar.filter', filter) } catch {}
  }, [filter])
  React.useEffect(() => {
    try { window.localStorage.setItem('calendar.range', range) } catch {}
  }, [range])
  React.useEffect(() => {
    // Load persisted settings on client after mount to avoid SSR hydration mismatch
    try {
      const v1 = window.localStorage.getItem('calendar.filter') as CalendarFilter | null
      if (v1 === 'all' || v1 === 'activity' || v1 === 'planting' || v1 === 'harvest') setFilter(v1)
      const v2 = window.localStorage.getItem('calendar.range') as 'month' | 'week' | 'today' | null
      if (v2 === 'month' || v2 === 'week' || v2 === 'today') setRange(v2)
    } catch {}
  }, [])

  // Focused date for week/day navigation
  const [focusDateISO, setFocusDateISO] = React.useState<string>(() => {
    return `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`
  })
  React.useEffect(() => {
    if (range === 'today') {
      setDetail({ open: true, date: focusDateISO })
    }
  }, [range, focusDateISO])

  // Navigation helpers (used by buttons and swipe)
  const navigatePrev = React.useCallback(() => {
    if (range === 'today') {
      const d = new Date(focusDateISO + 'T00:00:00')
      d.setDate(d.getDate() - 1)
      setFocusDateISO(fmt(d))
      setCurrent({ y: d.getFullYear(), m: d.getMonth() })
    } else if (range === 'week') {
      const d = new Date(focusDateISO + 'T00:00:00')
      d.setDate(d.getDate() - 7)
      setFocusDateISO(fmt(d))
      setCurrent({ y: d.getFullYear(), m: d.getMonth() })
    } else {
      setCurrent(({ y, m }) => (m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 }))
    }
  }, [range, focusDateISO])

  const navigateNext = React.useCallback(() => {
    if (range === 'today') {
      const d = new Date(focusDateISO + 'T00:00:00')
      d.setDate(d.getDate() + 1)
      setFocusDateISO(fmt(d))
      setCurrent({ y: d.getFullYear(), m: d.getMonth() })
    } else if (range === 'week') {
      const d = new Date(focusDateISO + 'T00:00:00')
      d.setDate(d.getDate() + 7)
      setFocusDateISO(fmt(d))
      setCurrent({ y: d.getFullYear(), m: d.getMonth() })
    } else {
      setCurrent(({ y, m }) => (m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 }))
    }
  }, [range, focusDateISO])

  // Keep header (month/year) in sync with focused date for today/week
  React.useEffect(() => {
    if (range !== 'month') {
      const d = new Date(focusDateISO + 'T00:00:00')
      setCurrent({ y: d.getFullYear(), m: d.getMonth() })
    }
  }, [range, focusDateISO])

  function startOfMonth(y: number, m: number) { return new Date(y, m, 1) }

  const first = startOfMonth(current.y, current.m)
  const firstDay = new Date(first)
  firstDay.setDate(first.getDate() - first.getDay())

  const cells: Date[] = []
  if (range === 'today') {
    const anchor = new Date(focusDateISO + 'T00:00:00')
    cells.push(anchor)
  } else if (range === 'week') {
    const anchor = new Date(focusDateISO + 'T00:00:00')
    const startWeek = new Date(anchor)
    startWeek.setDate(anchor.getDate() - startWeek.getDay())
    for (let i = 0; i < 7; i++) {
      const d = new Date(startWeek)
      d.setDate(startWeek.getDate() + i)
      cells.push(d)
    }
  } else {
    for (let i = 0; i < 42; i++) { // 6 weeks
      const d = new Date(firstDay)
      d.setDate(firstDay.getDate() + i)
      cells.push(d)
    }
  }

  function inSelectedRange(dateISO: string): boolean {
    const d = new Date(dateISO + 'T00:00:00')
    if (range === 'today') {
      const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      return d.getTime() === t.getTime()
    }
    if (range === 'week') {
      const start = new Date(today)
      start.setDate(today.getDate() - today.getDay())
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      return d >= start && d <= end
    }
    return true
  }
  const filtered = (filter === 'all' ? events : events.filter((e) => e.type === filter)).filter((e) => inSelectedRange(e.start))
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
    if (e.type === 'harvest') {
      return 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100'
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
            return <Droplet className="size-4 sm:size-3 opacity-80" aria-hidden="true" />
          case 'soil_amendment':
            return <FlaskConical className="size-4 sm:size-3 opacity-80" aria-hidden="true" />
          case 'pest_management':
            return <Bug className="size-4 sm:size-3 opacity-80" aria-hidden="true" />
          case 'asset_maintenance':
            return <Wrench className="size-4 sm:size-3 opacity-80" aria-hidden="true" />
          default:
            return <Droplet className="size-4 sm:size-3 opacity-80" aria-hidden="true" />
        }
      }
      if (e.type === 'harvest') {
        return <ShoppingBasket className="size-4 sm:size-3 opacity-80" aria-hidden="true" />
      }
      return <Sprout className="size-4 sm:size-3 opacity-80" aria-hidden="true" />
    }
    const meta = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : undefined
    const start = typeof meta?.window_start === 'string' ? meta.window_start : undefined
    const end = typeof meta?.window_end === 'string' ? meta.window_end : undefined
    const range = start && end ? `${start.slice(5)}–${end.slice(5)}` : undefined
    const metaCrop = meta && typeof meta.crop === 'string' ? meta.crop : undefined
    const chipText = e.type === 'harvest' ? (['Harvest', metaCrop].filter(Boolean) as string[]).join(' · ') : e.title
    return (
      <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-1 rounded-full px-1 py-0 text-[10px] sm:px-1.5 sm:py-0.5 sm:text-xs ${cls} transition-colors transition-shadow hover:shadow-sm active:shadow-md`} title={e.title}>
            <Icon />
            <span className="hidden sm:inline truncate max-w-[9rem] sm:max-w-[12rem]">{e.type === 'harvest' ? chipText : (range ? `${chipText} · ${range}` : chipText)}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{e.title}</TooltipContent>
      </Tooltip>
      </TooltipProvider>
    )
  }



  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrent(({ y, m }) => ({ y: y-1, m }))} aria-label="Previous year">
            <ChevronsLeft className="mr-1 h-4 w-4" /> Year
          </Button>
          <Button variant="outline" size="sm" onClick={navigatePrev} aria-label="Previous">
            <ChevronLeft className="mr-1 h-4 w-4" /> Prev
          </Button>
          <div className="font-semibold text-lg">
            {new Date(current.y, current.m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
          </div>
          <Button variant="outline" size="sm" onClick={navigateNext} aria-label="Next">
            Next <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrent(({ y, m }) => ({ y: y+1, m }))} aria-label="Next year">
            Year <ChevronsRight className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" className="ml-2 hidden sm:inline-flex" onClick={() => { setCurrent({ y: today.getFullYear(), m: today.getMonth() }); setFocusDateISO(fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate()))) }}>
            <CalendarDays className="mr-1 h-4 w-4" /> Today
          </Button>
        </div>
        {/* Mobile compact filter menu */}
        <div className="w-full md:hidden sticky top-0 z-10 bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur rounded-md px-1 py-1 flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="border rounded px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40">Filters</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[16rem]">
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground/80 border-b">Type</div>
              {(['all','activity','planting','harvest'] as const).map((v) => {
                const label = v === 'all' ? 'All' : v === 'activity' ? 'Activities' : v === 'planting' ? 'Plantings' : 'Harvests'
                const Icon = v === 'all' ? CalendarDays : v === 'activity' ? Wrench : v === 'planting' ? Sprout : ShoppingBasket
                return (
                  <DropdownMenuItem key={v} onClick={() => setFilter(v)} className={filter===v ? 'bg-accent/60 focus:bg-accent/60' : ''}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </span>
                  </DropdownMenuItem>
                )
              })}
              <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground/80 border-y">Range</div>
              {(['month','week','today'] as const).map((v) => {
                const label = v[0].toUpperCase() + v.slice(1)
                const Icon = v === 'month' ? Calendar : v === 'week' ? CalendarRange : CalendarDays
                return (
                  <DropdownMenuItem key={v} onClick={() => setRange(v)} className={range===v ? 'bg-accent/60 focus:bg-accent/60' : ''}>
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </span>
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => { setCurrent({ y: today.getFullYear(), m: today.getMonth() }); setFocusDateISO(fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate()))) }}>
            <CalendarDays className="mr-1 h-4 w-4" /> Today
          </Button>
        </div>
        {/* Desktop/tablet filter row (wraps; no sticky to avoid overlap) */}
        <div className="hidden md:flex w-full px-1 py-1 items-center gap-3 flex-wrap mt-1">
          <div className="flex items-center gap-1 sm:gap-2 flex-nowrap" role="tablist" aria-label="Filter">
            {(['all','activity','planting','harvest'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={filter===v} className={`rounded px-2 py-1 text-xs sm:text-sm whitespace-nowrap border transition-colors active:scale-95 ${filter===v ? 'bg-accent text-accent-foreground' : 'bg-background hover:bg-accent/40'} focus-visible:ring-2 focus-visible:ring-ring/40`} onClick={() => setFilter(v)}>
                {v === 'all' ? 'All' : v === 'activity' ? 'Activities' : v === 'planting' ? 'Plantings' : 'Harvests'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-nowrap" role="tablist" aria-label="Range">
            {(['month','week','today'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={range===v} className={`rounded px-2 py-1 text-xs sm:text-sm whitespace-nowrap border transition-colors active:scale-95 ${range===v ? 'bg-accent text-accent-foreground' : 'bg-background hover:bg-accent/40'} focus-visible:ring-2 focus-visible:ring-ring/40`} onClick={() => setRange(v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="border rounded px-2 py-1 text-xs sm:text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40 hidden sm:inline-block">Legend</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-foreground">
                <div className="inline-flex items-center gap-2"><Droplet className="size-3 text-blue-600" /> Irrigation</div>
                <div className="inline-flex items-center gap-2"><FlaskConical className="size-3 text-amber-700" /> Soil amend.</div>
                <div className="inline-flex items-center gap-2"><Bug className="size-3 text-rose-700" /> Pest mgmt.</div>
                <div className="inline-flex items-center gap-2"><Wrench className="size-3 text-violet-700" /> Maintenance</div>
                <div className="inline-flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-yellow-500" /> Nursery</div>
                <div className="inline-flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-green-600" /> Planted</div>
                <div className="inline-flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-emerald-600" /> Harvested</div>
                <div className="inline-flex items-center gap-2"><span className="inline-block size-2 rounded-full bg-slate-500" /> Removed</div>
                <div className="inline-flex items-center gap-2"><ShoppingBasket className="size-3 text-emerald-700" /> Harvest</div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Legend now in dropdown to reduce visual noise */}
      <div className={`grid ${range==='week' ? 'grid-cols-7' : range==='today' ? 'grid-cols-1' : 'grid-cols-7'} gap-2`}>
        {(() => {
          const names = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
          if (range === 'today') {
            const d = new Date(focusDateISO + 'T00:00:00')
            return <div className="text-xs text-muted-foreground px-1">{names[d.getDay()]}</div>
          }
          return names.map((d) => (<div key={d} className="text-xs text-muted-foreground px-1">{d}</div>))
        })()}
        {cells.map((d) => {
          const key = fmt(d)
          const dayEventsRaw = byDay.get(key) || []
          const priority = (t: CalendarEvent['type']) => (t === 'harvest' ? 0 : t === 'planting' ? 1 : 2)
          const dayEvents = [...dayEventsRaw].sort((a, b) => {
            const pa = priority(a.type); const pb = priority(b.type)
            if (pa !== pb) return pa - pb
            return (a.title || '').localeCompare(b.title || '')
          })
          const isOtherMonth = d.getMonth() !== current.m
          const isToday = isSameDay(d, today)
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          const moon = hawaiianMoonForDate(d)
          return (
				<div key={key} className={`min-h-28 rounded-lg p-1 border border-border/30 transition-colors transition-shadow hover:border-border/70 hover:shadow-md active:shadow-lg active:bg-accent/10 focus-within:ring-2 focus-within:ring-ring/40 ${isOtherMonth ? 'bg-muted/30 text-muted-foreground' : 'bg-background'} ${isWeekend && !isOtherMonth ? 'bg-muted/20' : ''} ${isToday ? 'ring-2 ring-primary/50' : ''}`} onClick={() => setDetail({ open: true, date: key })} role="button" tabIndex={0} aria-label={d.toLocaleDateString()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDetail({ open: true, date: key }) }}>
              <div className="flex items-center justify-between text-xs mb-2">
                <div className={`font-semibold flex items-center gap-2 ${isToday ? 'text-primary' : ''}`}>
                  {d.getDate()}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                        <span aria-hidden="true">{moonEmojiForDate(d)}</span>
                        <span className="hidden sm:inline">{moon?.name ?? ''}</span>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">{moon?.recommendation ?? ''}</TooltipContent>
                  </Tooltip>
                </div>
                {/* Add actions moved to day detail dialog for clarity on resize; '+' removed from grid */}
              </div>
              <ul className="space-y-1 mt-1">
                {dayEvents.slice(0, (typeof window === 'undefined' ? 2 : 2)).map((e) => (
                  <li key={e.id} className="truncate">
                    <EventChip e={e} />
                  </li>
                ))}
                {dayEvents.length > 2 ? (
                  <li className="text-xs text-muted-foreground hidden sm:block">+{dayEvents.length - 4} more</li>
                ) : null}
              </ul>
            </div>
          )
        })}
      </div>
      <Dialog open={detail.open} onOpenChange={(open) => setDetail((d) => ({ open, date: open ? d.date : null }))}>
        <DayDetailDialog
          dateISO={detail.date ?? ''}
          events={detail.date ? byDay.get(detail.date) || [] : []}
          locations={locations.filter((l) => l.latitude != null && l.longitude != null)}
          onPrev={() => {
            if (!detail.date) return
            const dd = new Date(detail.date + 'T00:00:00')
            dd.setDate(dd.getDate() - 1)
            setDetail({ open: true, date: fmt(dd) })
          }}
          onNext={() => {
            if (!detail.date) return
            const dd = new Date(detail.date + 'T00:00:00')
            dd.setDate(dd.getDate() + 1)
            setDetail({ open: true, date: fmt(dd) })
          }}
        />
      </Dialog>
    </div>
  )
}

function DayDetailDialog({ dateISO, events, locations, onPrev, onNext }: { dateISO: string; events: CalendarEvent[]; locations: Array<{ id: string; name: string; latitude: number | null; longitude: number | null }>; onPrev: () => void; onNext: () => void }) {
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

function HarvestLineDetailed({ e }: { e: CalendarEvent }) {
  const meta = e.meta && typeof e.meta === 'object' ? (e.meta as Record<string, unknown>) : undefined
  const crop = typeof meta?.crop === 'string' ? meta.crop : undefined
  const variety = typeof meta?.variety === 'string' ? meta.variety : undefined
  const plantingId = typeof meta?.planting_id === 'number' ? meta.planting_id : undefined
  const href = plantingId ? `/plantings#p${plantingId}` : '/plantings'
  const ws = typeof meta?.window_start === 'string' ? meta.window_start : undefined
  const we = typeof meta?.window_end === 'string' ? meta.window_end : undefined
  const toLocal = (s?: string) => {
    if (!s) return ''
    try { return new Date(s + 'T00:00:00').toLocaleDateString() } catch { try { return new Date(s).toLocaleDateString() } catch { return s } }
  }
  const range = ws && we ? `${toLocal(ws)} → ${toLocal(we)}` : (ws ? toLocal(ws) : (we ? toLocal(we) : undefined))
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


