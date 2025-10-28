'use client'

import * as React from 'react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Droplet, Sprout, Wrench, Bug, FlaskConical, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays, ShoppingBasket, Calendar, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CalendarEvent, CalendarFilter, CalendarLocation } from './types'
import { Dialog } from '@/components/ui/dialog'
import { DayCell } from './_components/DayCell'
import { DayDetailDialog } from './_components/DayDetailDialog'

// moonEmojiForDate now imported from '@/lib/hawaiian-moon'

export default function CalendarClient({ events, locations = [] }: { events: CalendarEvent[]; locations?: Array<CalendarLocation> }) {
  const today = new Date()
  const [current, setCurrent] = React.useState<{ y: number; m: number }>({ y: today.getFullYear(), m: today.getMonth() })
  const [filter, setFilter] = React.useState<CalendarFilter>('all')
  const [detail, setDetail] = React.useState<{ open: boolean; date: string | null }>({ open: false, date: null })
  const [range, setRange] = React.useState<'month' | 'week' | 'today'>('month')

  React.useEffect(() => {
    try { window.localStorage.setItem('calendar.filter', filter) } catch (e) {
      console.warn('Failed to persist calendar.filter to localStorage', e)
    }
  }, [filter])
  React.useEffect(() => {
    try { window.localStorage.setItem('calendar.range', range) } catch (e) {
      console.warn('Failed to persist calendar.range to localStorage', e)
    }
  }, [range])
  React.useEffect(() => {
    // Load persisted settings on client after mount to avoid SSR hydration mismatch
    try {
      const storedFilter = window.localStorage.getItem('calendar.filter') as CalendarFilter | null
      if (storedFilter === 'all' || storedFilter === 'activity' || storedFilter === 'planting' || storedFilter === 'harvest') setFilter(storedFilter)
      const storedRange = window.localStorage.getItem('calendar.range') as 'month' | 'week' | 'today' | null
      if (storedRange === 'month' || storedRange === 'week' || storedRange === 'today') setRange(storedRange)
    } catch (e) {
      console.warn('Failed to load persisted calendar settings from localStorage', e)
    }
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

  function fmt(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  }

  const filtered = (filter === 'all' ? events : events.filter((e) => e.type === filter)).filter((e) => inSelectedRange(e.start))
  const byDay = new Map<string, CalendarEvent[]>()
  for (const e of filtered) {
    const day = e.start.slice(0,10)
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(e)
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
          const eventsWithPriority = dayEventsRaw.map((e) => ({
            e,
            p: e.type === 'harvest' ? 0 : e.type === 'planting' ? 1 : 2,
          }))
          eventsWithPriority.sort((a, b) => {
            if (a.p !== b.p) return a.p - b.p
            return (a.e.title || '').localeCompare(b.e.title || '')
          })
          const dayEvents = eventsWithPriority.map(({ e }) => e)
          return (
            <DayCell
              key={key}
              date={d}
              currentMonth={current.m}
              today={today}
              onOpenDetail={(dateISO) => setDetail({ open: true, date: dateISO })}
              events={dayEvents}
            />
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


